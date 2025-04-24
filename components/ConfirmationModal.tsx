import React from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  message,
  confirmText = "はい", // デフォルトのボタンテキスト
  cancelText = "いいえ", // デフォルトのボタンテキスト
  onConfirm,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-window flex items-center justify-center z-50 p-4">
      <div className="confirmation-modal p-8 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl max-w-md w-full">
        <p className="text-lg text-white mb-6 text-center whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex justify-center space-x-4">
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            onClick={onClose}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
