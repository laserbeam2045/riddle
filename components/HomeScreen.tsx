import React from "react";
import Link from "next/link"; // Import Link component

interface HomeScreenProps {
  onStartQuiz: () => void;
  onStartPuzzle: () => void; // パズルゲーム開始用のプロップを追加
  onStartSlidingPuzzle: () => void; // スライディングパズル開始用のプロップを追加
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartQuiz,
  onStartPuzzle,
  onStartSlidingPuzzle,
}) => {
  return (
    <div className="hero text-center py-12 flex flex-col items-center justify-center flex-grow">
      <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-purple-600 inline-block text-transparent bg-clip-text">
        頭脳の限界を超えろ！
      </h1>
      <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
        様々な種類の問題に挑戦して、あなたの知的能力を試そう！
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        {/* ボタンをグリッドレイアウトに変更 */}
        <button
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          onClick={onStartQuiz}
        >
          謎解きをプレイ
        </button>
        <button
          className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          onClick={onStartPuzzle}
        >
          繋げるパズルをプレイ
        </button>
        <Link href="/catgame" passHref>
          <button className="bg-gradient-to-r from-green-400 to-teal-500 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            猫と鼠をプレイ
          </button>
        </Link>
        <button
          className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          onClick={onStartSlidingPuzzle}
        >
          The Three
        </button>
      </div>
    </div>
  );
};

export default HomeScreen;
