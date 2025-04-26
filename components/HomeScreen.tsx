import React from "react";
import Link from "next/link"; // Import Link component

interface HomeScreenProps {
  onStartQuiz: () => void;
  onStartPuzzle: () => void; // パズルゲーム開始用のプロップを追加
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartQuiz,
  onStartPuzzle,
}) => {
  // onStartPuzzle を受け取る
  return (
    <div className="hero text-center py-12 flex flex-col items-center justify-center flex-grow">
      <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-purple-600 inline-block text-transparent bg-clip-text">
        頭脳の限界を超えろ！
      </h1>
      <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
        様々なカテゴリーの問題に挑戦して、リドルマスターの称号を手に入れよう！
        パズルゲームも追加されたぞ！
      </p>
      <div className="flex gap-4 flex-wrap justify-around">
        {" "}
        {/* ボタンを横並びにする */}
        <button
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          onClick={onStartQuiz}
        >
          謎解きをプレイ
        </button>
        <button // パズルゲーム開始ボタンを追加
          className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          onClick={onStartPuzzle}
        >
          パズルをプレイ
        </button>
        {/* Add Link to Cat Game */}
        <Link href="/catgame" passHref>
          <button className="bg-gradient-to-r from-green-400 to-teal-500 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            猫と鼠をプレイ
          </button>
        </Link>
      </div>
    </div>
  );
};

export default HomeScreen;
