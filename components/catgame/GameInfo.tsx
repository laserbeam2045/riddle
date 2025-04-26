/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"; // Add use client directive

import React from "react";
import { Player } from "./types";

// クリア状況の型
interface ClearStatus {
  cleared: boolean;
  optimal: boolean | null; // 最適クリアしたことがあるか (null: 未クリア)
}

interface GameInfoProps {
  currentPlayer: Player | null;
  turnCount: number;
  theoreticalMinTurns: number | string;
  message: string;
  graphId: string | number; // ステージIDを追加
  clearStatus: ClearStatus | null; // クリア状況を追加 (null: 読み込み中など)
  // Removed props related to answer button
}

const GameInfo: React.FC<GameInfoProps> = ({
  currentPlayer,
  turnCount,
  theoreticalMinTurns,
  message,
  graphId,
  clearStatus,
  // Removed props related to answer button
}) => {
  const getPlayerText = (player: Player | null): string => {
    if (player === "cat") return "ネコ";
    if (player === "mouse") return "ネズミ";
    return "-"; // Game ended or not started
  };

  const getClearStatusText = (): string => {
    if (!clearStatus) return ""; // まだ読み込めていない場合
    if (!clearStatus.cleared) return "未クリア";
    if (clearStatus.optimal) return "クリア済み (最短)";
    return "クリア済み";
  };

  return (
    // mt-5 を削除し、代わりに Game.tsx 側で上部のマージンを調整
    <div id="game-info" className="w-full text-lg text-white mb-4">
      {" "}
      {/* 下マージンを追加 */}
      <div className="flex justify-between items-start mb-2">
        {" "}
        {/* ステージ情報とターン情報を横並び */}
        <div>
          <p className="text-sm text-gray-400">ステージID: {graphId}</p>
          <p className="text-sm text-yellow-400 font-semibold">
            {getClearStatusText()}
          </p>
        </div>
        <div>
          {/* <p>
            ターン:{" "}
            <span id="turn" className="font-semibold text-yellow-300">
              {getPlayerText(currentPlayer)}
            </span>
          </p> */}
          <p>
            手数:{" "}
            <span id="turn-count" className="font-semibold text-gray-300">
              {turnCount}
            </span>
          </p>
          <p>
            最短手数:{" "}
            <span id="shortest-path" className="font-semibold text-gray-300">
              {theoreticalMinTurns}
            </span>
          </p>
        </div>
      </div>
      <p id="message" className="mt-1 text-base text-gray-200 text-center">
        {" "}
        {/* メッセージは中央寄せ */}
        {message || "\u00A0"}{" "}
        {/* メッセージがない場合はスペースを表示して高さを維持 */}
      </p>
      {/* Answer Button Removed */}
    </div>
  );
};

export default GameInfo;
