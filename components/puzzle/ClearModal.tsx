import React, { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Stage } from "../../composables/usePuzzleGame";

interface ClearModalProps {
  currentStage: Stage | null;
  moves: number;
  onRetry: () => void;
  onNextStage: () => void;
  onStageSelect: () => void;
  hasNextStage: boolean;
}

const ClearModal: React.FC<ClearModalProps> = ({
  currentStage,
  moves,
  onRetry,
  onNextStage,
  onStageSelect,
  hasNextStage,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // 紙吹雪エフェクト
  useEffect(() => {
    const fireConfetti = () => {
      const count = 200;
      const defaults = {
        origin: { y: 0.7 }
      };

      function fire(particleRatio: number, opts: confetti.Options) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      }

      // 複数回に分けて発射
      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });

      fire(0.2, {
        spread: 60,
      });

      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
      });

      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
      });

      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });

      // 金と紫の紙吹雪も追加
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#4B0082']
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#4B0082']
        });
      }, 300);
    };

    // モーダル表示時に紙吹雪を開始
    const timer = setTimeout(fireConfetti, 200);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* バックドロップ */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* モーダル */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md mx-auto"
      >
        {/* グラスモーフィズムコンテナ */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 shadow-2xl transform animate-pulse-scale">
          {/* 成功アイコン */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mb-4 animate-bounce shadow-lg">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
              STAGE CLEAR!
            </h2>
            <div className="w-16 h-1 bg-gradient-to-r from-yellow-400 to-purple-500 rounded-full mx-auto mb-4"></div>
          </div>

          {/* ステージ情報 */}
          <div className="text-center mb-8">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 mb-4">
              <p className="text-xl font-semibold text-white/90 mb-1">
                {currentStage?.name || `ステージ ${currentStage?.id}`}
              </p>
              <p className="text-lg text-yellow-300 font-bold">
                手数: {moves}
              </p>
            </div>

            {/* 星の表示 */}
            <div className="flex justify-center mb-4">
              {Array.from({ length: 3 }, (_, i) => {
                const optimalMoves = currentStage?.optimalMoves || 0;
                let earnedStars = 1; // デフォルトは1つ星

                if (optimalMoves > 0) {
                  if (moves <= optimalMoves) {
                    earnedStars = 3; // 最短手数なら3つ星
                  } else if (moves <= optimalMoves + 2) {
                    earnedStars = 2; // 最短手数+2以内なら2つ星
                  }
                }

                return (
                  <div
                    key={i}
                    className={`mx-1 text-2xl transform transition-all duration-500 ${
                      i < earnedStars
                        ? "text-yellow-400 animate-spin-slow"
                        : "text-gray-400"
                    }`}
                    style={{
                      animationDelay: `${i * 0.2}s`,
                    }}
                  >
                    ⭐
                  </div>
                );
              })}
            </div>
          </div>

          {/* ボタン */}
          <div className="space-y-3">
            <button
              onClick={onRetry}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-500/80 to-indigo-600/80 backdrop-blur-sm border border-white/20 text-white font-bold rounded-xl hover:from-blue-600/80 hover:to-indigo-700/80 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
            >
              もう一度
            </button>

            {hasNextStage && (
              <button
                onClick={onNextStage}
                className="w-full py-3 px-6 bg-gradient-to-r from-green-500/80 to-teal-600/80 backdrop-blur-sm border border-white/20 text-white font-bold rounded-xl hover:from-green-600/80 hover:to-teal-700/80 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
              >
                次のステージ
              </button>
            )}

            <button
              onClick={onStageSelect}
              className="w-full py-3 px-6 bg-gradient-to-r from-purple-500/80 to-pink-600/80 backdrop-blur-sm border border-white/20 text-white font-bold rounded-xl hover:from-purple-600/80 hover:to-pink-700/80 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
            >
              ステージ選択
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-scale {
          0% {
            transform: scale(0.9);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-pulse-scale {
          animation: pulse-scale 0.5s ease-out;
        }

        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default ClearModal;