import React, { useState, useEffect, useCallback, useRef } from "react";

import { useAudio } from "../composables/useAudio";
import { usePuzzleGame } from "../composables/usePuzzleGame";
import { usePuzzleAnimation } from "../composables/usePuzzleAnimation";
import PuzzleHeader from "./puzzle/PuzzleHeader";
import PuzzleCanvas from "./puzzle/PuzzleCanvas";
import StageSelectModal from "./puzzle/StageSelectModal";

interface SlidingPuzzleScreenProps {
  onReturnHome: () => void;
}


const SlidingPuzzleScreen: React.FC<SlidingPuzzleScreenProps> = () => {
  // カスタムフックの使用
  const {
    stages,
    currentStage,
    gameState,
    gameHistory,
    currentHistoryIndex,
    isLoading,
    clearedStages,
    checkWinCondition,
    stepBackward,
    stepForward,
    resetGame,
    selectStage,
    updatePiecePosition,
    MAZE_SIZE,
  } = usePuzzleGame();

  const {
    animatingPieces,
    startAnimation,
    queueMove,
    processNextMove,
  } = usePuzzleAnimation();

  // 音声フック
  const { loadAudio, playAudio, stopAudio, unlockAudio, isAudioUnlocked } =
    useAudio(0.5);

  // 残りのローカルstate
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [showStageSelect, setShowStageSelect] = useState(false);
  const [hintStep, setHintStep] = useState(0);
  const [isPlayingHint, setIsPlayingHint] = useState(false);
  const [isHintPaused, setIsHintPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [draggedPiece, setDraggedPiece] = useState<number | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // refs
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pieceImagesRef = useRef<{ [key: number]: HTMLImageElement }>({});
  const lastFillSoundTime = useRef<number>(0);
  const lastCorrectSoundTime = useRef<number>(0);

  const CELL_SIZE = 40;

  // （これらの関数はusePuzzleGameフックに移動済み）

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

  // ステージ変更時に音声重複防止フラグをリセット
  useEffect(() => {
    lastFillSoundTime.current = 0;
    lastCorrectSoundTime.current = 0;
  }, [currentStage]);

  // （ステージデータロードはusePuzzleGameフック内で実行済み）

  // Touch to startハンドラー
  const handleForceClicker = useCallback(() => {
    unlockAudio();

    loadAudio("slide");
    loadAudio("modal");
    loadAudio("fill");
    loadAudio("phone");
    loadAudio("decision");
    loadAudio("clear");
  }, [loadAudio, unlockAudio]);

  // 勝利条件チェック（拡張版）
  const handleWinCondition = useCallback(
    (newPieces?: { [key: number]: [number, number] }) => {
      const isWin = checkWinCondition(newPieces, isPlayingHint);
      if (isWin && soundEnabled) {
        playAudio("clear");
      }
    },
    [checkWinCondition, isPlayingHint, playAudio, soundEnabled]
  );

  // 拡張された操作関数
  const handleStepBackward = useCallback(() => {
    const success = stepBackward();
    if (success) {
      if (soundEnabled) playAudio("decision");
      setSelectedPiece(null);
    }
  }, [stepBackward, playAudio, soundEnabled]);

  const handleStepForward = useCallback(() => {
    const success = stepForward();
    if (success) {
      if (soundEnabled) playAudio("decision");
      setSelectedPiece(null);
    }
  }, [stepForward, playAudio, soundEnabled]);

  // 内部的な駒の移動処理（アニメーションシステムを使用）
  const executePieceMove = useCallback(
    (pieceId: number, direction: "up" | "down" | "left" | "right") => {
      if (!currentStage) return false;

      const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
      const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;

      // アニメーション中の場合は、アニメーション先の位置を開始位置として使用
      const animating = animatingPieces[pieceId];
      const [currentX, currentY] = animating
        ? animating.to
        : gameState.pieces[pieceId];
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
            const otherId = parseInt(id);
            if (otherId === pieceId) return false;

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
        startAnimation(
          pieceId,
          currentX,
          currentY,
          newX,
          newY,
          (completedPieceId, finalX, finalY) => {
            // アニメーション完了時の処理
            const updatedPieces = updatePiecePosition(completedPieceId, finalX, finalY);
            if (soundEnabled) playAudio("fill");

            // 勝利条件チェック
            setTimeout(() => {
              handleWinCondition(updatedPieces);
            }, 100);
          },
          () => { if (soundEnabled) playAudio("slide"); }, // アニメーション開始時
          () => stopAudio("slide")  // アニメーション終了時
        );
        return true;
      }

      return false;
    },
    [
      currentStage,
      gameState.pieces,
      animatingPieces,
      MAZE_SIZE,
      startAnimation,
      updatePiecePosition,
      handleWinCondition,
      playAudio,
      stopAudio,
      soundEnabled,
    ]
  );

  // キューの変化を監視して自動処理
  useEffect(() => {
    processNextMove(executePieceMove);
  }, [processNextMove, executePieceMove]);

  // パブリックな移動関数（キューに追加）
  const movePiece = useCallback(
    (pieceId: number, direction: "up" | "down" | "left" | "right") => {
      queueMove(pieceId, direction);
      setSelectedPiece(null);
    },
    [queueMove]
  );

  // マウス操作処理
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!currentStage) return;

      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const scaleX = (MAZE_SIZE * CELL_SIZE) / rect.width;
      const scaleY = (MAZE_SIZE * CELL_SIZE) / rect.height;

      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      setTouchStart({ x: mouseX, y: mouseY });

      const cellX = Math.floor(mouseX / CELL_SIZE);
      const cellY = Math.floor(mouseY / CELL_SIZE);

      const clickedPiece = Object.entries(gameState.pieces).find(
        ([, [x, y]]) => x === cellX && y === cellY
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
    [currentStage, gameState.pieces, MAZE_SIZE, CELL_SIZE]
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

      const rect = event.currentTarget.getBoundingClientRect();
      const scaleX = (MAZE_SIZE * CELL_SIZE) / rect.width;
      const scaleY = (MAZE_SIZE * CELL_SIZE) / rect.height;

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
    [currentStage, touchStart, draggedPiece, movePiece, MAZE_SIZE, CELL_SIZE]
  );

  // タッチ操作処理
  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      if (!currentStage) return;

      event.preventDefault();
      event.stopPropagation();

      const touch = event.touches[0];
      const rect = event.currentTarget.getBoundingClientRect();
      const scaleX = (MAZE_SIZE * CELL_SIZE) / rect.width;
      const scaleY = (MAZE_SIZE * CELL_SIZE) / rect.height;

      const touchX = (touch.clientX - rect.left) * scaleX;
      const touchY = (touch.clientY - rect.top) * scaleY;

      setTouchStart({ x: touchX, y: touchY });

      const cellX = Math.floor(touchX / CELL_SIZE);
      const cellY = Math.floor(touchY / CELL_SIZE);

      const touchedPiece = Object.entries(gameState.pieces).find(
        ([, [x, y]]) => x === cellX && y === cellY
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
    [currentStage, gameState.pieces, MAZE_SIZE, CELL_SIZE]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      event.stopPropagation();
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

      const touch = event.changedTouches[0];
      const rect = event.currentTarget.getBoundingClientRect();
      const scaleX = (MAZE_SIZE * CELL_SIZE) / rect.width;
      const scaleY = (MAZE_SIZE * CELL_SIZE) / rect.height;

      const touchX = (touch.clientX - rect.left) * scaleX;
      const touchY = (touch.clientY - rect.top) * scaleY;

      const deltaX = touchX - touchStart.x;
      const deltaY = touchY - touchStart.y;
      const minSwipeDistance = 30;

      if (
        Math.abs(deltaX) > minSwipeDistance ||
        Math.abs(deltaY) > minSwipeDistance
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
    [currentStage, touchStart, draggedPiece, movePiece, MAZE_SIZE, CELL_SIZE]
  );

  // キーボード操作
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!selectedPiece) return;

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

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
      stopAudio("slide");
    };
  }, [stopAudio]);

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
      <PuzzleHeader
        currentStage={currentStage}
        moves={gameState.moves}
        currentHistoryIndex={currentHistoryIndex}
        gameHistoryLength={gameHistory.length}
        showSolution={showSolution}
        soundEnabled={soundEnabled}
        hasSolutionPath={!!currentStage?.solutionPath}
        onReset={() => {
          if (soundEnabled) playAudio("decision");
          lastFillSoundTime.current = 0;
          lastCorrectSoundTime.current = 0;
          resetGame();
          setSelectedPiece(null);
        }}
        onStepBackward={handleStepBackward}
        onStepForward={handleStepForward}
        onToggleSolution={() => {
          if (soundEnabled) playAudio("decision");
          setShowSolution(!showSolution);
        }}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onShowStageSelect={() => {
          if (soundEnabled) playAudio("modal");
          setShowStageSelect(!showStageSelect);
        }}
      />

      {/* Game Container */}
      <PuzzleCanvas
        maze={currentStage?.maze || []}
        pieces={gameState.pieces}
        goalPositions={currentStage?.goalPositions || {}}
        selectedPiece={selectedPiece}
        animatingPieces={animatingPieces}
        pieceImages={pieceImagesRef.current}
        mazeSize={MAZE_SIZE}
        cellSize={CELL_SIZE}
        imagesLoaded={imagesLoaded}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* ステージ選択モーダル */}
      {showStageSelect && (
        <StageSelectModal
          stages={stages}
          clearedStages={clearedStages}
          currentStage={currentStage}
          onStageSelect={(stage) => {
            selectStage(stage);
            setSelectedPiece(null);
          }}
          onClose={() => setShowStageSelect(false)}
          onPlayAudio={(sound) => { if (soundEnabled) playAudio(sound); }}
        />
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
                if (soundEnabled) playAudio("decision");
                if (!isPlayingHint) {
                  // 再生開始時にスタート状態に戻す
                  if (currentStage) {
                    resetGame();
                    setSelectedPiece(null);
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
                if (soundEnabled) playAudio("decision");
                // 音声重複防止フラグをリセット
                lastFillSoundTime.current = 0;
                lastCorrectSoundTime.current = 0;
                // リセット時にスタート状態に戻す
                if (currentStage) {
                  resetGame();
                  setSelectedPiece(null);
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
                  resetGame();
                  setSelectedPiece(null);
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
                        selectStage(nextStage);
                        setSelectedPiece(null);
                        if (soundEnabled) playAudio("phone");
                      }
                    }}
                    className="puzzle-button next-button"
                  >
                    次のステージ
                  </button>
                )}
              <button
                onClick={() => {
                  if (soundEnabled) playAudio("modal");
                  resetGame();
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

      {/* ステージナビゲーション */}
      <div className="mt-8 mb-8 flex justify-center gap-4">
        <button
          onClick={() => {
            const prevStage = stages.find((s) => s.id === (currentStage?.id || 1) - 1);
            if (prevStage) {
              selectStage(prevStage);
              setSelectedPiece(null);
              if (soundEnabled) playAudio("phone");
            }
          }}
          disabled={!currentStage || currentStage.id <= 1}
          className={`px-6 py-3 rounded-full font-bold text-white transition-all duration-300 ${
            !currentStage || currentStage.id <= 1
              ? "bg-gray-600 cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg transform hover:-translate-y-1"
          }`}
        >
          ← 前のステージ
        </button>

        <button
          onClick={() => {
            const nextStage = stages.find((s) => s.id === (currentStage?.id || 1) + 1);
            if (nextStage) {
              selectStage(nextStage);
              setSelectedPiece(null);
              if (soundEnabled) playAudio("phone");
            }
          }}
          disabled={!currentStage || currentStage.id >= stages.length || !clearedStages.has(currentStage.id)}
          className={`px-6 py-3 rounded-full font-bold text-white transition-all duration-300 ${
            !currentStage || currentStage.id >= stages.length || !clearedStages.has(currentStage.id)
              ? "bg-gray-600 cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 hover:shadow-lg transform hover:-translate-y-1"
          }`}
        >
          次のステージ →
        </button>
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