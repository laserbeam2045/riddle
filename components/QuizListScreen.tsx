import React from "react";
import { QuizData } from "../app/page"; // 型定義をインポート

interface QuizListScreenProps {
  quizData: QuizData;
  loading: boolean;
  completedStages: number[];
  handleStageSelect: (stage: number) => void;
  stageNames: string[];
}

const QuizListScreen: React.FC<QuizListScreenProps> = ({
  quizData,
  loading,
  completedStages,
  handleStageSelect,
  stageNames,
}) => {
  return (
    <div className="quiz-container w-full">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="quiz-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.keys(quizData).map((stageKey) => {
            const stageNumber = parseInt(stageKey);
            const stageName = stageNames[stageNumber - 1];
            const isCompleted = completedStages.includes(stageNumber);

            return (
              <div
                key={stageKey}
                className={`quiz-card bg-gray-800/50 rounded-xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 duration-300 ${
                  isCompleted ? "border-2 border-green-500" : ""
                }`}
              >
                <div
                  className={`h-40 bg-gradient-to-r ${
                    isCompleted
                      ? "from-green-600 to-teal-600"
                      : "from-indigo-500 to-purple-600"
                  } flex items-center justify-center relative`}
                >
                  <div className="text-3xl font-bold">{stageName}</div>
                  {isCompleted && (
                    <div className="absolute top-2 right-2 bg-white text-green-600 px-2 py-1 rounded-full text-xs font-bold">
                      クリア済み
                    </div>
                  )}
                </div>
                <div className="quiz-content p-6">
                  <div className="quiz-meta flex justify-between text-gray-400 text-sm mb-3">
                    <div>{quizData[stageNumber].length} 問</div>
                    <div>難易度: 普通</div>
                  </div>
                  <p className="quiz-description text-gray-300 mb-4">
                    {stageName}
                    に関する様々な問題に挑戦しよう。あなたの知恵をテストします！
                  </p>
                  <div className="quiz-footer flex justify-between items-center">
                    <div className="difficulty-meter flex items-center">
                      <span className="bg-green-500 inline-block w-2 h-2 rounded-full mr-1"></span>
                      <span className="bg-green-500 inline-block w-2 h-2 rounded-full mr-1"></span>
                      <span className="bg-green-500 inline-block w-2 h-2 rounded-full mr-1"></span>
                      <span className="bg-gray-500 inline-block w-2 h-2 rounded-full mr-1"></span>
                      <span className="bg-gray-500 inline-block w-2 h-2 rounded-full"></span>
                    </div>
                    <button
                      className={`${
                        isCompleted
                          ? "bg-gradient-to-r from-green-600 to-teal-600"
                          : "bg-gradient-to-r from-pink-500 to-purple-600"
                      } text-white py-2 px-5 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200`}
                      onClick={() => handleStageSelect(stageNumber)}
                    >
                      {isCompleted ? "もう一度プレイ" : "プレイする"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuizListScreen;
