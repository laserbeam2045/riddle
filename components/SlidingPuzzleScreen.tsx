import React, { useState, useEffect, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faRedo, faLightbulb } from "@fortawesome/free-solid-svg-icons";

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

const SlidingPuzzleScreen: React.FC<SlidingPuzzleScreenProps> = ({ onReturnHome }) => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    pieces: {},
    moves: 0,
    isCompleted: false,
  });
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [gameHistory, setGameHistory] = useState<GameState[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showStageSelect, setShowStageSelect] = useState(false);
  const [hintStep, setHintStep] = useState(0);
  const [isPlayingHint, setIsPlayingHint] = useState(false);
  const [isHintPaused, setIsHintPaused] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [draggedPiece, setDraggedPiece] = useState<number | null>(null);
  const [animatingPieces, setAnimatingPieces] = useState<{[key: number]: {from: [number, number], to: [number, number], progress: number}}>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pieceImagesRef = useRef<{ [key: number]: HTMLImageElement }>({});

  const MAZE_SIZE = 11;
  const CELL_SIZE = 40;

  // 画像読み込み
  useEffect(() => {
    const imageFiles = [
      "/images/sun.png",
      "/images/earth.png",
      "/images/moon.png"
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
          setGameState({
            pieces: { ...firstStage.startPositions },
            moves: 0,
            isCompleted: false,
          });
        }
      } catch (error) {
        console.error("Error loading stages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStages();
  }, []);

  // 勝利条件チェック
  const checkWinCondition = useCallback((newPieces?: { [key: number]: [number, number] }) => {
    if (!currentStage) return;

    const piecesToCheck = newPieces || gameState.pieces;

    const isWin = Object.entries(currentStage.goalPositions).every(([pieceId, [goalX, goalY]]) => {
      const id = parseInt(pieceId);
      const [currentX, currentY] = piecesToCheck[id];
      return currentX === goalX && currentY === goalY;
    });

    if (isWin) {
      setGameState(prev => ({ ...prev, isCompleted: true }));
    }
  }, [currentStage, gameState.pieces]);

  // EaseOut関数
  const easeOut = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  // 駒の移動処理
  const movePiece = useCallback((pieceId: number, direction: 'up' | 'down' | 'left' | 'right') => {
    if (!currentStage || isAnimating) return;

    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;

    const [currentX, currentY] = gameState.pieces[pieceId];
    let newX = currentX;
    let newY = currentY;

    // 氷上を滑るように移動（障害物まで）
    while (true) {
      const nextX = newX + dx;
      const nextY = newY + dy;

      // 境界チェック
      if (nextX < 0 || nextX >= MAZE_SIZE || nextY < 0 || nextY >= MAZE_SIZE) {
        break;
      }

      // 壁チェック
      if (currentStage.maze[nextY][nextX].isWall) {
        break;
      }

      // 他の駒との衝突チェック
      const hasCollision = Object.entries(gameState.pieces).some(([id, [x, y]]) => {
        return parseInt(id) !== pieceId && x === nextX && y === nextY;
      });

      if (hasCollision) {
        break;
      }

      newX = nextX;
      newY = nextY;
    }

    // 位置が変わった場合のみ移動
    if (newX !== currentX || newY !== currentY) {
      setIsAnimating(true);

      // アニメーション設定
      setAnimatingPieces({
        [pieceId]: {
          from: [currentX, currentY],
          to: [newX, newY],
          progress: 0
        }
      });

      // アニメーション実行
      const startTime = Date.now();
      const animationDuration = 600; // 600ms

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        const easedProgress = easeOut(progress);

        setAnimatingPieces(prev => ({
          [pieceId]: {
            from: [currentX, currentY],
            to: [newX, newY],
            progress: easedProgress
          }
        }));

        if (progress >= 1) {
          // アニメーション完了
          setAnimatingPieces({});
          setIsAnimating(false);

          const updatedPieces = {
            ...gameState.pieces,
            [pieceId]: [newX, newY]
          };

          setGameState(prev => ({
            ...prev,
            pieces: updatedPieces,
            moves: prev.moves + 1
          }));

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
      }

      animationRef.current = requestAnimationFrame(animate);
    }

    setSelectedPiece(null);
  }, [currentStage, gameState, isAnimating, checkWinCondition]);

  // マウス操作処理
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentStage || isAnimating) return;

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
    const clickedPiece = Object.entries(gameState.pieces).find(([_, [x, y]]) => {
      return x === cellX && y === cellY;
    });

    if (clickedPiece) {
      const pieceId = parseInt(clickedPiece[0]);
      setSelectedPiece(pieceId);
      setDraggedPiece(pieceId);
    } else {
      setSelectedPiece(null);
      setDraggedPiece(null);
    }
  }, [currentStage, gameState.pieces, isAnimating]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggedPiece) return;
    event.preventDefault();
  }, [draggedPiece]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
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

    if (Math.abs(deltaX) > minDragDistance || Math.abs(deltaY) > minDragDistance) {
      const direction = Math.abs(deltaX) > Math.abs(deltaY)
        ? (deltaX > 0 ? 'right' : 'left')
        : (deltaY > 0 ? 'down' : 'up');
      movePiece(draggedPiece, direction);
    }

    setTouchStart(null);
    setDraggedPiece(null);
  }, [currentStage, touchStart, draggedPiece, movePiece]);

  // タッチ操作処理
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!currentStage || isAnimating) return;

    event.preventDefault();
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
    const touchedPiece = Object.entries(gameState.pieces).find(([_, [x, y]]) => {
      return x === cellX && y === cellY;
    });

    if (touchedPiece) {
      const pieceId = parseInt(touchedPiece[0]);
      setSelectedPiece(pieceId);
      setDraggedPiece(pieceId);
    } else {
      setSelectedPiece(null);
      setDraggedPiece(null);
    }
  }, [currentStage, gameState.pieces, isAnimating]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!currentStage || !touchStart || !draggedPiece) {
      setTouchStart(null);
      setDraggedPiece(null);
      return;
    }

    event.preventDefault();
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

    if (Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        movePiece(draggedPiece, deltaX > 0 ? 'right' : 'left');
      } else {
        movePiece(draggedPiece, deltaY > 0 ? 'down' : 'up');
      }
    }

    setTouchStart(null);
    setDraggedPiece(null);
  }, [currentStage, touchStart, draggedPiece, movePiece]);

  // キーボード操作
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!selectedPiece || isAnimating) return;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          movePiece(selectedPiece, 'up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          movePiece(selectedPiece, 'down');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          movePiece(selectedPiece, 'left');
          break;
        case 'ArrowRight':
          event.preventDefault();
          movePiece(selectedPiece, 'right');
          break;
        case 'Escape':
          setSelectedPiece(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedPiece, isAnimating, movePiece]);

  // ヒント再生システム
  useEffect(() => {
    if (!isPlayingHint || !currentStage?.solutionPath || isHintPaused) return;

    if (hintStep >= currentStage.solutionPath.length) {
      setIsPlayingHint(false);
      return;
    }

    const timeout = setTimeout(() => {
      const step = currentStage.solutionPath[hintStep];
      if (step) {
        movePiece(step.piece, step.direction as 'up' | 'down' | 'left' | 'right');
        setHintStep(prev => prev + 1);
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
        const imageSize = CELL_SIZE * 0.8;
        ctx.drawImage(
          goalImage,
          x * CELL_SIZE + (CELL_SIZE - imageSize) / 2,
          y * CELL_SIZE + (CELL_SIZE - imageSize) / 2,
          imageSize,
          imageSize
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

      const pieceSize = CELL_SIZE * 0.8;
      const centerX = renderX * CELL_SIZE + CELL_SIZE / 2;
      const centerY = renderY * CELL_SIZE + CELL_SIZE / 2;

      if (pieceImage) {
        ctx.drawImage(
          pieceImage,
          centerX - pieceSize / 2,
          centerY - pieceSize / 2,
          pieceSize,
          pieceSize
        );
      } else {
        // フォールバック用の色
        const colors = ["#e53e3e", "#3182ce", "#38a169"];
        ctx.fillStyle = colors[id - 1];
        ctx.fillRect(
          centerX - pieceSize / 2,
          centerY - pieceSize / 2,
          pieceSize,
          pieceSize
        );
      }

      // 選択状態の表示
      if (isSelected) {
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          centerX - pieceSize / 2,
          centerY - pieceSize / 2,
          pieceSize,
          pieceSize
        );
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
    };
  }, []);

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
        background: "#eee",
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
        <div className="puzzle-header-top">
          <div className="stage-indicator">
            <div className="stage-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L4 6V12L12 16L20 12V6L12 2Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <h3 className="stage-title">スライディングパズル</h3>
          </div>

          <div className="stage-name">#{currentStage?.id} - {currentStage?.difficulty}</div>
        </div>

        <div className="puzzle-header-bottom">
          <div className="stars-container">
            <div className="stars-icon">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <span className="stars-count">{gameState.moves}手</span>
          </div>

          <div className="buttons-container">
            <button
              className="puzzle-button hint-button"
              onClick={() => {
                if (currentStage) {
                  setGameState({
                    pieces: { ...currentStage.startPositions },
                    moves: 0,
                    isCompleted: false,
                  });
                  setSelectedPiece(null);
                }
              }}
            >
              <div className="button-icon text-white">
                <FontAwesomeIcon icon={faRedo} />
              </div>
              <span>リセット</span>
            </button>

            {currentStage?.solutionPath && (
              <button
                className={`puzzle-button ${showSolution ? 'hint-button' : 'select-button'}`}
                onClick={() => setShowSolution(!showSolution)}
              >
                <div className="button-icon">
                  <FontAwesomeIcon icon={faLightbulb} />
                </div>
                <span>ヒント</span>
              </button>
            )}

            <button
              className="puzzle-button select-button"
              onClick={() => setShowStageSelect(!showStageSelect)}
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
              <span>ステージ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Information Area */}
      <div id="information" className="p-4">
        <p style={{ whiteSpace: "pre-wrap" }}>
          {gameState.isCompleted && "🎉 ステージクリア！ 🎉"}
          {selectedPiece && !gameState.isCompleted && `駒${selectedPiece}が選択中 - ドラッグまたは矢印キーで移動`}
        </p>
      </div>

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
          border: "2px solid #999",
          borderRadius: "8px",
          margin: "10px 0",
          position: "relative",
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
            imageRendering: "pixelated",
            cursor: "pointer",
            borderRadius: "6px",
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
          <div className="puzzle-modal-overlay">
            <div className="puzzle-modal">
              <div className="puzzle-modal-header">
                <h3 className="puzzle-modal-title">ステージを選択</h3>
                <button
                  onClick={() => setShowStageSelect(false)}
                  className="puzzle-modal-close"
                >
                  ✕
                </button>
              </div>
              <div className="puzzle-modal-content">
                <div className="stage-grid">
                  {stages.map((stage) => (
                    <button
                      key={stage.id}
                      onClick={() => {
                        setCurrentStage(stage);
                        setGameState({
                          pieces: { ...stage.startPositions },
                          moves: 0,
                          isCompleted: false,
                        });
                        setSelectedPiece(null);
                        setShowStageSelect(false);
                      }}
                      className={`stage-button ${
                        currentStage?.id === stage.id ? 'active' : ''
                      }`}
                    >
                      <div className="stage-number">#{stage.id}</div>
                      <div className="stage-difficulty">{stage.difficulty}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ヒント表示 */}
      {showSolution && currentStage?.solutionPath && (
        <div className="hint-panel">
          <div className="hint-header">
            解法ヒント: ステップ {hintStep + 1} / {currentStage.solutionPath.length}
          </div>
          <div className="hint-controls">
            <button
              onClick={() => setIsPlayingHint(!isPlayingHint)}
              className="puzzle-button hint-button"
            >
              {isPlayingHint ? '停止' : '再生'}
            </button>
            <button
              onClick={() => {
                setHintStep(0);
                setIsPlayingHint(false);
                setIsHintPaused(false);
              }}
              className="puzzle-button reset-button"
            >
              リセット
            </button>
          </div>
          {currentStage.solutionPath[hintStep] && (
            <div className="hint-instruction">
              駒{currentStage.solutionPath[hintStep].piece}を
              {currentStage.solutionPath[hintStep].direction === 'up' && '上'}
              {currentStage.solutionPath[hintStep].direction === 'down' && '下'}
              {currentStage.solutionPath[hintStep].direction === 'left' && '左'}
              {currentStage.solutionPath[hintStep].direction === 'right' && '右'}
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
                      setGameState({
                        pieces: { ...currentStage.startPositions },
                        moves: 0,
                        isCompleted: false,
                      });
                      setSelectedPiece(null);
                    }
                  }}
                  className="puzzle-button retry-button"
                >
                  もう一度
                </button>
                {stages.length > 1 && currentStage && currentStage.id < stages.length && (
                  <button
                    onClick={() => {
                      const nextStage = stages.find(s => s.id === currentStage.id + 1);
                      if (nextStage) {
                        setCurrentStage(nextStage);
                        setGameState({
                          pieces: { ...nextStage.startPositions },
                          moves: 0,
                          isCompleted: false,
                        });
                        setSelectedPiece(null);
                      }
                    }}
                    className="puzzle-button next-button"
                  >
                    次のステージ
                  </button>
                )}
                <button
                  onClick={() => setShowStageSelect(true)}
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
                <h3 className="text-base sm:text-lg font-bold text-slate-200">GAME GUIDE</h3>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              </div>
              <p className="text-slate-300 leading-relaxed mb-3 sm:mb-4 text-sm sm:text-base">
                3つの駒を目標位置まで移動させよう！<br />
                駒をドラッグ&スワイプで氷上を滑るように移動します。
              </p>
              {selectedPiece && (
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-lg sm:rounded-xl">
                  <div className="w-5 sm:w-6 h-5 sm:h-6 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center text-white text-xs sm:text-sm font-bold">
                    {selectedPiece}
                  </div>
                  <span className="text-yellow-300 font-medium text-xs sm:text-sm">駒が選択中 - 矢印キーでも移動可能</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlidingPuzzleScreen;
