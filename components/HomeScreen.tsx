import React from "react";

interface HomeScreenProps {
  onStartQuiz: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onStartQuiz }) => {
  return (
    <div className="hero text-center py-12 flex flex-col items-center justify-center flex-grow">
      <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-purple-600 inline-block text-transparent bg-clip-text">
        頭脳の限界を超えろ！
      </h1>
      <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
        様々なカテゴリーの問題に挑戦して、リドルマスターの称号を手に入れよう！
      </p>
      <button
        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
        onClick={onStartQuiz}
      >
        いますぐプレイ
      </button>
    </div>
  );
};

export default HomeScreen;
