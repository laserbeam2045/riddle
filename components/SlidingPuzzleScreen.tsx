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

  // 移動キューシステム
  const [moveQueue, setMoveQueue] = useState<Array<{
    pieceId: number;
    direction: "up" | "down" | "left" | "right";
  }>>([]);
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // 音声初期化用
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRefs = useRef<{ [key: number]: number }>({});
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pieceImagesRef = useRef<{ [key: number]: HTMLImageElement }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const audioContext = useRef<AudioContext | null>(null);
  const currentSlideSource = useRef<AudioBufferSourceNode | null>(null);
  const currentSlideAudio = useRef<HTMLAudioElement | null>(null);
  const lastFillSoundTime = useRef<number>(0);
  const lastCorrectSoundTime = useRef<number>(0);

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

  // ステージ変更時に音声重複防止フラグをリセット
  useEffect(() => {
    lastFillSoundTime.current = 0;
    lastCorrectSoundTime.current = 0;
  }, [currentStage]);

  // デスクトップでは自動的に音声をアンロック
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      setIsAudioUnlocked(true);
    }
  }, []);

  // slide音再生関数（モバイル・Safari対応強化）
  const playSlideWithWebAudio = useCallback(() => {
    if (!soundEnabled || !isAudioUnlocked) return;

    // モバイル・Safari判定を拡張
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // モバイルまたはSafariの場合は、Web Audio APIを完全にスキップしてHTML5 Audioのみ使用
    if (isMobile || isSafari) {
      try {
        // 前のslide音があれば停止
        if (currentSlideAudio.current) {
          currentSlideAudio.current.pause();
          currentSlideAudio.current.currentTime = 0;
          currentSlideAudio.current = null;
        }

        const audio = new Audio("/sounds/slide.mp3");
        audio.volume = 0.3;
        audio.preload = 'auto';

        // 現在の音声として保存
        currentSlideAudio.current = audio;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Mobile/Safari HTML5 audio played successfully");
          }).catch((error) => {
            console.log("Mobile/Safari HTML5 audio failed:", error);
            // モバイル/Safariでは失敗しても無理にWeb Audio APIは使わない
            currentSlideAudio.current = null;
          });
        }
        return;
      } catch (error) {
        console.log("Mobile/Safari HTML5 audio error:", error);
        currentSlideAudio.current = null;
        // モバイル/Safariではエラー時もWeb Audio APIは使わない
        return;
      }
    }

    // 通常のWeb Audio API処理
    playWebAudioFallback();

    function playWebAudioFallback() {
      // 非同期処理を Promise でラップして catch する
      (async () => {
        try {
          // AudioContextを初期化
          if (!audioContext.current || audioContext.current.state === 'closed') {
            try {
              const AudioContextClass =
                window.AudioContext ||
                (window as Window & { webkitAudioContext?: typeof AudioContext })
                  .webkitAudioContext;
              if (AudioContextClass) {
                audioContext.current = new AudioContextClass();
              } else {
                throw new Error("AudioContext not supported");
              }
            } catch (initError) {
              console.log("AudioContext initialization failed:", initError);
              throw initError;
            }
          }

          // AudioContextの状態をチェック
          if (audioContext.current.state === 'suspended') {
            try {
              await audioContext.current.resume();
            } catch (resumeError) {
              console.log("AudioContext resume failed:", resumeError);
              // resume失敗時はAudioContextを再作成
              try {
                audioContext.current.close();
              } catch (closeError) {
                console.log("AudioContext close failed:", closeError);
              }
              audioContext.current = null;
              throw resumeError;
            }
          }

          // AudioContextが使用不可能な状態の場合
          if (audioContext.current.state === 'closed' || !audioContext.current.destination) {
            throw new Error("AudioContext is in invalid state");
          }

          // 前のslide音があれば停止
          if (currentSlideSource.current) {
            try {
              currentSlideSource.current.stop();
            } catch (e) {
              // 停止エラーを無視
              console.error(e);
            }
            currentSlideSource.current = null;
          }

          // slide音をフェッチしてデコード
          const response = await fetch("/sounds/slide.mp3");
          if (!response.ok) throw new Error("Failed to fetch audio");

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.current.decodeAudioData(
            arrayBuffer
          );

          // AudioBufferSourceNodeを作成
          const source = audioContext.current.createBufferSource();
          const gainNode = audioContext.current.createGain();

          source.buffer = audioBuffer;
          gainNode.gain.value = 0.3;

          // 接続
          source.connect(gainNode);
          gainNode.connect(audioContext.current.destination);

          // 現在のソースを記録
          currentSlideSource.current = source;

          // 再生
          source.start(0);
        } catch (error) {
          console.log("Web Audio API error:", error);

          // Web Audio APIが完全に失敗した場合、AudioContextをリセット
          if (audioContext.current) {
            try {
              audioContext.current.close();
            } catch (closeError) {
              console.log("AudioContext close error:", closeError);
            }
            audioContext.current = null;
          }

          // フォールバック: 通常のAudio（モバイル対応改善）
          try {
            // 前のHTML5 Audioがあれば停止
            if (currentSlideAudio.current) {
              currentSlideAudio.current.pause();
              currentSlideAudio.current.currentTime = 0;
              currentSlideAudio.current = null;
            }

            const audio = new Audio("/sounds/slide.mp3");
            audio.volume = 0.3;

            // プリロードを追加してモバイルでの再生を改善
            audio.preload = 'auto';

            // 現在の音声として保存
            currentSlideAudio.current = audio;

            // モバイルでの音声再生を強制的に試行
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                console.log("Fallback audio played successfully");
              }).catch((playError) => {
                console.log("Fallback audio play prevented:", playError);

                // ユーザーインタラクションの後に再試行
                const retryAudio = () => {
                  audio.play().catch((retryError) => {
                    console.log("Retry audio error:", retryError);
                  });
                };

                // 短い遅延後に再試行
                setTimeout(retryAudio, 100);
              });
            }
          } catch (fallbackError) {
            console.log("Complete audio fallback failed:", fallbackError);
          }
        }
      })().catch((error) => {
        console.log("Async audio error:", error);
      });
    }
  }, [soundEnabled, isAudioUnlocked]);

  // 音声アンロック関数（Touch to start用）
  const unlockAudio = useCallback(() => {
    // モバイル・Safari判定
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // モバイル/SafariではWeb Audio APIを完全にスキップ
    if (isMobile || isSafari) {
      console.log("Mobile/Safari detected - skipping Web Audio API");
      setIsAudioUnlocked(true);
      return;
    }

    // デスクトップ環境でのみWeb Audio APIを使用
    if (!audioContext.current || audioContext.current.state === 'closed') {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AudioContextClass) {
          audioContext.current = new AudioContextClass();
        } else {
          console.error("Web Audio API is not supported in this browser.");
          setIsAudioUnlocked(true); // フォールバックとして有効にする
          return;
        }
      } catch (error) {
        console.error("AudioContext initialization failed:", error);
        setIsAudioUnlocked(true); // フォールバックとして有効にする
        return;
      }
    }

    if (audioContext.current) {
      if (audioContext.current.state === "suspended") {
        audioContext.current
          .resume()
          .then(() => {
            console.log("AudioContext resumed successfully!");
            setIsAudioUnlocked(true);
          })
          .catch((e) => {
            console.error("Error resuming AudioContext:", e);
            setIsAudioUnlocked(true); // エラーでもフォールバックとして有効にする
          });
      } else if (audioContext.current.state === "running") {
        console.log("AudioContext already running.");
        setIsAudioUnlocked(true);
      }
    }
  }, []);

  // Touch to startハンドラー
  const handleForceClicker = useCallback(() => {
    unlockAudio();
  }, [unlockAudio]);

  // 音声再生関数
  const playSound = useCallback(
    (soundKey: string) => {
      if (!soundEnabled) return;

      // 音声がアンロックされていない場合はアンロックを試行
      if (!isAudioUnlocked) {
        unlockAudio();
        return;
      }

      if (soundKey === "slide") {
        playSlideWithWebAudio();
        return;
      }

      const soundFiles = {
        modal: "/sounds/modal.mp3",
        fill: "/sounds/fill.mp3",
        decision: "/sounds/decision.mp3",
        correct: "/sounds/correct.mp3",
        cancel: "/sounds/cancel.mp3",
      };

      const src = soundFiles[soundKey as keyof typeof soundFiles];
      if (src) {
        // fill音の重複再生を防ぐ
        if (soundKey === "fill") {
          const now = Date.now();
          if (now - lastFillSoundTime.current < 150) {
            return; // 150ms以内の連続再生をブロック
          }
          lastFillSoundTime.current = now;
        }

        // correct音の重複再生を防ぐ
        if (soundKey === "correct") {
          const now = Date.now();
          if (now - lastCorrectSoundTime.current < 500) {
            return; // 500ms以内の連続再生をブロック
          }
          lastCorrectSoundTime.current = now;
        }

        try {
          const audio = new Audio(src);
          audio.volume = 0.3;

          // Safari対応: プリロードを確実にする
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          if (isSafari) {
            audio.preload = 'auto';
            audio.load(); // Safari向けに明示的にロード
          }

          // モバイル対応: Promise ベースの再生処理
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              console.log("Audio play prevented:", e);
              // モバイルでのリトライ機能
              setTimeout(() => {
                audio.play().catch((retryError) => {
                  console.log("Audio retry failed:", retryError);
                });
              }, 100);
            });
          }
        } catch (error) {
          console.log("Audio play error:", error);
        }
      }
    },
    [soundEnabled, isAudioUnlocked, playSlideWithWebAudio, unlockAudio]
  );

  // スライド音停止関数
  const stopSlideSound = useCallback(() => {
    // Web Audio API用の停止
    if (currentSlideSource.current) {
      try {
        currentSlideSource.current.stop();
        currentSlideSource.current = null;
      } catch (error) {
        console.log("Stop slide sound error:", error);
      }
    }

    // HTML5 Audio用の停止（Safari対応）
    if (currentSlideAudio.current) {
      try {
        currentSlideAudio.current.pause();
        currentSlideAudio.current.currentTime = 0;
        currentSlideAudio.current = null;
      } catch (error) {
        console.log("Stop HTML5 audio error:", error);
      }
    }
  }, []);

  // 勝利条件チェック
  const checkWinCondition = useCallback(
    (newPieces?: { [key: number]: [number, number] }) => {
      if (!currentStage) return;

      // ヒント再生中はクリア判定しない
      if (isPlayingHint) return;

      // 既にクリア済みの場合は処理しない
      if (gameState.isCompleted) return;

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
    [
      currentStage,
      gameState.pieces,
      playSound,
      saveClearedStages,
      isPlayingHint,
    ]
  );

  // EaseInOut関数
  const easeInOut = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

  // 内部的な駒の移動処理（実際のアニメーション実行）
  const executePieceMove = useCallback(
    (pieceId: number, direction: "up" | "down" | "left" | "right") => {
      if (!currentStage) return false; // アニメーション中でも操作可能にする

      const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
      const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;

      // アニメーション中の場合は、アニメーション先の位置を開始位置として使用
      const animating = animatingPieces[pieceId];
      const [currentX, currentY] = animating
        ? animating.to // アニメーション中なら目標位置から開始
        : gameState.pieces[pieceId]; // アニメーション中でなければ現在位置から開始
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

        // 他の駒との衝突チェック（アニメーション中の位置も考慮）
        const hasCollision = Object.entries(gameState.pieces).some(
          ([id, [x, y]]) => {
            const otherId = parseInt(id);
            if (otherId === pieceId) return false;

            // 他の駒がアニメーション中の場合はその目標位置をチェック
            const otherAnimating = animatingPieces[otherId];
            const [otherX, otherY] = otherAnimating
              ? otherAnimating.to
              : [x, y];

            return otherX === nextX && otherY === nextY;
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
        // 移動処理中フラグは既にprocessNextMoveで設定済み
        // スライド音を再生
        playSound("slide");

        // アニメーション設定（既存のアニメーション状態を保持）
        setAnimatingPieces(prev => ({
          ...prev,
          [pieceId]: {
            from: [currentX, currentY],
            to: [newX, newY],
            progress: 0,
          },
        }));

        // アニメーション実行
        const startTime = Date.now();
        // 移動距離に応じてアニメーション時間を計算
        const distance = Math.abs(newX - currentX) + Math.abs(newY - currentY);
        const baseTime = 100; // 1マスあたりの基本時間（ms）
        const animationDuration = Math.max(baseTime * distance, 180);

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / animationDuration, 1);
          const easedProgress = easeInOut(progress);

          setAnimatingPieces(prev => ({
            ...prev,
            [pieceId]: {
              from: [currentX, currentY],
              to: [newX, newY],
              progress: easedProgress,
            },
          }));

          if (progress >= 1) {
            // アニメーション完了（該当する駒のみ削除）
            setAnimatingPieces(prev => {
              const newState = { ...prev };
              delete newState[pieceId];
              return newState;
            });

            // アニメーションrefも削除
            if (animationRefs.current[pieceId]) {
              delete animationRefs.current[pieceId];
            }
            // setIsAnimating(false); // 現在未使用

            // スライド音を停止
            stopSlideSound();

            const updatedPieces: { [key: number]: [number, number] } = {
              ...gameState.pieces,
              [pieceId]: [newX, newY] as [number, number],
            };

            setGameState((prev) => {
              const newMoves = prev.moves + 1;

              // 操作終了音を再生
              playSound("fill");

              // 履歴に追加
              const newState: GameState = {
                pieces: updatedPieces,
                moves: newMoves,
                isCompleted: false,
              };
              addToHistory(newState);

              return {
                ...prev,
                pieces: updatedPieces,
                moves: newMoves,
              };
            });

            // 勝利条件チェック（新しい位置で）
            setTimeout(() => {
              checkWinCondition(updatedPieces);
            }, 100);

            // 移動完了後、キュー処理を継続
            setIsProcessingMove(false);
          } else {
            animationRefs.current[pieceId] = requestAnimationFrame(animate);
          }
        };

        // 該当する駒の既存のアニメーションをキャンセル
        if (animationRefs.current[pieceId]) {
          cancelAnimationFrame(animationRefs.current[pieceId]);
          delete animationRefs.current[pieceId];
        }

        animationRefs.current[pieceId] = requestAnimationFrame(animate);
        return true; // 移動が実行された
      }

      return false; // 移動しなかった
    },
    [
      currentStage,
      gameState,
      checkWinCondition,
      playSound,
      stopSlideSound,
      animatingPieces,
      addToHistory,
    ]
  );

  // キュー処理システム
  const processNextMove = useCallback(() => {
    if (isProcessingMove || moveQueue.length === 0) return;

    setIsProcessingMove(true);
    const nextMove = moveQueue[0];
    setMoveQueue(prev => prev.slice(1));

    // 実際の移動を実行
    const moved = executePieceMove(nextMove.pieceId, nextMove.direction);

    // 移動しなかった場合は即座に次へ
    if (!moved) {
      setIsProcessingMove(false);
    }
  }, [isProcessingMove, moveQueue, executePieceMove]);

  // キューの変化を監視して自動処理
  useEffect(() => {
    processNextMove();
  }, [moveQueue, isProcessingMove, processNextMove]);

  // パブリックな移動関数（キューに追加）
  const movePiece = useCallback(
    (pieceId: number, direction: "up" | "down" | "left" | "right") => {
      setMoveQueue(prev => [...prev, { pieceId, direction }]);
      setSelectedPiece(null);
    },
    []
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

      // モバイルでのAudioContext初期化をタッチ時に行う
      if (soundEnabled && (!audioContext.current || audioContext.current.state === 'closed')) {
        try {
          const AudioContextClass =
            window.AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (AudioContextClass) {
            // 既存のAudioContextをクリーンアップ
            if (audioContext.current && audioContext.current.state !== 'closed') {
              try {
                audioContext.current.close();
              } catch (closeError) {
                console.log("AudioContext close error:", closeError);
              }
            }

            audioContext.current = new AudioContextClass();

            // suspended状態の場合は即座にresume
            if (audioContext.current.state === 'suspended') {
              audioContext.current.resume().then(() => {
                console.log("AudioContext resumed successfully on touch");
              }).catch((resumeError) => {
                console.log("AudioContext resume error:", resumeError);
                // resume失敗時はAudioContextをnullにしてフォールバックを使用
                audioContext.current = null;
              });
            }
          }
        } catch (error) {
          console.log("AudioContext initialization error:", error);
          audioContext.current = null;
        }
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
    [currentStage, gameState.pieces, soundEnabled]
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

    // 道を描画
    for (let y = 0; y < currentStage.maze.length; y++) {
      for (let x = 0; x < currentStage.maze[y].length; x++) {
        const cell = currentStage.maze[y][x];
        if (!cell.isWall) {
          ctx.fillStyle = "#f7fafc";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = "#e2e8f0";
          ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // 壁を描画
    for (let y = 0; y < currentStage.maze.length; y++) {
      for (let x = 0; x < currentStage.maze[y].length; x++) {
        const cell = currentStage.maze[y][x];
        if (cell.isWall) {
          ctx.fillStyle = "#2d3748";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
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
          x * CELL_SIZE - 0.0,
          y * CELL_SIZE - 0.0,
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

      // ゴール位置にいるかチェック
      const goalPosition = currentStage.goalPositions[id];
      const isAtGoal =
        goalPosition && goalPosition[0] === x && goalPosition[1] === y;

      // セル全体に描画（境界線を完全に覆うため1px拡張）
      const drawX = renderX * CELL_SIZE;
      const drawY = renderY * CELL_SIZE;

      // ゴール位置にある駒に発光エフェクトを追加
      if (isAtGoal) {
        ctx.save();
        ctx.shadowColor = "#10b981"; // より緑色っぽいエメラルドグリーン
        ctx.shadowBlur = 12; // 控え目にブラー値を下げる
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      if (pieceImage) {
        ctx.drawImage(
          pieceImage,
          drawX - 0.0,
          drawY - 0.0,
          CELL_SIZE + 0,
          CELL_SIZE + 0
        );
      } else {
        // フォールバック用の色
        const colors = ["#e53e3e", "#3182ce", "#38a169"];
        ctx.fillStyle = colors[id - 1];
        ctx.fillRect(drawX - 0.0, drawY - 0.0, CELL_SIZE + 1, CELL_SIZE + 1);
      }

      // ゴール位置エフェクトのリストア
      if (isAtGoal) {
        ctx.restore();
      }

      // 選択状態の表示
      if (isSelected) {
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 3;
        ctx.strokeRect(drawX - 0.0, drawY - 0.0, CELL_SIZE + 1, CELL_SIZE + 1);
      }
    });
  }, [currentStage, gameState, selectedPiece, imagesLoaded, animatingPieces]);

  // アニメーションフレームのクリーンアップ
  useEffect(() => {
    return () => {
      // 全ての駒のアニメーションをキャンセル
      Object.values(animationRefs.current).forEach(animationId => {
        cancelAnimationFrame(animationId);
      });
      animationRefs.current = {};

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
        <div
          className="puzzle-header-top"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          {/* Left: Title */}
          <div
            className="stage-indicator"
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "rgba(30, 30, 30, 0.8)",
                border: "1px solid rgba(64, 64, 64, 0.6)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 3px rgba(0,0,0,0.3)",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 正三角形の辺（グラフエッジ） */}
                <line
                  x1="12"
                  y1="5"
                  x2="5"
                  y2="17"
                  stroke="#6b7280"
                  strokeWidth="2"
                />
                <line
                  x1="5"
                  y1="17"
                  x2="19"
                  y2="17"
                  stroke="#6b7280"
                  strokeWidth="2"
                />
                <line
                  x1="19"
                  y1="17"
                  x2="12"
                  y2="5"
                  stroke="#6b7280"
                  strokeWidth="2"
                />

                {/* 頂点（ノード） */}
                <circle cx="12" cy="5" r="2.5" fill="#ffffff" />
                <circle cx="5" cy="17" r="2.5" fill="#ffffff" />
                <circle cx="19" cy="17" r="2.5" fill="#ffffff" />
              </svg>
            </div>
            <div>
              <h3
                className="stage-title"
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1f2937",
                  margin: 0,
                  letterSpacing: "0.3px",
                  textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)",
                }}
              >
                The Three
              </h3>
            </div>
          </div>

          {/* Right: Stats */}
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div className="stage-name text-nowrap">
              <span className="stars-count">{gameState.moves} moves</span>
            </div>
            <div className="stage-name">#{currentStage?.id}</div>
          </div>
        </div>

        <div className="puzzle-header-bottom">
          <div className="buttons-container">
            <button
              className="puzzle-button hint-button"
              onClick={() => {
                playSound("decision");
                // 音声重複防止フラグをリセット
                lastFillSoundTime.current = 0;
                lastCorrectSoundTime.current = 0;
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
                onClick={() => {
                  playSound("decision");
                  setShowSolution(!showSolution);
                }}
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
            if (e.target === e.currentTarget) {
              playSound("cancel");
              setShowStageSelect(false);
            }
          }}
        >
          <div id="modal-overlay">
            <button
              id="close-modal"
              className="close-button"
              onClick={() => {
                playSound("cancel");
                setShowStageSelect(false);
              }}
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
            解法ヒント: ステップ {hintStep} /{" "}
            {currentStage.solutionPath?.length || 0}
          </div>
          <div className="hint-controls">
            <button
              onClick={() => {
                playSound("decision");
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
                playSound("decision");
                // 音声重複防止フラグをリセット
                lastFillSoundTime.current = 0;
                lastCorrectSoundTime.current = 0;
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
              3つの天体を目標位置まで移動させよう！
              <br />
              天体をドラッグ&スワイプで移動します。
            </p>
          </div>
        </div>
      </div>

      {/* Touch to start modal for audio unlock */}
      {!isAudioUnlocked && (
        <div id="force-clicker" onClick={handleForceClicker}>
          <p>Touch to start.</p>
        </div>
      )}
    </div>
  );
};

export default SlidingPuzzleScreen;
