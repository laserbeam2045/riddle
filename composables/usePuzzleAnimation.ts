import { useState, useCallback, useRef, useEffect } from "react";

interface AnimatingPiece {
  from: [number, number];
  to: [number, number];
  progress: number;
}

export interface MoveQueueItem {
  pieceId: number;
  direction: "up" | "down" | "left" | "right";
}

export const usePuzzleAnimation = () => {
  const [animatingPieces, setAnimatingPieces] = useState<{
    [key: number]: AnimatingPiece;
  }>({});
  const [moveQueue, setMoveQueue] = useState<MoveQueueItem[]>([]);
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  const animationRefs = useRef<{ [key: number]: number }>({});

  // EaseInOut関数
  const easeInOut = useCallback((t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }, []);

  // アニメーションの開始
  const startAnimation = useCallback(
    (
      pieceId: number,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      onComplete: (pieceId: number, newX: number, newY: number) => void,
      onSoundPlay?: () => void,
      onSoundStop?: () => void
    ) => {
      // スライド音を再生
      if (onSoundPlay) onSoundPlay();

      // アニメーション設定
      setAnimatingPieces((prev) => ({
        ...prev,
        [pieceId]: {
          from: [fromX, fromY],
          to: [toX, toY],
          progress: 0,
        },
      }));

      // 移動距離に応じてアニメーション時間を計算
      const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY);
      const baseTime = 100; // 1マスあたりの基本時間（ms）
      const animationDuration = Math.max(baseTime * distance, 180);

      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        const easedProgress = easeInOut(progress);

        setAnimatingPieces((prev) => ({
          ...prev,
          [pieceId]: {
            from: [fromX, fromY],
            to: [toX, toY],
            progress: easedProgress,
          },
        }));

        if (progress >= 1) {
          // アニメーション完了
          setAnimatingPieces((prev) => {
            const newState = { ...prev };
            delete newState[pieceId];
            return newState;
          });

          // アニメーションrefも削除
          if (animationRefs.current[pieceId]) {
            delete animationRefs.current[pieceId];
          }

          // スライド音を停止
          if (onSoundStop) onSoundStop();

          // 完了コールバック実行
          onComplete(pieceId, toX, toY);

          // 移動完了後、キュー処理を継続
          setIsProcessingMove(false);
        } else {
          animationRefs.current[pieceId] = requestAnimationFrame(animate);
        }
      };

      // 既存のアニメーションをキャンセル
      if (animationRefs.current[pieceId]) {
        cancelAnimationFrame(animationRefs.current[pieceId]);
        delete animationRefs.current[pieceId];
      }

      animationRefs.current[pieceId] = requestAnimationFrame(animate);
    },
    [easeInOut]
  );

  // キューに移動を追加
  const queueMove = useCallback((pieceId: number, direction: "up" | "down" | "left" | "right") => {
    setMoveQueue((prev) => [...prev, { pieceId, direction }]);
  }, []);

  // キュー処理システム
  const processNextMove = useCallback((
    executeMove: (pieceId: number, direction: "up" | "down" | "left" | "right") => boolean
  ) => {
    if (isProcessingMove || moveQueue.length === 0) return;

    setIsProcessingMove(true);
    const nextMove = moveQueue[0];
    setMoveQueue((prev) => prev.slice(1));

    // 実際の移動を実行
    const moved = executeMove(nextMove.pieceId, nextMove.direction);

    // 移動しなかった場合は即座に次へ
    if (!moved) {
      setIsProcessingMove(false);
    }
  }, [isProcessingMove, moveQueue]);

  // キューの変化を監視して自動処理
  useEffect(() => {
    // この処理は親コンポーネントで呼び出される必要がある
  }, [moveQueue, isProcessingMove]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      // 全ての駒のアニメーションをキャンセル
      Object.values(animationRefs.current).forEach((animationId) => {
        cancelAnimationFrame(animationId);
      });
      animationRefs.current = {};
    };
  }, []);

  return {
    animatingPieces,
    moveQueue,
    isProcessingMove,
    startAnimation,
    queueMove,
    processNextMove,
    setIsProcessingMove,
  };
};