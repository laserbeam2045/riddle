import React, { useState } from "react";

interface HintModalProps {
  hint: string | undefined;
  onClose: () => void;
}

const HintModal: React.FC<HintModalProps> = ({ hint, onClose }) => {
  const [showConfirmation, setShowConfirmation] = useState(true);

  const handleConfirm = () => {
    setShowConfirmation(false); // 確認画面を非表示にし、ヒントを表示
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      {" "}
      {/* backdrop-blur-lg と bg-black/80 に変更 */}
      <div className="hint-modal bg-gray-800/80 backdrop-blur-md border border-gray-600 p-8 rounded-xl shadow-2xl max-w-md w-full">
        {" "}
        {/* backdrop-blur-md と bg-gray-800/80 に変更 */}
        {showConfirmation ? (
          // 確認画面
          <>
            <h3 className="text-xl font-bold text-yellow-400 mb-6 text-center">
              ヒントを見ますか？
            </h3>
            <div className="flex justify-center space-x-4">
              <button
                className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                onClick={handleConfirm}
              >
                はい
              </button>
              <button
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                onClick={onClose} // いいえの場合はモーダルを閉じる
              >
                いいえ
              </button>
            </div>
          </>
        ) : (
          // ヒント表示画面
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-yellow-400">ヒント</h3>
              <button
                className="text-gray-400 hover:text-white"
                onClick={onClose}
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p className="text-gray-300 whitespace-pre-line">
              {hint || "ヒントはありません。"}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default HintModal;
