import React, { useState, useEffect } from "react"; // useState, useEffect をインポート
import Confetti from "react-confetti";
// import { useWindowSize } from "react-use"; // useWindowSize は不要になる

interface Answer {
  question: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
}

interface ResultsScreenProps {
  isAnswered: boolean;
  feedbackType: "correct" | "incorrect" | "";
  correctAnswersCount: number;
  totalTime: number;
  formatTime: (seconds: number) => string;
  scorePercentage: number;
  answers: Answer[];
  handleRetry: () => void;
  handleReturnToSelection: () => void;
}

const ResultsScreen: React.FC<ResultsScreenProps> = ({
  isAnswered,
  feedbackType,
  // width, // 削除
  // height, // 削除
  correctAnswersCount,
  totalTime,
  formatTime,
  scorePercentage,
  answers,
  handleRetry,
  handleReturnToSelection,
}) => {
  // const { width, height } = useWindowSize(); // useWindowSize の代わりに state と effect を使用
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: window.innerWidth, // 幅は innerWidth を使う
        height: document.documentElement.clientHeight, // 高さは clientHeight を使う
      });
    };
    // 初期サイズを設定し、リサイズ時にも更新
    updateSize();
    window.addEventListener("resize", updateSize);
    // クリーンアップ関数
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div className="results-container max-w-4xl mx-auto w-full">
      {isAnswered &&
        feedbackType === "correct" &&
        windowSize.height > 0 && ( // height > 0 のチェックを追加
          <Confetti
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 9999,
            }}
            run={true}
            width={windowSize.width}
            height={windowSize.height}
            numberOfPieces={500}
            recycle={false}
            gravity={0.3}
          />
        )}
      <div className="results-card bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
        <h2 className="text-3xl font-bold text-center mb-6">結果</h2>
        <div className="stats-grid grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="stat-card bg-gray-700/50 p-6 rounded-xl text-center">
            <div className="stat-value text-4xl font-bold text-purple-400 mb-2">
              {correctAnswersCount}
            </div>
            <div className="stat-label text-gray-400">正解数</div>
          </div>
          <div className="stat-card bg-gray-700/50 p-6 rounded-xl text-center">
            <div className="stat-value text-4xl font-bold text-yellow-400 mb-2">
              {formatTime(totalTime)}
            </div>
            <div className="stat-label text-gray-400">タイム</div>
          </div>
          <div className="stat-card bg-gray-700/50 p-6 rounded-xl text-center">
            <div className="stat-value text-4xl font-bold text-green-400 mb-2">
              {scorePercentage}%
            </div>
            <div className="stat-label text-gray-400">正解率</div>
          </div>
        </div>

        <div className="answers-review mb-8">
          <h3 className="text-xl font-bold mb-4">解答レビュー</h3>
          <div className="answers-list space-y-4">
            {answers.map((answer, index) => (
              <div
                key={index}
                className={`answer-item p-4 rounded-lg ${
                  answer.isCorrect
                    ? "bg-green-900/20 border border-green-800"
                    : "bg-red-900/20 border border-red-800"
                }`}
              >
                <div className="question text-lg font-medium mb-2">
                  {index + 1}. {answer.question}
                </div>
                <div className="flex flex-col md:flex-row justify-between">
                  <div
                    className={`your-answer ${
                      answer.isCorrect ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    <span className="font-bold">あなたの解答:</span>{" "}
                    {answer.userAnswer}
                  </div>
                  {!answer.isCorrect && (
                    <div className="correct-answer text-green-400">
                      <span className="font-bold">正解:</span>{" "}
                      {answer.correctAnswer}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="action-buttons flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-6">
          <button
            className="play-again bg-gradient-to-r from-blue-500 to-indigo-600 py-3 px-8 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            onClick={handleRetry}
          >
            もう一度プレイ
          </button>
          <button
            className="return-home bg-gradient-to-r from-purple-500 to-pink-600 py-3 px-8 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            onClick={handleReturnToSelection}
          >
            ステージ選択に戻る
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsScreen;
