import React, { useState, useEffect, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRedo,
  faLightbulb,
  faVolumeUp,
  faVolumeMute,
} from "@fortawesome/free-solid-svg-icons";

interface SlidingPuzzleScreenProps {
  onReturnHome: () => void;
}

interface GameState {
  pieces: { [key: number]: [number, number] };
  moves: number;
  isCompleted: boolean;
}

interface SolutionStep {
  piece: number;
  direction: string;
  from: [number, number];
  to: [number, number];
  move: number;
}

interface Stage {
  id: number;
  name: string;
  maze: MazeCell[][];
  startPositions: { [key: number]: [number, number] };
  goalPositions: { [key: number]: [number, number] };
  description: string;
  solutionPath?: SolutionStep[];
  verified?: boolean;
}

interface MazeCell {
  isWall: boolean;
  isPath: boolean;
}

const SlidingPuzzleScreen: React.FC<SlidingPuzzleScreenProps> = () => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    pieces: {},
    moves: 0,
    isCompleted: false,
  });
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [gameHistory, setGameHistory] = useState<GameState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [showSolution, setShowSolution] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showStageSelect, setShowStageSelect] = useState(false);
  const [hintStep, setHintStep] = useState(0);
  const [isPlayingHint, setIsPlayingHint] = useState(false);
  const [isHintPaused, setIsHintPaused] = useState(false);
  // const [isAnimating, setIsAnimating] = useState(false); // 現在未使用
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [draggedPiece, setDraggedPiece] = useState<number | null>(null);
  const [animatingPieces, setAnimatingPieces] = useState<{
    [key: number]: {
      from: [number, number];
      to: [number, number];
      progress: number;
    };
  }>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [clearedStages, setClearedStages] = useState<Set<number>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pieceImagesRef = useRef<{ [key: number]: HTMLImageElement }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const MAZE_SIZE = 11;
  const CELL_SIZE = 40;
  const CLEARED_STAGES_KEY = "sliding_puzzle_cleared_stages2";

  // ステージの位置データを適切な型に変換するヘルパー関数
  const convertPositions = (positions: {
    [key: string]: [number, number] | number[];
  }): { [key: number]: [number, number] } => {
    return Object.fromEntries(
      Object.entries(positions).map(([key, pos]) => [
        parseInt(key),
        Array.isArray(pos) ? ([pos[0], pos[1]] as [number, number]) : pos,
      ])
    ) as { [key: number]: [number, number] };
  };

  // LocalStorageからクリア済みステージを読み込む
  const loadClearedStages = useCallback((): Set<number> => {
    if (typeof window === "undefined") return new Set(); // SSR対応

    try {
      const saved = localStorage.getItem(CLEARED_STAGES_KEY);
      if (saved) {
        const stageArray = JSON.parse(saved) as number[];
        return new Set(stageArray);
      }
    } catch (error) {
      console.error("Failed to load cleared stages from localStorage:", error);
    }
    return new Set(); // デフォルトではクリア済みステージなし
  }, []);

  // LocalStorageにクリア済みステージを保存する
  const saveClearedStages = useCallback((stages: Set<number>) => {
    if (typeof window === "undefined") return;

    try {
      const stageArray = Array.from(stages);
      localStorage.setItem(CLEARED_STAGES_KEY, JSON.stringify(stageArray));
    } catch (error) {
      console.error("Failed to save cleared stages to localStorage:", error);
    }
  }, []);

  // 音声ファイルの初期化
  useEffect(() => {
    const soundFiles = {
      slide: "/sounds/slide.mp3",
      modal: "/sounds/modal.mp3",
      fill: "/sounds/fill.mp3",
      decision: "/sounds/decision.mp3",
      correct: "/sounds/correct.mp3",
    };

    Object.entries(soundFiles).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.volume = 0.3;
      audio.preload = "auto";
      audioRefs.current[key] = audio;
    });
  }, []);

  // クリア済みステージの初期化
  useEffect(() => {
    setClearedStages(loadClearedStages());
  }, [loadClearedStages]);

  // 画像読み込み
  useEffect(() => {
    const imageFiles = [
      "/images/sun.png",
      "/images/earth.png",
      "/images/moon.png",
    ];

    let loadedCount = 0;
    const totalImages = imageFiles.length;

    imageFiles.forEach((src, index) => {
      const img = new Image();
      img.onload = () => {
        pieceImagesRef.current[index + 1] = img;
        loadedCount++;
        if (loadedCount === totalImages) {
          setImagesLoaded(true);
        }
      };
      img.src = src;
    });
  }, []);

  // ステージデータをロード
  useEffect(() => {
    const loadStages = async () => {
      try {
        const response = await fetch("/sliding_puzzle_stages.json");
        if (!response.ok) throw new Error("Failed to load stages");
        const data = await response.json();
        setStages(data);
        if (data.length > 0) {
          const firstStage = data[0];
          setCurrentStage(firstStage);
          const initialState = {
            pieces: convertPositions(firstStage.startPositions),
            moves: 0,
            isCompleted: false,
          };
          setGameState(initialState);
          // 初期状態を履歴に追加
          setGameHistory([initialState]);
          setCurrentHistoryIndex(0);
        }
      } catch (error) {
        console.error("Error loading stages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStages();
  }, []);

  // 音声再生関数
  const playSound = useCallback(
    (soundKey: string) => {
      if (!soundEnabled) return;

      const audio = audioRefs.current[soundKey];
      if (audio) {
        try {
          audio.currentTime = 0; // 音声を最初から再生
          audio.play().catch((e) => {
            // ブラウザが音声再生を制限している場合のエラーを無視
            console.log("Audio play prevented:", e);
          });
        } catch (error) {
          console.log("Audio play error:", error);
        }
      }
    },
    [soundEnabled]
  );

  // スライド音停止関数
  const stopSlideSound = useCallback(() => {
    const audio = audioRefs.current["slide"];
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (error) {
        console.log("Audio stop error:", error);
      }
    }
  }, []);

  // 勝利条件チェック
  const checkWinCondition = useCallback(
    (newPieces?: { [key: number]: [number, number] }) => {
      if (!currentStage) return;

      const piecesToCheck = newPieces || gameState.pieces;

      const isWin = Object.entries(currentStage.goalPositions).every(
        ([pieceId, [goalX, goalY]]) => {
          const id = parseInt(pieceId);
          const [currentX, currentY] = piecesToCheck[id];
          return currentX === goalX && currentY === goalY;
        }
      );

      if (isWin) {
        setGameState((prev) => ({ ...prev, isCompleted: true }));
        // ステージクリア時にクリア済みステージに追加
        if (currentStage?.id) {
          setClearedStages((prev) => {
            const newClearedStages = new Set(prev);
            // 現在のステージをクリア済みに追加
            newClearedStages.add(currentStage.id);
            // 次のステージをプレイ可能にする（クリア済みではなくアンロック）
            if (currentStage.id < 64) {
              // 次のステージのIDをアンロックするだけ（クリア済みにはしない）
              // 実際にはstage selection UIで次のステージがプレイ可能かチェックする
            }
            // LocalStorageに保存
            saveClearedStages(newClearedStages);
            return newClearedStages;
          });
        }
        // ステージクリア音を再生
        playSound("correct");
      }
    },
    [currentStage, gameState.pieces, playSound, saveClearedStages]
  );

  // EaseOut関数
  const easeOut = (t: number): number => {
    return 1 - Math.pow(1 - t, 4); // より強いEaseOut効果
  };

  // 履歴にゲーム状態を追加
  const addToHistory = useCallback(
    (newState: GameState) => {
      setGameHistory((prev) => {
        const newHistory = prev.slice(0, currentHistoryIndex + 1);
        newHistory.push(newState);
        return newHistory;
      });
      setCurrentHistoryIndex((prev) => prev + 1);
    },
    [currentHistoryIndex]
  );

  // 一手戻る
  const stepBackward = useCallback(() => {
    if (currentHistoryIndex > 0) {
      playSound("decision");
      const prevState = gameHistory[currentHistoryIndex - 1];
      setGameState(prevState);
      setCurrentHistoryIndex((prev) => prev - 1);
      setSelectedPiece(null);
    }
  }, [currentHistoryIndex, gameHistory, playSound]);

  // 一手進める
  const stepForward = useCallback(() => {
    if (currentHistoryIndex < gameHistory.length - 1) {
      playSound("decision");
      const nextState = gameHistory[currentHistoryIndex + 1];
      setGameState(nextState);
      setCurrentHistoryIndex((prev) => prev + 1);
      setSelectedPiece(null);
    }
  }, [currentHistoryIndex, gameHistory, playSound]);

  // 駒の移動処理
  const movePiece = useCallback(
    (pieceId: number, direction: "up" | "down" | "left" | "right") => {
      if (!currentStage) return; // アニメーション中でも操作可能にする

      const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
      const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;

      const [currentX, currentY] = gameState.pieces[pieceId];
      let newX = currentX;
      let newY = currentY;

      // 氷上を滑るように移動（障害物まで）
      while (true) {
        const nextX = newX + dx;
        const nextY = newY + dy;

        // 境界チェック
        if (
          nextX < 0 ||
          nextX >= MAZE_SIZE ||
          nextY < 0 ||
          nextY >= MAZE_SIZE
        ) {
          break;
        }

        // 壁チェック
        if (currentStage.maze[nextY][nextX].isWall) {
          break;
        }

        // 他の駒との衝突チェック
        const hasCollision = Object.entries(gameState.pieces).some(
          ([id, [x, y]]) => {
            return parseInt(id) !== pieceId && x === nextX && y === nextY;
          }
        );

        if (hasCollision) {
          break;
        }

        newX = nextX;
        newY = nextY;
      }

      // 位置が変わった場合のみ移動
      if (newX !== currentX || newY !== currentY) {
        // setIsAnimating(true); // 現在未使用
        // スライド音を再生
        playSound("slide");

        // アニメーション設定
        setAnimatingPieces({
          [pieceId]: {
            from: [currentX, currentY],
            to: [newX, newY],
            progress: 0,
          },
        });

        // アニメーション実行
        const startTime = Date.now();
        // 移動距離に応じてアニメーション時間を計算
        const distance = Math.abs(newX - currentX) + Math.abs(newY - currentY);
        const baseTime = 80; // 1マスあたりの基本時間（ms）
        const animationDuration = Math.max(baseTime * distance, 120); // 最小120ms

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / animationDuration, 1);
          const easedProgress = easeOut(progress);

          setAnimatingPieces(() => ({
            [pieceId]: {
              from: [currentX, currentY],
              to: [newX, newY],
              progress: easedProgress,
            },
          }));

          if (progress >= 1) {
            // アニメーション完了
            setAnimatingPieces({});
            // setIsAnimating(false); // 現在未使用

            // スライド音を停止
            stopSlideSound();

            const updatedPieces: { [key: number]: [number, number] } = {
              ...gameState.pieces,
              [pieceId]: [newX, newY] as [number, number],
            };

            setGameState((prev) => ({
              ...prev,
              pieces: updatedPieces,
              moves: prev.moves + 1,
            }));

            // 操作終了音を再生
            playSound("fill");

            // 履歴に追加
            const newState: GameState = {
              pieces: updatedPieces,
              moves: gameState.moves + 1,
              isCompleted: false,
            };
            addToHistory(newState);

            // 勝利条件チェック（新しい位置で）
            setTimeout(() => {
              checkWinCondition(updatedPieces);
            }, 100);
          } else {
            animationRef.current = requestAnimationFrame(animate);
          }
        };

        // 既存のアニメーションをキャンセル
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          // 前のスライド音があれば停止
          stopSlideSound();
        }

        animationRef.current = requestAnimationFrame(animate);
      }

      setSelectedPiece(null);
    },
    [currentStage, gameState, checkWinCondition, playSound, stopSlideSound]
  );

  // マウス操作処理
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!currentStage) return; // アニメーション中でも操作可能にする

      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      setTouchStart({ x: mouseX, y: mouseY });

      const cellX = Math.floor(mouseX / CELL_SIZE);
      const cellY = Math.floor(mouseY / CELL_SIZE);

      // クリックされた位置の駒を探す
      const clickedPiece = Object.entries(gameState.pieces).find(
        ([, [x, y]]) => {
          return x === cellX && y === cellY;
        }
      );

      if (clickedPiece) {
        const pieceId = parseInt(clickedPiece[0]);
        setSelectedPiece(pieceId);
        setDraggedPiece(pieceId);
      } else {
        setSelectedPiece(null);
        setDraggedPiece(null);
      }
    },
    [currentStage, gameState.pieces]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!draggedPiece) return;
      event.preventDefault();
    },
    [draggedPiece]
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!currentStage || !touchStart || !draggedPiece) {
        setTouchStart(null);
        setDraggedPiece(null);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      const deltaX = mouseX - touchStart.x;
      const deltaY = mouseY - touchStart.y;

      const minDragDistance = 20;

      if (
        Math.abs(deltaX) > minDragDistance ||
        Math.abs(deltaY) > minDragDistance
      ) {
        const direction =
          Math.abs(deltaX) > Math.abs(deltaY)
            ? deltaX > 0
              ? "right"
              : "left"
            : deltaY > 0
            ? "down"
            : "up";
        movePiece(draggedPiece, direction);
      }

      setTouchStart(null);
      setDraggedPiece(null);
    },
    [currentStage, touchStart, draggedPiece, movePiece]
  );

  // タッチ操作処理
  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      if (!currentStage) return; // アニメーション中でも操作可能にする

      event.preventDefault();
      event.stopPropagation();
      // タッチ開始時にページスクロールを防ぐ
      if (event.cancelable) {
        event.preventDefault();
      }
      const touch = event.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const touchX = (touch.clientX - rect.left) * scaleX;
      const touchY = (touch.clientY - rect.top) * scaleY;

      setTouchStart({ x: touchX, y: touchY });

      const cellX = Math.floor(touchX / CELL_SIZE);
      const cellY = Math.floor(touchY / CELL_SIZE);

      // タッチされた位置の駒を探す
      const touchedPiece = Object.entries(gameState.pieces).find(
        ([, [x, y]]) => {
          return x === cellX && y === cellY;
        }
      );

      if (touchedPiece) {
        const pieceId = parseInt(touchedPiece[0]);
        setSelectedPiece(pieceId);
        setDraggedPiece(pieceId);
      } else {
        setSelectedPiece(null);
        setDraggedPiece(null);
      }
    },
    [currentStage, gameState.pieces]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      event.stopPropagation();
      // タッチ移動中はページスクロールを完全に防ぐ
      if (event.cancelable) {
        event.preventDefault();
      }
    },
    []
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      if (!currentStage || !touchStart || !draggedPiece) {
        setTouchStart(null);
        setDraggedPiece(null);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      // タッチ終了時にもページスクロールを防ぐ
      if (event.cancelable) {
        event.preventDefault();
      }
      const touch = event.changedTouches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const touchX = (touch.clientX - rect.left) * scaleX;
      const touchY = (touch.clientY - rect.top) * scaleY;

      const deltaX = touchX - touchStart.x;
      const deltaY = touchY - touchStart.y;

      const minSwipeDistance = 30;

      if (
        Math.abs(deltaX) > minSwipeDistance ||
        Math.abs(deltaY) > minSwipeDistance
      ) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          movePiece(draggedPiece, deltaX > 0 ? "right" : "left");
        } else {
          movePiece(draggedPiece, deltaY > 0 ? "down" : "up");
        }
      }

      setTouchStart(null);
      setDraggedPiece(null);
    },
    [currentStage, touchStart, draggedPiece, movePiece]
  );

  // キーボード操作
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!selectedPiece) return; // アニメーション中でも操作可能にする

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          movePiece(selectedPiece, "up");
          break;
        case "ArrowDown":
          event.preventDefault();
          movePiece(selectedPiece, "down");
          break;
        case "ArrowLeft":
          event.preventDefault();
          movePiece(selectedPiece, "left");
          break;
        case "ArrowRight":
          event.preventDefault();
          movePiece(selectedPiece, "right");
          break;
        case "Escape":
          setSelectedPiece(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedPiece, movePiece]);

  // ヒント再生システム
  useEffect(() => {
    if (!isPlayingHint || !currentStage?.solutionPath || isHintPaused) return;

    if (hintStep >= currentStage.solutionPath.length) {
      setIsPlayingHint(false);
      return;
    }

    const timeout = setTimeout(() => {
      const step = currentStage.solutionPath?.[hintStep];
      if (step) {
        movePiece(
          step.piece,
          step.direction as "up" | "down" | "left" | "right"
        );
        setHintStep((prev) => prev + 1);
      }
    }, 1500);

    hintTimeoutRef.current = timeout;

    return () => {
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
    };
  }, [isPlayingHint, hintStep, currentStage, isHintPaused, movePiece]);

  // キャンバス描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentStage) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 画像描画の品質を向上させる設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 迷路を描画
    for (let y = 0; y < currentStage.maze.length; y++) {
      for (let x = 0; x < currentStage.maze[y].length; x++) {
        const cell = currentStage.maze[y][x];
        if (cell.isWall) {
          ctx.fillStyle = "#2d3748";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else {
          ctx.fillStyle = "#f7fafc";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = "#e2e8f0";
          ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // ゴール位置を画像の半透明で描画
    Object.entries(currentStage.goalPositions).forEach(([pieceId, [x, y]]) => {
      const id = parseInt(pieceId);
      const goalImage = pieceImagesRef.current[id];

      if (goalImage) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        // セル全体に描画（境界線を完全に覆うため1px拡張）
        ctx.drawImage(
          goalImage,
          x * CELL_SIZE - 1.0,
          y * CELL_SIZE - 1.0,
          CELL_SIZE + 0,
          CELL_SIZE + 0
        );
        ctx.restore();
      }
    });

    // 駒を描画
    Object.entries(gameState.pieces).forEach(([pieceId, [x, y]]) => {
      const id = parseInt(pieceId);
      const isSelected = selectedPiece === id;
      const pieceImage = pieceImagesRef.current[id];

      // アニメーション中の位置計算
      let renderX = x;
      let renderY = y;

      const animating = animatingPieces[id];
      if (animating) {
        const [fromX, fromY] = animating.from;
        const [toX, toY] = animating.to;
        renderX = fromX + (toX - fromX) * animating.progress;
        renderY = fromY + (toY - fromY) * animating.progress;
      }

      // セル全体に描画（境界線を完全に覆うため1px拡張）
      const drawX = renderX * CELL_SIZE;
      const drawY = renderY * CELL_SIZE;

      if (pieceImage) {
        ctx.drawImage(
          pieceImage,
          drawX - 1.0,
          drawY - 1.0,
          CELL_SIZE + 0,
          CELL_SIZE + 0
        );
      } else {
        // フォールバック用の色
        const colors = ["#e53e3e", "#3182ce", "#38a169"];
        ctx.fillStyle = colors[id - 1];
        ctx.fillRect(drawX - 1.0, drawY - 1.0, CELL_SIZE + 1, CELL_SIZE + 1);
      }

      // 選択状態の表示
      if (isSelected) {
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 3;
        ctx.strokeRect(drawX - 1.0, drawY - 1.0, CELL_SIZE + 1, CELL_SIZE + 1);
      }
    });
  }, [currentStage, gameState, selectedPiece, imagesLoaded, animatingPieces]);

  // アニメーションフレームのクリーンアップ
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
      // コンポーネントアンマウント時にスライド音を停止
      stopSlideSound();
    };
  }, [stopSlideSound]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-xl">ステージを読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {/* Header */}
      <div className="puzzle-header">
        <div className="puzzle-header-top" style={{ alignItems: "flex-start" }}>
          <div className="stage-indicator">
            {/* <div
              className="stage-icon"
              style={{ top: "3px", position: "relative" }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                width="100%"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L4 6V12L12 16L20 12V6L12 2Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1.0"
                />
              </svg>
            </div> */}
            <h3 className="stage-title">∴ The Three</h3>
          </div>

          <div></div>
          <div className="stage-name text-nowrap">
            <span className="stars-count">{gameState.moves} moves</span>
          </div>

          <div className="stage-name">#{currentStage?.id}</div>
        </div>

        <div className="puzzle-header-bottom">
          <div className="buttons-container">
            <button
              className="puzzle-button hint-button"
              onClick={() => {
                if (currentStage) {
                  const resetState = {
                    pieces: convertPositions(currentStage.startPositions),
                    moves: 0,
                    isCompleted: false,
                  };
                  setGameState(resetState);
                  setSelectedPiece(null);
                  // 履歴をリセット
                  setGameHistory([resetState]);
                  setCurrentHistoryIndex(0);
                }
              }}
            >
              <div className="button-icon text-white">
                <FontAwesomeIcon icon={faRedo} />
              </div>
            </button>

            <button
              className={`puzzle-button ${
                currentHistoryIndex > 0 ? "select-button" : "hint-button"
              }`}
              onClick={stepBackward}
              disabled={currentHistoryIndex <= 0}
            >
              <div className="button-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  width="100%"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19 12H5M12 19L5 12L12 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            <button
              className={`puzzle-button ${
                currentHistoryIndex < gameHistory.length - 1
                  ? "select-button"
                  : "hint-button"
              }`}
              onClick={stepForward}
              disabled={currentHistoryIndex >= gameHistory.length - 1}
            >
              <div className="button-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  width="100%"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 12H19M12 5L19 12L12 19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            {currentStage?.solutionPath && (
              <button
                className={`puzzle-button ${
                  showSolution ? "hint-button" : "select-button"
                }`}
                onClick={() => setShowSolution(!showSolution)}
              >
                <div className="button-icon">
                  <FontAwesomeIcon icon={faLightbulb} />
                </div>
              </button>
            )}

            <button
              className={`puzzle-button ${
                soundEnabled ? "select-button" : "hint-button"
              }`}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              <div className="button-icon">
                <FontAwesomeIcon
                  icon={soundEnabled ? faVolumeUp : faVolumeMute}
                />
              </div>
              <span>{soundEnabled ? "ON" : "OFF"}</span>
            </button>

            <button
              className="puzzle-button select-button"
              onClick={() => {
                playSound("modal");
                setShowStageSelect(!showStageSelect);
              }}
            >
              <div className="button-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  width="100%"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 6h16M4 12h16M4 18h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Information Area */}
      {/* <div id="information" className="p-4">
        <p style={{ whiteSpace: "pre-wrap" }}>
          {gameState.isCompleted && "🎉 ステージクリア！ 🎉"}
          {selectedPiece &&
            !gameState.isCompleted &&
            `駒${selectedPiece}が選択中 - ドラッグまたは矢印キーで移動`}
        </p>
      </div> */}

      {/* Game Container */}
      <div
        id="game-container"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${MAZE_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${MAZE_SIZE}, 1fr)`,
          gap: "1px",
          width: "100vw",
          maxWidth: "440px",
          aspectRatio: "1",
          backgroundColor: "#ddd",
          border: "1px solid #999",
          borderRadius: "8px",
          margin: "10px 0",
          position: "relative",
          touchAction: "none", // ゲームエリア全体でタッチ操作制御
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        <canvas
          ref={canvasRef}
          width={MAZE_SIZE * CELL_SIZE}
          height={MAZE_SIZE * CELL_SIZE}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            imageRendering: "auto", // シャギー除去のためpixelatedからautoに変更
            cursor: "pointer",
            borderRadius: "6px",
            touchAction: "none", // タッチ操作のデフォルト動作を無効化
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* ステージ選択モーダル */}
      {showStageSelect && (
        <div
          id="modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowStageSelect(false);
          }}
        >
          <div id="modal-overlay">
            <button
              id="close-modal"
              className="close-button"
              onClick={() => setShowStageSelect(false)}
            >
              ×
            </button>
            <div id="modal-content">
              <h2 className="stage-select-title">ステージを選択</h2>
              <div className="stage-grid-container">
                {stages.map((stage, index) => {
                  const isCleared = clearedStages.has(stage.id);
                  const isCurrentStage = currentStage?.id === stage.id;
                  const hue = (index * (360 / stages.length)) % 360;

                  return (
                    <div
                      key={stage.id || index}
                      className={`stage-card ${
                        isCurrentStage ? "current-stage" : ""
                      } ${isCleared ? "cleared" : ""}`}
                      style={
                        {
                          "--stage-hue": `${hue}`,
                        } as React.CSSProperties
                      }
                    >
                      <button
                        onClick={() => {
                          playSound("decision");
                          setCurrentStage(stage);
                          const newState = {
                            pieces: convertPositions(stage.startPositions),
                            moves: 0,
                            isCompleted: false,
                          };
                          setGameState(newState);
                          setSelectedPiece(null);
                          setShowStageSelect(false);
                          // 新しいステージの履歴をリセット
                          setGameHistory([newState]);
                          setCurrentHistoryIndex(0);
                        }}
                        className="stage-button"
                        disabled={
                          index > 0 && !clearedStages.has(stages[index - 1]?.id)
                        }
                      >
                        <div className="stage-number">{index + 1}</div>
                        <div className="stage-details">
                          <div className="stage-name">
                            {stage.name || `ステージ ${index + 1}`}
                          </div>
                          <div className="stage-status">
                            {isCleared && (
                              <span className="cleared-indicator">
                                <span className="star-icon">
                                  {(() => {
                                    // 8つごとに星の数を決める
                                    if (index < 8) return "★☆☆☆☆☆☆☆"; // 1-8: 1星
                                    if (index < 16) return "★★☆☆☆☆☆☆"; // 9-16: 2星
                                    if (index < 24) return "★★★☆☆☆☆☆"; // 17-24: 3星
                                    if (index < 32) return "★★★★☆☆☆☆"; // 25-32: 4星
                                    if (index < 40) return "★★★★★☆☆☆"; // 33-40: 5星
                                    if (index < 48) return "★★★★★★☆☆"; // 41-48: 6星
                                    if (index < 56) return "★★★★★★★☆"; // 49-56: 7星
                                    return "★★★★★★★★"; // 57-64: 8星
                                  })()}
                                </span>
                                クリア済
                              </span>
                            )}
                            {!isCleared && !isCurrentStage && (
                              <span className="locked-indicator">
                                {index > 0 &&
                                !clearedStages.has(stages[index - 1]?.id) ? (
                                  <span className="lock-icon">🔒</span>
                                ) : (
                                  <span className="available-indicator">
                                    プレイ可能
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="stage-select-footer">
                <div className="legend">
                  <div className="legend-item">
                    <span className="legend-icon current"></span> プレイ中
                  </div>
                  <div className="legend-item">
                    <span className="legend-icon cleared"></span> クリア済
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ヒント表示 */}
      {showSolution && currentStage?.solutionPath && (
        <div className="hint-panel">
          <div className="hint-header">
            解法ヒント: ステップ {hintStep + 1} /{" "}
            {currentStage.solutionPath?.length || 0}
          </div>
          <div className="hint-controls">
            <button
              onClick={() => {
                if (!isPlayingHint) {
                  // 再生開始時にスタート状態に戻す
                  if (currentStage) {
                    const resetState = {
                      pieces: convertPositions(currentStage.startPositions),
                      moves: 0,
                      isCompleted: false,
                    };
                    setGameState(resetState);
                    setSelectedPiece(null);
                    // 履歴をリセット
                    setGameHistory([resetState]);
                    setCurrentHistoryIndex(0);
                    setHintStep(0);
                  }
                }
                setIsPlayingHint(!isPlayingHint);
              }}
              className="puzzle-button hint-button"
            >
              {isPlayingHint ? "停止" : "再生"}
            </button>
            <button
              onClick={() => {
                // リセット時にスタート状態に戻す
                if (currentStage) {
                  const resetState = {
                    pieces: convertPositions(currentStage.startPositions),
                    moves: 0,
                    isCompleted: false,
                  };
                  setGameState(resetState);
                  setSelectedPiece(null);
                  // 履歴をリセット
                  setGameHistory([resetState]);
                  setCurrentHistoryIndex(0);
                }
                setHintStep(0);
                setIsPlayingHint(false);
                setIsHintPaused(false);
              }}
              className="puzzle-button reset-button"
            >
              リセット
            </button>
          </div>
          {currentStage.solutionPath?.[hintStep] && (
            <div className="hint-instruction">
              駒{currentStage.solutionPath[hintStep].piece}を
              {currentStage.solutionPath[hintStep].direction === "up" && "上"}
              {currentStage.solutionPath[hintStep].direction === "down" && "下"}
              {currentStage.solutionPath[hintStep].direction === "left" && "左"}
              {currentStage.solutionPath[hintStep].direction === "right" &&
                "右"}
              に移動
            </div>
          )}
        </div>
      )}

      {/* クリア画面 */}
      {gameState.isCompleted && (
        <div className="puzzle-modal-overlay">
          <div className="puzzle-success-modal">
            <div className="success-icon">🎉</div>
            <h2 className="success-title">STAGE CLEAR!</h2>
            <div className="success-details">
              <p className="stage-name">{currentStage?.name}</p>
              <p className="moves-count">手数: {gameState.moves}</p>
            </div>
            <div className="success-buttons">
              <button
                onClick={() => {
                  if (currentStage) {
                    const resetState = {
                      pieces: convertPositions(currentStage.startPositions),
                      moves: 0,
                      isCompleted: false,
                    };
                    setGameState(resetState);
                    setSelectedPiece(null);
                    // 履歴をリセット
                    setGameHistory([resetState]);
                    setCurrentHistoryIndex(0);
                  }
                }}
                className="puzzle-button retry-button"
              >
                もう一度
              </button>
              {stages.length > 1 &&
                currentStage &&
                currentStage.id < stages.length && (
                  <button
                    onClick={() => {
                      const nextStage = stages.find(
                        (s) => s.id === currentStage.id + 1
                      );
                      if (nextStage) {
                        setCurrentStage(nextStage);
                        const newState = {
                          pieces: convertPositions(nextStage.startPositions),
                          moves: 0,
                          isCompleted: false,
                        };
                        setGameState(newState);
                        setSelectedPiece(null);
                        // 新しいステージの履歴をリセット
                        setGameHistory([newState]);
                        setCurrentHistoryIndex(0);
                      }
                    }}
                    className="puzzle-button next-button"
                  >
                    次のステージ
                  </button>
                )}
              <button
                onClick={() => {
                  playSound("modal");
                  setGameState((prev) => ({ ...prev, isCompleted: false }));
                  setShowStageSelect(true);
                }}
                className="puzzle-button select-button"
              >
                ステージ選択
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 操作説明 */}
      <div className="mt-6 sm:mt-8 mx-auto max-w-2xl px-2 sm:px-0">
        <div className="bg-gradient-to-r from-slate-800/60 to-slate-700/60 backdrop-blur-lg border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              <h3 className="text-base sm:text-lg font-bold text-slate-200">
                GAME GUIDE
              </h3>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            </div>
            <p className="text-slate-300 leading-relaxed mb-3 sm:mb-4 text-sm sm:text-base">
              3つの駒を目標位置まで移動させよう！
              <br />
              駒をドラッグ&スワイプで移動します。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlidingPuzzleScreen;
