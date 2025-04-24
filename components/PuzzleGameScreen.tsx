import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import ConfirmationModal from "./ConfirmationModal"; // ConfirmationModal をインポート

// --- 型定義 ---
// windowオブジェクトの型拡張 (webkitAudioContext用)
interface ExtendedWindow extends Window {
  AudioContext?: typeof AudioContext; // AudioContextを追加
  webkitAudioContext?: typeof AudioContext;
}
declare const window: ExtendedWindow; // グローバルなwindowオブジェクトに型を適用

interface StagePair {
  color: number;
  positions: number[][];
}

interface Stage {
  id: string;
  width: number;
  height: number;
  pathCount?: number; // Optional based on original code
  minPath?: { color: number; path: number[] }[];
  minPathLen?: number; // Added based on usage in checkClearCondition
  pairs: StagePair[];
  obstacles: number[][];
  number?: number; // For hint cost
}

interface CellData {
  state: "empty" | "initial" | "filled" | "blocked";
  color: number | null;
}

interface ProgressData {
  [stageId: string]: {
    emptyCount: number;
    clearFlag: number; // 0: not cleared, 1: cleared, 3: perfect clear
    hintFlag?: number; // 0 or undefined: not bought, 1: bought
    timestamp: string;
  };
}

interface SoundBuffers {
  [key: string]: AudioBuffer | null;
  cancel: AudioBuffer | null;
  clear: AudioBuffer | null;
  fill: AudioBuffer | null;
  modal: AudioBuffer | null;
  success: AudioBuffer | null;
  decision: AudioBuffer | null;
}

// --- Props Interface ---
interface PuzzleGameScreenProps {
  onReturnHome: () => void; // ホームに戻るための関数
}

