import React from "react";
import { Question } from "../app/page"; // 型定義をインポート

interface GameScreenProps {
  currentStage: number | null;
  currentQuestionIndex: number;
  questions: Question[];
  elapsedTime: number;
  formatTime: (seconds: number) => string;
  handleHintToggle: () => void;
  currentQuestion: Question | undefined;
  isAnswered: boolean;
  feedback: { message: string; type: "correct" | "incorrect" | "" };
  handleNextQuestion: () => void;
  handleAnswerSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  userAnswer: string;
  setUserAnswer: (answer: string) => void;
  stageNames: string[];
  setScreen: (screen: "home" | "quiz-list" | "game" | "results") => void;
  sounds: { success: () => void }; // 必要なサウンド関数のみ
  setEndTime: (time: number | null) => void;
  setTimerActive: (active: boolean) => void;
  completedStages: number[];
  setCompletedStages: (stages: number[]) => void;
  saveCompletedStages: (stages: number[]) => void;
}

const GameScreen: React.FC<GameScreenProps> = ({
  currentStage,
  currentQuestionIndex,
  questions,
  elapsedTime,
  formatTime,
  handleHintToggle,
  currentQuestion,
  isAnswered,
  feedback,
  handleNextQuestion,
  handleAnswerSubmit,
  userAnswer,
  setUserAnswer,
  stageNames,
  setScreen,
  sounds,
  setEndTime,
  setTimerActive,
  completedStages,
  setCompletedStages,
  saveCompletedStages,
}) => {
  if (!currentQuestion || currentStage === null) {
    return <div>Loading...</div>; // または適切なローディング表示
  }

  return (
    <div className="game-container w-full max-w-4xl mx-auto">
      {/* ゲームヘッダー */}
      <div className="game-header flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <div className="game-info">
          <h2 className="text-2xl font-bold mb-2">
            {stageNames[currentStage - 1]}
          </h2>
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <div>
              問題 {currentQuestionIndex + 1}/{questions.length}
            </div>
            <div>経過時間: {formatTime(elapsedTime)}</div>
          </div>
        </div>
        <div className="controls flex items-center space-x-4">
          <button
            className="hint-button p-2 bg-yellow-600/30 text-yellow-400 rounded-lg hover:bg-yellow-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500"
            onClick={handleHintToggle}
            aria-label="ヒントを見る" // アクセシビリティのためのラベル
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 問題コンテンツ */}
      <div className="question-container grow-3 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
        <div className="question-body">
          <h3 className="text-xl font-bold mb-4">問題:</h3>
          <p className="text-lg mb-6 whitespace-pre-line">
            {currentQuestion.question}
          </p>

          {currentQuestion.imageUrl && (
            <div className="image-container mb-6 flex justify-center">
              <img
                src={currentQuestion.imageUrl}
                alt="問題の画像"
                className="max-w-full max-h-96 rounded-lg"
              />
            </div>
          )}

          {isAnswered ? (
            <div className="answer-result space-y-4">
              <div className="bg-[var(--success)] text-bold feedback-message p-4 rounded-lg text-lg font-medium text-center">
                {feedback.message}
              </div>
              {currentQuestion.explanation && (
                <div className="explanation mt-6 p-4 bg-gray-700/50 rounded-lg">
                  <h4 className="font-bold text-green-400 mb-2">解説:</h4>
                  <pre className="whitespace-pre-wrap text-gray-200 text-xs">
                    {currentQuestion.explanation}
                  </pre>
                </div>
              )}
              <div className="text-center mt-6">
                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    className="next-button bg-gradient-to-r from-blue-500 to-purple-600 py-3 px-8 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                    onClick={handleNextQuestion}
                  >
                    次の問題へ
                  </button>
                ) : (
                  <button
                    className="complete-button bg-gradient-to-r from-green-500 to-teal-600 py-3 px-8 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                    onClick={() => {
                      setScreen("results");
                      sounds.success();
                      setEndTime(Date.now());
                      setTimerActive(false);
                      // ステージクリアの記録
                      if (currentStage) {
                        const newCompletedStages = [...completedStages];
                        if (!completedStages.includes(currentStage)) {
                          newCompletedStages.push(currentStage);
                          setCompletedStages(newCompletedStages);
                          saveCompletedStages(newCompletedStages);
                        }
                      }
                    }}
                  >
                    結果を見る
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="answer-form">
              {feedback.type === "incorrect" && (
                <div
                  className={`feedback-message mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400 animate-pulse`}
                >
                  {feedback.message}
                </div>
              )}
              <form onSubmit={handleAnswerSubmit}>
                <div className="relative mb-6">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="解答を入力してください..."
                    required
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-pink-500 to-purple-600 p-2 rounded-lg shadow-md hover:shadow-lg transition-all"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
