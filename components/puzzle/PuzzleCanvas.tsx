import React, { useRef, useEffect } from "react";

interface PuzzleCanvasProps {
  maze: { isWall: boolean; isPath: boolean }[][];
  pieces: { [key: number]: [number, number] };
  goalPositions: { [key: number]: [number, number] };
  selectedPiece: number | null;
  animatingPieces: {
    [key: number]: {
      from: [number, number];
      to: [number, number];
      progress: number;
    };
  };
  pieceImages: { [key: number]: HTMLImageElement };
  mazeSize: number;
  cellSize: number;
  imagesLoaded: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onTouchStart: (event: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchMove: (event: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLCanvasElement>) => void;
}

const PuzzleCanvas: React.FC<PuzzleCanvasProps> = ({
  maze,
  pieces,
  goalPositions,
  selectedPiece,
  animatingPieces,
  pieceImages,
  mazeSize,
  cellSize,
  imagesLoaded,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !maze) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 画像描画の品質を向上させる設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 道を描画
    for (let y = 0; y < maze.length; y++) {
      for (let x = 0; x < maze[y].length; x++) {
        const cell = maze[y][x];
        if (!cell.isWall) {
          ctx.fillStyle = "#f7fafc";
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          ctx.strokeStyle = "#e2e8f0";
          ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // 壁を描画
    for (let y = 0; y < maze.length; y++) {
      for (let x = 0; x < maze[y].length; x++) {
        const cell = maze[y][x];
        if (cell.isWall) {
          ctx.fillStyle = "#2d3748";
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // ゴール位置を画像の半透明で描画
    Object.entries(goalPositions).forEach(([pieceId, [x, y]]) => {
      const id = parseInt(pieceId);
      const goalImage = pieceImages[id];

      if (goalImage) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.drawImage(
          goalImage,
          x * cellSize - 0.0,
          y * cellSize - 0.0,
          cellSize + 0,
          cellSize + 0
        );
        ctx.restore();
      }
    });

    // 駒を描画
    Object.entries(pieces).forEach(([pieceId, [x, y]]) => {
      const id = parseInt(pieceId);
      const isSelected = selectedPiece === id;
      const pieceImage = pieceImages[id];

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
      const goalPosition = goalPositions[id];
      const isAtGoal =
        goalPosition && goalPosition[0] === x && goalPosition[1] === y;

      const drawX = renderX * cellSize;
      const drawY = renderY * cellSize;

      // ゴール位置にある駒に発光エフェクトを追加
      if (isAtGoal) {
        ctx.save();
        ctx.shadowColor = "#10b981";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      if (pieceImage) {
        ctx.drawImage(
          pieceImage,
          drawX - 0.0,
          drawY - 0.0,
          cellSize + 0,
          cellSize + 0
        );
      } else {
        // フォールバック用の色
        const colors = ["#e53e3e", "#3182ce", "#38a169"];
        ctx.fillStyle = colors[id - 1];
        ctx.fillRect(drawX - 0.0, drawY - 0.0, cellSize + 1, cellSize + 1);
      }

      // ゴール位置エフェクトのリストア
      if (isAtGoal) {
        ctx.restore();
      }

      // 選択状態の表示
      if (isSelected) {
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 3;
        ctx.strokeRect(drawX - 0.0, drawY - 0.0, cellSize + 1, cellSize + 1);
      }
    });
  }, [
    maze,
    pieces,
    goalPositions,
    selectedPiece,
    animatingPieces,
    pieceImages,
    cellSize,
    imagesLoaded,
  ]);

  return (
    <div
      id="game-container"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${mazeSize}, 1fr)`,
        gridTemplateRows: `repeat(${mazeSize}, 1fr)`,
        gap: "1px",
        width: "100vw",
        maxWidth: "440px",
        aspectRatio: "1",
        backgroundColor: "#ddd",
        border: "1px solid #999",
        borderRadius: "8px",
        margin: "10px 0",
        position: "relative",
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        width={mazeSize * cellSize}
        height={mazeSize * cellSize}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          imageRendering: "auto",
          cursor: "pointer",
          borderRadius: "6px",
          touchAction: "none",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    </div>
  );
};

export default PuzzleCanvas;