// --- コンポーネント ---
const PuzzleGameScreen: React.FC<PuzzleGameScreenProps> = () => {
  // onReturnHome を受け取る
  // --- State ---
  const [stages, setStages] = useState<Stage[]>([]);
  const effectState = useRef<"none" | "show">("none");
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [cellElements, setCellElements] = useState<(HTMLDivElement | null)[][]>(
    []
  ); // 型を (HTMLDivElement | null)[][] に変更
  const [reachFlag, setReachFlag] = useState<{ [key: number]: boolean }>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState<number[][]>([]);
  const [lastCell, setLastCell] = useState<number[] | null>(null);
  const [currentStars, setCurrentStars] = useState(0);
  const [progress, setProgress] = useState<ProgressData>({});
  const [informationText, setInformationText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false); // ステージ選択モーダル用
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [nowPlayingText, setNowPlayingText] = useState("");
  const [pairs, setPairs] = useState<StagePair[]>([]); // Added state for pairs
  const [flyingStars, setFlyingStars] = useState<FlyingStarData[]>([]); // 星アニメーション用State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false); // 確認モーダル用
  const [confirmStep, setConfirmStep] = useState(0); // 確認ステップ (0: 初期, 1: 1段階目, 2: 2段階目, 3: 3段階目)
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null); // 確認後に実行するアクション
  const [confirmMessage, setConfirmMessage] = useState(""); // 確認メッセージ

  // --- Refs ---
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const starDisplayRef = useRef<HTMLDivElement>(null); // スター表示エリアのRef (divに変更)
  const coolButtonRef = useRef<HTMLButtonElement>(null); // ステージ選択ボタンのRef (buttonに変更)
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundsRef = useRef<SoundBuffers>({
    cancel: null,
    clear: null,
    fill: null,
    modal: null,
    success: null,
    decision: null,
  });
  const isDrawingRef = useRef(isDrawing); // Ref to access current isDrawing state in event listeners
  const currentColorRef = useRef(currentColor);
  const currentPathRef = useRef(currentPath);
  const lastCellRef = useRef(lastCell);
  const gridRef = useRef(grid); // Ref for functions needing immediate grid access
  const reachFlagRef = useRef(reachFlag);
  const currentStageRef = useRef(currentStage);
  const progressRef = useRef(progress);
  const currentStarsRef = useRef(currentStars);
  const cellElementsRef = useRef<(HTMLDivElement | null)[][]>(cellElements); // 型を (HTMLDivElement | null)[][] に変更

  // Update refs when state changes
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);
  useEffect(() => {
    currentColorRef.current = currentColor;
  }, [currentColor]);
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);
  useEffect(() => {
    lastCellRef.current = lastCell;
  }, [lastCell]);
  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);
  useEffect(() => {
    reachFlagRef.current = reachFlag;
  }, [reachFlag]);
  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  useEffect(() => {
    currentStarsRef.current = currentStars;
  }, [currentStars]);
  useEffect(() => {
    cellElementsRef.current = cellElements;
  }, [cellElements]);

  // --- Constants ---
  const defaultVolume = 0.2; // Assuming isPC check is less relevant in React context or handled differently

  // --- Star Effect Data Interface ---
  interface FlyingStarData {
    id: string;
    startY: number;
    startX: number;
    targetRect: DOMRect; // Make non-nullable
    gameRect: DOMRect; // Make non-nullable
    delay: number; // Add delay property
  }

  // --- Audio Functions ---
  const loadAudio = useCallback(
    (fileName: keyof SoundBuffers): Promise<AudioBuffer> => {
      return fetch(`/sounds/${fileName}.mp3`) // Assuming sounds are in public/sounds
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => {
          return new Promise((resolve, reject) => {
            if (!audioContextRef.current)
              return reject("AudioContext not initialized");
            audioContextRef.current.decodeAudioData(
              arrayBuffer,
              resolve,
              reject
            );
          });
        });
    },
    []
  );

  const playAudio = useCallback(
    (fileName: keyof SoundBuffers, volume = defaultVolume) => {
      if (!isAudioUnlocked || !audioContextRef.current) return;
      const audioBuffer = soundsRef.current[fileName];
      if (!audioBuffer) return;

      try {
        const audioSource = audioContextRef.current.createBufferSource();
        audioSource.buffer = audioBuffer;

        if (volume) {
          const gainNode = audioContextRef.current.createGain();
          gainNode.gain.value = volume;
          gainNode.connect(audioContextRef.current.destination);
          audioSource.connect(gainNode);
        } else {
          audioSource.connect(audioContextRef.current.destination);
        }
        audioSource.start();
      } catch (error) {
        console.error("Error playing audio:", error);
        // Attempt to resume context if suspended
        if (audioContextRef.current.state === "suspended") {
          audioContextRef.current
            .resume()
            .then(() => {
              console.log("AudioContext resumed successfully.");
              // Optionally retry playing the sound here
            })
            .catch((resumeError) => {
              console.error("Failed to resume AudioContext:", resumeError);
            });
        }
      }
    },
    [isAudioUnlocked, defaultVolume]
  );

  const unlockAudio = useCallback(() => {
    if (!audioContextRef.current) {
      // ExtendedWindow 型を使用
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioContextRef.current = new AudioContext();
      } else {
        console.error("Web Audio API is not supported in this browser.");
        return; // Exit if Web Audio API is not supported
      }
    }

    // Add null check before accessing state or calling resume
    if (audioContextRef.current) {
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current
          .resume()
          .then(() => {
            console.log("AudioContext resumed!");
            setIsAudioUnlocked(true); // Set unlocked state only after successful resume
          })
          .catch((e) => console.error("Error resuming AudioContext:", e));
      } else if (audioContextRef.current.state === "running") {
        console.log("AudioContext already running.");
        setIsAudioUnlocked(true); // Already running, so consider it unlocked
      }
    }
  }, []);

  // --- Local Storage ---
  const loadStageProgress = useCallback((): ProgressData => {
    const storedProgress = localStorage.getItem("stageProgress");
    return storedProgress ? JSON.parse(storedProgress) : {};
  }, []);

  const saveStageProgress = useCallback(
    (stageId: string, result: ProgressData[string]) => {
      const currentProgress = loadStageProgress();
      currentProgress[stageId] = result;
      localStorage.setItem("stageProgress", JSON.stringify(currentProgress));
      setProgress(currentProgress); // Update state
    },
    [loadStageProgress]
  );

  /*
   * getProgress was removed as it's unused after refactoring.
   * Initial progress loading and star calculation are handled in the useEffect hook
   * that fetches stage data.
   */
  // const getProgress = useCallback(() => {
  //   const loadedProgress = loadStageProgress();
  //   setProgress(loadedProgress);
  //   progressRef.current = loadedProgress; // Ensure ref is updated immediately
  //   console.log("ステージの進捗データ:", loadedProgress);
  //   // Calculate initial stars based on progress
  //   let initialStars = 0;
  //   Object.keys(loadedProgress).forEach((pId) => {
  //     const stageData = stages.find((s) => s.id === pId);
  //     if (stageData && loadedProgress[pId]) {
  //       initialStars += loadedProgress[pId].emptyCount || 0;
  //       if (Number(loadedProgress[pId].hintFlag) === 1 && stageData.number) {
  //         initialStars -= stageData.number;
  //       }
  //     }
  //   });
  //   initialStars += 10; // Add initial bonus
  //   setCurrentStars(Math.max(0, initialStars));
  //   currentStarsRef.current = Math.max(0, initialStars);
  // }, [loadStageProgress, stages]);

  // --- Game Logic ---
  const setInformation = (text: string, addLineFlag = false) => {
    setInformationText((prev) => (addLineFlag ? prev + "\n" + text : text));
  };

  const renderCell = useCallback(
    (gridData: CellData[][], y: number, x: number): string => {
      const cell = gridData[y]?.[x]; // Add safe navigation
      if (!cell) return "cell empty cell-color-none"; // Default class if cell is undefined

      let className = `cell ${cell.state}`;
      if (
        (cell.state === "initial" || cell.state === "filled") &&
        cell.color !== null
      ) {
        className += ` cell-color-${cell.color}`;
      } else if (cell.state === "blocked") {
        className += " cell-color-block"; // Assuming you have this class
      } else {
        className += " cell-color-none";
      }
      return className;
    },
    []
  );

  const initGame = useCallback(
    (stage: Stage) => {
      console.log("Initializing stage:", stage);
      effectState.current = "none";
      setCurrentStage(stage);
      currentStageRef.current = stage; // Update ref immediately
      const { width: W, height: H } = stage;
      const newGrid: CellData[][] = Array(H)
        .fill(null)
        .map(() =>
          Array(W)
            .fill(null)
            .map(() => ({ state: "empty", color: null }))
        );
      // 型を (HTMLDivElement | null)[][] に合わせ、as any を削除
      const newCellElements: (HTMLDivElement | null)[][] = Array(H)
        .fill(null)
        .map(() => Array(W).fill(null));

      const newPairs = stage.pairs.map((p) => ({
        color: p.color,
        positions: p.positions.slice(),
      }));
      const newReachFlag: { [key: number]: boolean } = {};

      // Set obstacles
      if (stage.obstacles) {
        stage.obstacles.forEach(([oy, ox]) => {
          if (newGrid[oy] && newGrid[oy][ox]) {
            newGrid[oy][ox] = { state: "blocked", color: null };
          }
        });
      }

      // Set initial cells and reach flags
      newPairs.forEach((pair) => {
        pair.positions.forEach(([py, px]) => {
          if (newGrid[py] && newGrid[py][px]) {
            newGrid[py][px] = { state: "initial", color: pair.color };
          }
        });
        newReachFlag[pair.color] = false;
      });

      setGrid(newGrid);
      gridRef.current = newGrid; // Update ref
      setCellElements(newCellElements); // Set the initialized (empty) cell elements array
      cellElementsRef.current = newCellElements; // Update ref
      setPairs(newPairs); // Assuming you add a state for pairs
      setReachFlag(newReachFlag);
      reachFlagRef.current = newReachFlag; // Update ref
      setIsDrawing(false);
      setCurrentColor(null);
      setCurrentPath([]);
      setLastCell(null);
      setInformation("");
      if (gameContainerRef.current) {
        gameContainerRef.current.classList.remove("clear");
      }

      const idx = stages.findIndex((s) => s.id === stage.id);
      setNowPlayingText(idx >= 0 ? `` : "");
    },
    [
      stages,
      setGrid,
      setCellElements,
      setPairs,
      setReachFlag,
      setIsDrawing,
      setCurrentColor,
      setCurrentPath,
      setLastCell,
      setInformation,
      setNowPlayingText,
    ]
  ); // Added setPairs dependency if used

  const getCellFromXY = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      if (!gameContainerRef.current || !currentStageRef.current) return null;
      const rect = gameContainerRef.current.getBoundingClientRect();
      const { width: W, height: H } = currentStageRef.current;
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;
      // Ensure division by zero doesn't happen if width/height is 0
      if (W === 0 || H === 0) return null;
      const cx = Math.floor(offsetX / (rect.width / W));
      const cy = Math.floor(offsetY / (rect.height / H));
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) return null;
      return [cy, cx];
    },
    []
  ); // Depends on currentStageRef

  const updateCellState = (
    y: number,
    x: number,
    newState: CellData["state"],
    newColor: number | null
  ) => {
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.slice()); // Deep copy
      if (newGrid[y] && newGrid[y][x]) {
        newGrid[y][x] = { state: newState, color: newColor };
      }
      gridRef.current = newGrid; // Update ref immediately
      return newGrid;
    });
  };

  const startDraw = useCallback(
    (cell: [number, number]) => {
      const [cy, cx] = cell;
      const currentGrid = gridRef.current; // Use ref for immediate access
      const c = currentGrid[cy]?.[cx];
      if (!c) return;

      const col = c.color;
      const currentReachFlag = reachFlagRef.current; // Use ref

      if (c.state === "initial" && col !== null && !currentReachFlag[col]) {
        setIsDrawing(true);
        setCurrentColor(col);
        currentColorRef.current = col; // Update ref
        const newPath = [[cy, cx]];
        setCurrentPath(newPath);
        currentPathRef.current = newPath; // Update ref
        setLastCell([cy, cx]);
        lastCellRef.current = [cy, cx]; // Update ref
      }
    },
    [setIsDrawing, setCurrentColor, setCurrentPath, setLastCell]
  ); // Dependencies: setIsDrawing, setCurrentColor, setCurrentPath, setLastCell

  const fillCell = useCallback(
    (y: number, x: number) => {
      const currentGrid = gridRef.current; // Use ref
      const c = currentGrid[y]?.[x];
      const currentDrawingColor = currentColorRef.current; // Use ref

      if (c && c.state === "empty" && currentDrawingColor !== null) {
        playAudio("fill");
        updateCellState(y, x, "filled", currentDrawingColor); // Update state via function
        const newPath = [...currentPathRef.current, [y, x]];
        setCurrentPath(newPath);
        currentPathRef.current = newPath; // Update ref
      }
    },
    [playAudio, updateCellState, setCurrentPath]
  ); // Dependencies: playAudio, updateCellState

  const moveDraw = useCallback(
    (cell: [number, number]) => {
      if (!isDrawingRef.current) return; // Use ref
      const [cy, cx] = cell;
      const currentLastCell = lastCellRef.current; // Use ref
      if (!currentLastCell) return;

      const [ly, lx] = currentLastCell;
      if (cy === ly && cx === lx) return;

      const dx = cx - lx;
      const dy = cy - ly;

      if (Math.abs(dx) + Math.abs(dy) === 1) {
        // Adjacent move
        const currentGrid = gridRef.current; // Use ref
        const c = currentGrid[cy]?.[cx];
        if (!c) return;

        if (c.state === "empty") {
          fillCell(cy, cx);
          setLastCell([cy, cx]);
          lastCellRef.current = [cy, cx]; // Update ref
        } else {
          // Check if moving back
          const path = currentPathRef.current; // Use ref
          const prev = path[path.length - 2];
          if (prev && prev[0] === cy && prev[1] === cx) {
            const pathCopy = [...path];
            const removedCell = pathCopy.pop();
            if (removedCell) {
              const [ry, rx] = removedCell;
              updateCellState(ry, rx, "empty", null); // Update state via function
            }
            setCurrentPath(pathCopy);
            currentPathRef.current = pathCopy; // Update ref
            setLastCell(prev);
            lastCellRef.current = prev; // Update ref
          }
        }
      }
    },
    [fillCell, updateCellState, setLastCell, setCurrentPath]
  ); // Dependencies: fillCell, updateCellState, setLastCell

  const resetPath = useCallback(() => {
    const path = currentPathRef.current; // Use ref
    const currentGrid = gridRef.current; // Use ref
    let changed = false;
    const newGrid = currentGrid.map((row) => row.slice()); // Create mutable copy

    for (let i = 1; i < path.length; i++) {
      const [py, px] = path[i];
      if (newGrid[py]?.[px]?.state === "filled") {
        newGrid[py][px] = { state: "empty", color: null };
        changed = true;
      }
    }
    if (changed) {
      setGrid(newGrid); // Update state only if changes were made
      gridRef.current = newGrid; // Update ref
    }
  }, [setGrid]); // Dependency: setGrid

  const resetColor = useCallback(
    (lineColor: number) => {
      setInformation("");
      if (gameContainerRef.current) {
        gameContainerRef.current.classList.remove("clear");
      }
      const currentGrid = gridRef.current; // Use ref
      let removeFlag = false;
      const newGrid = currentGrid.map((row) => row.slice()); // Create mutable copy

      for (let y = 0; y < newGrid.length; y++) {
        for (let x = 0; x < newGrid[y].length; x++) {
          const c = newGrid[y][x];
          if (c.color === lineColor && c.state === "filled") {
            newGrid[y][x] = { state: "empty", color: null };
            removeFlag = true;
          }
        }
      }

      if (removeFlag) {
        playAudio("cancel");
        setGrid(newGrid); // Update state
        gridRef.current = newGrid; // Update ref
      }

      setReachFlag((prev) => {
        const newFlags = { ...prev, [lineColor]: false };
        reachFlagRef.current = newFlags; // Update ref
        return newFlags;
      });
    },
    [playAudio, setGrid, setReachFlag, setInformation]
  ); // Dependencies: playAudio, setGrid, setReachFlag, setInformation

  // --- Star Effect ---
  const updateStarCountDisplay = useCallback(
    (finalStars: number, plus = 1) => {
      let currentDisplay = currentStarsRef.current; // Use ref for starting value
      const interval = setInterval(() => {
        if (
          (plus >= 0 && currentDisplay < finalStars) ||
          (plus < 0 && currentDisplay > finalStars)
        ) {
          currentDisplay += plus;
          // Update state directly - DOM manipulation is less ideal in React
          setCurrentStars(currentDisplay);
          currentStarsRef.current = currentDisplay; // Keep ref in sync
        } else {
          // Ensure final value is exact
          setCurrentStars(finalStars);
          currentStarsRef.current = finalStars;
          clearInterval(interval);
        }
      }, 50); // Faster interval for smoother animation
    },
    [setCurrentStars]
  ); // Dependency: setCurrentStars

  // --- Flying Star Component ---
  interface FlyingStarProps extends FlyingStarData {
    onAnimationEnd: (id: string) => void;
  }

  const FlyingStar: React.FC<FlyingStarProps> = React.memo(
    ({ id, startY, startX, targetRect, gameRect, delay, onAnimationEnd }) => {
      const [animationState, setAnimationState] = useState<
        "idle" | "scaling" | "rotating" | "moving" | "done"
      >("idle");

      useEffect(() => {
        const scaleUpTimer = setTimeout(() => {
          setAnimationState("scaling");
        }, delay); // Apply initial delay

        const rotateTimer = setTimeout(() => {
          setAnimationState("rotating");
        }, delay + 500); // Scale duration

        const moveTimer = setTimeout(() => {
          setAnimationState("moving");
        }, delay + 500 + 500); // Scale + Rotate duration

        const removeTimer = setTimeout(() => {
          setAnimationState("done");
          onAnimationEnd(id);
        }, delay + 500 + 500 + 1000); // Scale + Rotate + Move duration

        return () => {
          clearTimeout(scaleUpTimer);
          clearTimeout(rotateTimer);
          clearTimeout(moveTimer);
          clearTimeout(removeTimer);
        };
      }, [id, onAnimationEnd, delay]); // Include delay in dependencies

      const style = useMemo(() => {
        const baseStyle: React.CSSProperties = {
          position: "absolute",
          left: `${startX}px`,
          top: `${startY}px`,
          transform: "translate(-50%, -50%) scale(0)",
          fontSize: "0",
          opacity: 0, // Start fully transparent
          zIndex: 1300,
          color: "#FFD700",
          transition: "transform 0.5s ease-in-out, opacity 0.5s ease-in-out", // Default transition
        };

        if (animationState === "scaling") {
          return {
            ...baseStyle,
            transform: "translate(-50%, -50%) scale(1.5)",
            fontSize: "16px",
            opacity: 1,
            transition:
              "transform 0.5s cubic-bezier(0.25, 1.5, 0.5, 1), opacity 0.1s linear", // Bounce scale, quick fade in
          };
        } else if (animationState === "rotating") {
          return {
            ...baseStyle,
            transform: "translate(-50%, -50%) scale(1.5) rotate(360deg)",
            fontSize: "16px",
            opacity: 1,
            transition: "transform 0.5s ease-in-out, opacity 0.1s linear", // Rotate transition
          };
        } else if (animationState === "moving" && targetRect && gameRect) {
          const targetX =
            targetRect.left - gameRect.left + targetRect.width / 2;
          const targetY = targetRect.top - gameRect.top + targetRect.height / 2;
          const moveX = targetX - startX;
          const moveY = targetY - startY;
          return {
            ...baseStyle,
            transform: `translate(${moveX}px, ${moveY}px) rotate(720deg) scale(0.5)`,
            fontSize: "16px",
            opacity: 0, // Fade out during move
            transition: "transform 1s ease-in-out, opacity 1s ease-in-out", // Move transition
          };
        }
        return baseStyle; // Idle or Done state
      }, [animationState, startX, startY, targetRect, gameRect]);

      if (animationState === "done") {
        return null; // Don't render if done
      }

      return (
        <FontAwesomeIcon
          icon={faStar}
          className="star-icon flying-star"
          style={style}
        />
      );
    }
  );
  FlyingStar.displayName = "FlyingStar"; // Add display name for debugging

  // --- Trigger Star Effect (React Way) ---
  const triggerStarEffect = useCallback(
    (targetCellsCoords: number[][]) => {
      const starDisplay = starDisplayRef.current; // Use ref for target
      const gameContainer = gameContainerRef.current;
      const currentCellElements = cellElementsRef.current; // Use ref for start positions
      console.table({ starDisplay });

      if (!starDisplay || !gameContainer || !currentCellElements) return;

      const targetRect = starDisplay.getBoundingClientRect();
      const gameRect = gameContainer.getBoundingClientRect();

      const newStars: FlyingStarData[] = targetCellsCoords
        .map(([y, x]) => {
          const cellElement = currentCellElements[y]?.[x];
          if (!cellElement) {
            console.warn(
              `Cell element at [${y}, ${x}] not found in ref array.`
            );
            return null; // Skip if cell element ref is missing
          }

          const cellRect = cellElement.getBoundingClientRect();
          const startX =
            cellRect.left - gameRect.left + cellElement.offsetWidth / 2 - 4;
          const startY =
            cellRect.top - gameRect.top + cellElement.offsetHeight / 2 - 5;

          return {
            id: `star-${y}-${x}-${Date.now()}-${Math.random()}`, // Unique ID
            startY,
            startX,
            targetRect,
            gameRect,
            delay: 100 + Math.random() * 200, // Stagger start times
          };
        })
        .filter(Boolean) as FlyingStarData[]; // Add type assertion

      setFlyingStars((prevStars) => [...prevStars, ...newStars]);
    },
    [] // Refs don't need to be dependencies
  );

  // --- Handle Animation End ---
  const handleAnimationEnd = useCallback((idToRemove: string) => {
    console.log(idToRemove);
    setFlyingStars(
      () => []
      // prevStars.filter((star) => star.id !== idToRemove)
    );
    // Note: Star count update is handled in checkClearCondition
  }, []);

  // --- Check Clear Condition ---
  const checkClearCondition = useCallback(() => {
    const currentReach = reachFlagRef.current; // Use ref
    const stage = currentStageRef.current; // Use ref
    const currentGrid = gridRef.current; // Use ref
    const currentProg = progressRef.current; // Use ref

    if (!stage) return;

    // Check if all pairs are connected
    const allConnected = Object.values(currentReach).every((flag) => flag);
    if (!allConnected) return;

    // Check if all non-blocked cells are filled
    const emptyCells: number[][] = [];
    let emptyCount = 0;
    // let filledCount = 0; // Removed as unused in the new logic
    const filledCellsCoords: number[][] = []; // Collect coords for effect (used for perfect clear effect target)

    currentGrid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.state === "empty") {
          emptyCount++;
          emptyCells.push([y, x]);
          // } else if (cell.state === "filled") { // filledCount removed
          // filledCount++;
          // filledCellsCoords.push([y, x]); // Add filled cell coords
        } else if (cell.state === "initial" || cell.state === "filled") {
          // Collect initial and filled for effect target
          filledCellsCoords.push([y, x]); // Also include initial cells for effect
        }
      });
    });

    // --- Clear Calculation (Based on index.html logic) ---
    const stageSize = stage.width * stage.height;
    const minPathLen = stage.minPathLen ?? 0; // Use 0 if undefined
    const numPairs = stage.pairs.length;
    const numObstacles = stage.obstacles.length;

    // Calculate the expected number of empty cells for a perfect clear (shortest path)
    const minCost = stageSize - (minPathLen + numPairs + numObstacles);

    const stageId = stage.id;
    const clearData = currentProg[stageId];
    let message = "ステージクリア！";
    let newClearFlag = clearData?.clearFlag || 0;
    let playSound: keyof SoundBuffers | null = null;
    let triggerEffect = false;
    let pointsEarned = 0; // Points are earned only on perfect clear based on emptyCount
    let newEmptyCountForSave = clearData?.emptyCount ?? 0; // Store the score (emptyCount for perfect)

    const isPerfectClear = minCost === emptyCount;

    if (isPerfectClear) {
      // Perfect Clear (Shortest path)
      pointsEarned = emptyCount; // Points are the number of remaining empty cells
      message += `\n${pointsEarned}ポイントゲット！`;
      playSound = "success";
      triggerEffect = true; // Trigger effect for perfect clear

      if (newClearFlag < 3) {
        // Grant points/update flag only if improving or first perfect clear
        newClearFlag = 3;
        newEmptyCountForSave = pointsEarned; // Save the score for perfect
        // Update stars state only when flag improves to 3
        const starsToAdd = pointsEarned;
        const finalStars = currentStarsRef.current + starsToAdd;
        updateStarCountDisplay(finalStars, 1); // Animate display
      } else {
        // Already perfect, no points/star update needed, just show message
      }
    } else {
      // Normal Clear (Not the shortest path)
      playSound = "clear";
      if (newClearFlag < 3) {
        // If not already perfectly cleared, suggest improvement
        message += "\nでも、もっと良い解き方があるよ";
      }
      if (newClearFlag < 1) {
        // Update flag to 'cleared' if it wasn't cleared before
        newClearFlag = 1;
        // For normal clear, we don't save a score based on emptyCount
        // Keep the previously saved score (or 0 if none)
        newEmptyCountForSave = clearData?.emptyCount ?? 0;
      }
    }

    // Save progress only if the clear state improved
    if (newClearFlag > (clearData?.clearFlag || 0)) {
      const result: ProgressData[string] = {
        emptyCount: newEmptyCountForSave, // Save the relevant score (points for perfect, 0/previous for normal)
        clearFlag: newClearFlag,
        timestamp: new Date().toISOString(),
        hintFlag: clearData?.hintFlag ?? 0, // Preserve hint flag
      };
      saveStageProgress(stageId, result);
    }

    if (playSound) playAudio(playSound);
    // Trigger effect with empty cells coordinates on perfect clear
    if (triggerEffect && isPerfectClear && effectState.current === "none") {
      effectState.current = "show";
      triggerStarEffect(emptyCells);
    }

    if (gameContainerRef.current) {
      gameContainerRef.current.classList.add("clear");
    }
    setInformation(message);
  }, [
    saveStageProgress,
    playAudio,
    triggerStarEffect,
    setInformation,
    updateStarCountDisplay,
  ]); // Dependencies

  const endDraw = useCallback(
    (isTouchEvent: boolean, clientX?: number, clientY?: number) => {
      const wasDrawing = isDrawingRef.current; // Use ref
      setIsDrawing(false); // Always stop drawing state on mouse/touch up

      if (!wasDrawing) {
        // Handle tap/click to reset color
        if (clientX !== undefined && clientY !== undefined) {
          const cell = getCellFromXY(clientX, clientY);
          if (cell) {
            const [cy, cx] = cell;
            const currentGrid = gridRef.current; // Use ref
            const c = currentGrid[cy]?.[cx];
            if (
              c &&
              (c.state === "filled" || c.state === "initial") &&
              c.color !== null
            ) {
              resetColor(c.color);
            }
          }
        }
        return;
      }

      // Logic for finishing a drawing path
      const col = currentColorRef.current;
      const path = currentPathRef.current; // Use ref
      const stage = currentStageRef.current; // Use ref
      const pairsData = pairs; // Use state

      if (col === null || path.length < 1 || !stage) {
        // Path length can be 1 if only start cell clicked
        resetPath(); // Reset if path is invalid
        setCurrentPath([]);
        currentPathRef.current = [];
        setLastCell(null);
        lastCellRef.current = null;
        setCurrentColor(null);
        currentColorRef.current = null;
        return;
      }

      const endPos = path[path.length - 1];
      const startPos = path[0];
      const pair = pairsData.find((p) => p.color === col);

      const adjacent = (a: number[], b: number[]) =>
        Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

      let success = false;
      if (pair) {
        const posA = pair.positions[0];
        const posB = pair.positions[1];
        // Check if the drawn path ends adjacent to the *other* initial cell of the pair
        // Also handle the case where the path is just the start cell (length 1) and it's adjacent to the end cell
        if (path.length === 1) {
          if (
            (startPos[0] === posA[0] &&
              startPos[1] === posA[1] &&
              adjacent(startPos, posB)) ||
            (startPos[0] === posB[0] &&
              startPos[1] === posB[1] &&
              adjacent(startPos, posA))
          ) {
            // This case shouldn't mark as success, it's just a click on start adjacent to end.
            // Let's reset instead.
            success = false;
          }
        } else if (path.length > 1) {
          if (
            (startPos[0] === posA[0] &&
              startPos[1] === posA[1] &&
              adjacent(endPos, posB)) ||
            (startPos[0] === posB[0] &&
              startPos[1] === posB[1] &&
              adjacent(endPos, posA))
          ) {
            success = true;
          }
        }
      }

      if (success) {
        setReachFlag((prev) => {
          const newFlags = { ...prev, [col]: true };
          reachFlagRef.current = newFlags; // Update ref
          // Check clear condition only after state update completes
          // Using setTimeout to ensure state update is processed before check
          setTimeout(() => checkClearCondition(), 0);
          return newFlags;
        });
      } else {
        resetPath();
      }

      // Reset drawing state variables regardless of success/failure
      setCurrentPath([]);
      currentPathRef.current = [];
      setLastCell(null);
      lastCellRef.current = null;
      setCurrentColor(null);
      currentColorRef.current = null;
    },
    [
      getCellFromXY,
      resetColor,
      resetPath,
      checkClearCondition,
      setReachFlag,
      pairs,
      setCurrentPath,
      setLastCell,
      setCurrentColor,
      setIsDrawing,
    ]
  ); // Dependencies

  // --- Event Handlers ---
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const cell = getCellFromXY(t.clientX, t.clientY);
        if (cell) {
          startDraw(cell);
          // Prevent default only if drawing actually starts to avoid passive listener issue
          // Check the ref *after* startDraw potentially sets it to true
          if (isDrawingRef.current) {
            e.preventDefault();
          }
        }
      }
    },
    [getCellFromXY, startDraw] // isDrawingRef is intentionally omitted as it's a ref
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (isDrawingRef.current && e.touches.length > 0) {
        // Check isDrawingRef
        const t = e.touches[0];
        const cell = getCellFromXY(t.clientX, t.clientY);
        if (cell) {
          // Prevent default *before* moveDraw to ensure it's cancellable
          e.preventDefault(); // Prevent scrolling while drawing
          moveDraw(cell);
        }
      }
    },
    [getCellFromXY, moveDraw]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const changedTouch = e.changedTouches[0];
      endDraw(true, changedTouch?.clientX, changedTouch?.clientY);
    },
    [endDraw]
  );

  // Wrap move and up handlers for adding/removing listeners
  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      const cell = getCellFromXY(e.clientX, e.clientY);
      if (cell) {
        // Only call moveDraw if over a valid cell
        moveDraw(cell);
      }
      // Allow moving outside the grid, just don't call moveDraw
    },
    [getCellFromXY, moveDraw]
  );

  const handleGlobalMouseUp = useCallback(
    (e: MouseEvent) => {
      endDraw(false, e.clientX, e.clientY);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    },
    [endDraw, handleGlobalMouseMove]
  ); // Include handleGlobalMouseMove in dependencies

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const cell = getCellFromXY(e.clientX, e.clientY);
      if (cell) {
        e.preventDefault();
        startDraw(cell);
        // Set up global listeners only if starting draw from a valid cell
        document.addEventListener("mousemove", handleGlobalMouseMove);
        document.addEventListener("mouseup", handleGlobalMouseUp);
      }
      // If not starting on a cell, don't add global listeners yet.
      // A separate global listener might be needed for tap-reset if mousedown outside grid.
    },
    [getCellFromXY, startDraw, handleGlobalMouseMove, handleGlobalMouseUp]
  );

  // const handleCoolButtonMouseMove = (
  //   e: React.MouseEvent<HTMLAnchorElement>
  // ) => {
  //   const btn = coolButtonRef.current;
  //   if (btn) {
  //     const rect = btn.getBoundingClientRect();
  //     const x = e.clientX - rect.left;
  //     const y = e.clientY - rect.top; // Use clientY relative to viewport
  //     btn.style.setProperty("--x", x + "px");
  //     btn.style.setProperty("--y", y + "px");
  //   }
  // };

  const handleOpenModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    // イベント型をButton用に変更
    e.preventDefault();
    setIsModalOpen(true);
    playAudio("modal");
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    playAudio("cancel");
  };

  const handleStageSelect = (stageIndex: number) => {
    if (stages[stageIndex]) {
      initGame(stages[stageIndex]);
      setIsModalOpen(false);
      playAudio("decision");
    }
  };

  const handleForceClicker = () => {
    unlockAudio();
    // State update in unlockAudio handles hiding this
  };

  // --- Hint Logic ---
  const isBoughtHistory = useCallback(
    (stageId: string | undefined): boolean => {
      if (!stageId) return false;
      const currentProgress = progressRef.current; // Use ref
      return currentProgress[stageId]?.hintFlag === 1;
    },
    []
  );

  const setBuyHistory = useCallback(
    (stageId: string | undefined) => {
      if (!stageId) return;
      const currentProgress = progressRef.current; // Use ref
      const stageResult = currentProgress[stageId] || {
        emptyCount: 0,
        clearFlag: 0,
        timestamp: new Date().toISOString(),
      };
      stageResult.hintFlag = 1;
      saveStageProgress(stageId, stageResult);
      // getProgress(); // Refresh progress state - saveStageProgress updates state
    },
    [saveStageProgress]
  );

  const discountStars = useCallback(
    (amount: number) => {
      const newStars = Math.max(0, currentStarsRef.current - amount);
      updateStarCountDisplay(newStars, -1); // Animate display
    },
    [updateStarCountDisplay]
  );

  const displayHint = useCallback(
    (delay = 0) => {
      const stage = currentStageRef.current; // Use ref
      const pairsData = pairs; // Use state
      if (!stage || !stage.minPath || stage.minPath.length === 0 || !pairsData)
        return;

      // Find the shortest path hint
      const item = stage.minPath.sort(
        (a, b) => a.path.length - b.path.length
      )[0];
      if (!item) return;

      const hintColor = item.color;
      const { width: W } = stage;

      // Temporarily set drawing state for fillCell
      currentColorRef.current = hintColor; // Set ref directly

      item.path.forEach((v, idx) => {
        console.log(v);
        // v is 1-based index from top-left (1, 2, ..., W*H)
        const zeroBasedIndex = v - 1;
        const y = Math.floor(zeroBasedIndex / W); // Correct: Calculate Y first
        const x = zeroBasedIndex % W; // Correct: Calculate X second

        // Skip the start/end points as they are 'initial'
        const pairInfo = pairsData.find((p) => p.color === hintColor);
        const startPos = pairInfo?.positions[0]; // [y, x]
        const endPos = pairInfo?.positions[1]; // [y, x]

        const isStartOrEnd = // Check if the calculated [y, x] matches start or end
          (startPos && y === startPos[1] && x === startPos[0]) || // Compare y with y, x with x
          (endPos && y === endPos[1] && x === endPos[0]);

        if (isStartOrEnd) {
          return; // Skip initial cells
        }

        setTimeout(() => {
          // Match original HTML's apparent (x, y) order for fillCell in hints
          fillCell(x, y);
        }, delay + 200 * idx);
      });

      // After timeout, mark the color as 'reached' and reset drawing state
      setTimeout(() => {
        setReachFlag((prev) => {
          const newFlags = { ...prev, [hintColor]: true };
          reachFlagRef.current = newFlags; // Update ref
          // Check clear condition only after state update completes
          setTimeout(() => checkClearCondition(), 0);
          return newFlags;
        });
        currentColorRef.current = null; // Reset ref
        setCurrentPath([]); // Reset state
        currentPathRef.current = []; // Reset ref
      }, delay + 200 * item.path.length + 100); // Ensure it runs after all fills
    },
    [
      resetColor,
      fillCell,
      setReachFlag,
      checkClearCondition,
      pairs,
      setCurrentPath,
    ]
  ); // Dependencies

  const buyHint = () => {
    unlockAudio(); // Ensure audio context is active
    const stage = currentStageRef.current; // Use ref
    if (!stage || !stage.id || stage.number === undefined) return;

    // Reset colors before potentially showing hint
    if (pairs) {
      for (let c = 0; c < pairs.length; c++) {
        resetColor(pairs[c].color); // Use color property from pairsData
      }
    }

    const stageId = stage.id;
    // const clearData = progressRef.current[stageId]; // Use ref - Removed as unused

    // Removed check to allow buying hints even after clearing
    // if (clearData && Number(clearData.clearFlag) === 3) {
    //   setInformation("クリア済みなので購入できません。");
    //   return;
    // }

    if (isBoughtHistory(stageId)) {
      displayHint();
      // No need to set history again if already bought
      return;
    }

    const hintCost = stage.number;
    if (currentStarsRef.current >= hintCost) {
      // --- Confirmation Modal Logic ---
      // 最終確認後に実行するアクションを定義
      const actionToConfirm = () => {
        displayHint(1200); // 遅延表示
        discountStars(hintCost);
        setBuyHistory(stageId);
        // メッセージ表示は handleConfirm 内で行う
      };

      // モーダルを開くための state を設定
      setConfirmMessage(`${hintCost}スターでヒントを購入しますか？`);
      setConfirmAction(() => actionToConfirm); // 関数を state に設定
      setConfirmStep(0); // ステップをリセット
      setIsConfirmModalOpen(true); // モーダルを開く
      playAudio("modal"); // モーダル表示音
    } else {
      setInformation("ヒントを買うにはスターが足りません", true);
    }
  };

  // --- Confirmation Modal Handlers ---
  const handleConfirm = () => {
    playAudio("decision"); // 確認音
    const nextStep = confirmStep + 1;
    // const stage = currentStageRef.current;
    // const hintCost = stage?.number ?? 0; // Nullish coalescing for safety

    if (nextStep === 1) {
      setConfirmMessage("本当にいいんですか？");
      setConfirmStep(nextStep);
    } else if (nextStep === 2) {
      setConfirmMessage("もったいないですよ？");
      setConfirmStep(nextStep);
    } else if (nextStep === 3 && confirmAction) {
      confirmAction(); // 最終確認後にアクション実行
      setIsConfirmModalOpen(false);
      setConfirmStep(0);
      setConfirmAction(null);
      setTimeout(() => {
        setInformation("いいお買い物をしましたね");
      }, 500); // 元のコードのメッセージ表示タイミングに合わせる
    }
  };

  const handleCloseConfirm = () => {
    playAudio("cancel"); // キャンセル音
    if (confirmStep === 0) {
      setInformation("節約！");
    } else if (confirmStep === 1) {
      setInformation("我慢！");
    } else if (confirmStep === 2) {
      setInformation("賢明！");
    }
    setIsConfirmModalOpen(false);
    setConfirmStep(0);
    setConfirmAction(null);
  };

  // --- useEffect Hooks ---

  // Initialize Audio Context and Load Sounds
  useEffect(() => {
    const initAudio = async () => {
      if (!audioContextRef.current) {
        // ExtendedWindow 型を使用
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioContextRef.current = new AudioContext();
          // Initial state might be suspended, unlock on first interaction
        } else {
          console.error("Web Audio API is not supported.");
          return;
        }
      }

      // Load sounds
      const soundFiles = Object.keys(soundsRef.current) as Array<
        keyof SoundBuffers
      >;
      try {
        const loadedSounds = await Promise.all(
          soundFiles.map((name) => loadAudio(name))
        );
        const newSounds: Partial<SoundBuffers> = {};
        soundFiles.forEach((name, index) => {
          newSounds[name] = loadedSounds[index];
        });
        // Assign loaded sounds directly to the ref
        soundFiles.forEach((name, index) => {
          soundsRef.current[name] = loadedSounds[index];
        });
        console.log("Audio loaded successfully");
      } catch (error) {
        console.error("Error loading audio:", error);
      }
    };
    initAudio();

    // Cleanup function to close AudioContext if needed, though usually not necessary
    // return () => {
    //   audioContextRef.current?.close();
    // };
  }, [loadAudio]); // Run once on mount

  // Fetch Stages Data
  useEffect(() => {
    fetch("/test2.json") // Fetch from public folder
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.problems) {
          setStages(data.problems);
          // Initialize with the first stage after data is loaded
          // Also load progress here, *after* stages are set
          const loadedProgress = loadStageProgress();
          setProgress(loadedProgress);
          progressRef.current = loadedProgress; // Update ref

          // Calculate initial stars based on loaded progress and stages
          let initialStars = 0;
          Object.keys(loadedProgress).forEach((pId) => {
            const stageData = data.problems.find((s: Stage) => s.id === pId);
            if (stageData && loadedProgress[pId]) {
              // Add score (emptyCount) if cleared perfectly (flag 3)
              if (loadedProgress[pId].clearFlag === 3) {
                initialStars += loadedProgress[pId].emptyCount || 0; // Assuming emptyCount stores score on perfect
              }
              // Subtract hint cost if bought
              if (
                Number(loadedProgress[pId].hintFlag) === 1 &&
                stageData.number !== undefined
              ) {
                initialStars -= stageData.number;
              }
            }
          });
          initialStars += 10; // Add initial bonus
          setCurrentStars(Math.max(0, initialStars));
          currentStarsRef.current = Math.max(0, initialStars);

          // Now initialize the first game
          if (data.problems.length > 0) {
            initGame(data.problems[0]);
          } else {
            console.error("No stages found in problems data.");
          }
        } else {
          console.error(
            "Failed to load or parse stage data: problems array missing."
          );
        }
      })
      .catch((error) => console.error("Error fetching stages:", error));
  }, [loadStageProgress]); // initGame dependency removed

  // Update stage buttons when progress changes (e.g., add checkmarks)
  useEffect(() => {
    // This logic needs to be integrated into the JSX rendering of stage buttons
    // instead of direct DOM manipulation like in the original initStageButtons/getProgress
    console.log("Progress updated, re-render stage buttons if modal is open.");
  }, [progress, stages]);

  // --- Render ---
  return (
    // Add a wrapper div for better layout control if needed
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
      }}
    >
      {/* Header */}
      <div className="puzzle-header">
        {/* ポイント表示 */}
        <div
          className="puzzle-header-item puzzle-header-stars"
          ref={starDisplayRef}
        >
          <FontAwesomeIcon icon={faStar} className="star-icon" />
          <span className="star-count">{currentStars}</span>
        </div>
        {/* 現在のステージ */}
        <div className="puzzle-header-item puzzle-header-stage-name">
          {nowPlayingText}
        </div>
        {/* ヒント購入ボタン */}
        <button
          className="puzzle-header-item puzzle-hint-button"
          onClick={buyHint}
        >
          ヒント購入
        </button>
        {/* ステージ選択ボタン */}
        <button
          className="puzzle-header-item puzzle-header-button"
          ref={coolButtonRef} // refは残す (cool-buttonのJS用だが、他で使わないなら削除可)
          onClick={handleOpenModal}
          // onMouseMove={handleCoolButtonMouseMove} // cool-button用なので削除
        >
          ステージ選択
        </button>
      </div>

      {/* Hint Button (Moved to header) */}

      {/* Information Area */}
      <div id="information">
        <p style={{ whiteSpace: "pre-wrap" }}>{informationText}</p>{" "}
        {/* Use pre-wrap for newlines */}
      </div>

      {/* Game Container */}
      <div
        id="game-container"
        ref={gameContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown} // Use onMouseDown, global listeners handle move/up
        // className attribute intentionally left empty for now, clear class handled via ref elsewhere
      >
        {/* Render Grid */}
        {grid.map((row, y) => (
          <div className="row" key={`row-${y}`}>
            {row.map((cellData, x) => {
              // Define setCellRef function correctly within the map callback
              const setCellRef = (el: HTMLDivElement | null) => {
                // Ensure cellElementsRef.current exists
                if (!cellElementsRef.current) return;

                // Ensure the row exists, initialize if not
                if (!cellElementsRef.current[y]) {
                  // Initialize the row with nulls based on grid width
                  cellElementsRef.current[y] = Array(grid[0]?.length || 0).fill(
                    null
                  );
                }
                // Assign the element (or null) to the correct position
                cellElementsRef.current[y][x] = el;
              };

              return (
                <div
                  ref={setCellRef} // Use the function in the ref prop
                  className={renderCell(grid, y, x)}
                  key={`${y}-${x}`}
                  data-y={y}
                  data-x={x}
                />
              );
            })}
          </div>
        ))}
        {/* Render Flying Stars */}
        {flyingStars.map((star) => (
          <FlyingStar
            key={star.id}
            {...star}
            onAnimationEnd={handleAnimationEnd}
          />
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          id="modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div id="modal-overlay">
            <button
              id="close-modal"
              className="close-button"
              onClick={handleCloseModal}
            >
              ×
            </button>
            <div id="modal-content">
              <div id="stage-container">
                {stages.map((stage, index) => {
                  const stageProgress = progress[stage.id];
                  const isPerfect = stageProgress?.clearFlag === 3;
                  const hue = (index * (360 / stages.length)) % 360;
                  return (
                    <button
                      key={stage.id || index}
                      onClick={() => handleStageSelect(index)}
                      style={{
                        backgroundColor: `hsl(${hue}, 70%, 50%)`,
                        color: "#fff",
                      }}
                    >
                      Stage {index + 1} {isPerfect ? "✅" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Force Clicker (for audio unlock) */}
      {!isAudioUnlocked && (
        <div id="force-clicker" onClick={handleForceClicker}>
          <p>Touch to start.</p>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        message={confirmMessage}
        onConfirm={handleConfirm}
        onClose={handleCloseConfirm}
      />
    </div>
  );
};

export default PuzzleGameScreen;
