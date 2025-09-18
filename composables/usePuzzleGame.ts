/* eslint @typescript-eslint/no-explicit-any: off */

import { useState, useEffect, useCallback } from "react";

export interface GameState {
  pieces: { [key: number]: [number, number] };
  moves: number;
  isCompleted: boolean;
}

interface MazeCell {
  isWall: boolean;
  isPath: boolean;
}

export interface Stage {
  id: number;
  name: string;
  maze: MazeCell[][];
  startPositions: { [key: number]: [number, number] };
  goalPositions: { [key: number]: [number, number] };
  description: string;
  optimalMoves?: number;
  solutionPath?: any[];
  verified?: boolean;
}

const MAZE_SIZE = 11;
const CLEARED_STAGES_KEY = "sliding_puzzle_cleared_stages2";

export const usePuzzleGame = () => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    pieces: {},
    moves: 0,
    isCompleted: false,
  });
  const [gameHistory, setGameHistory] = useState<GameState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [clearedStages, setClearedStages] = useState<Set<number>>(new Set());

  // ステージの位置データを適切な型に変換するヘルパー関数
  const convertPositions = useCallback((positions: {
    [key: string]: [number, number] | number[];
  }): { [key: number]: [number, number] } => {
    return Object.fromEntries(
      Object.entries(positions).map(([key, pos]) => [
        parseInt(key),
        Array.isArray(pos) ? ([pos[0], pos[1]] as [number, number]) : pos,
      ])
    ) as { [key: number]: [number, number] };
  }, []);

  // LocalStorageからクリア済みステージを読み込む
  const loadClearedStages = useCallback((): Set<number> => {
    if (typeof window === "undefined") return new Set();

    try {
      const saved = localStorage.getItem(CLEARED_STAGES_KEY);
      if (saved) {
        const stageArray = JSON.parse(saved) as number[];
        return new Set(stageArray);
      }
    } catch (error) {
      console.error("Failed to load cleared stages from localStorage:", error);
    }
    return new Set();
  }, []);

  // LocalStorageにクリア済みステージを保存する
  const saveClearedStages = useCallback((stages: Set<number>) => {
    if (typeof window === "undefined") return;

    try {
      const stageArray = Array.from(stages);
      localStorage.setItem(CLEARED_STAGES_KEY, JSON.stringify(stageArray));
    } catch (error) {
      console.error("Failed to save cleared stages to localStorage:", error);
    }
  }, []);

  // 履歴にゲーム状態を追加
  const addToHistory = useCallback(
    (newState: GameState) => {
      setGameHistory((prev) => {
        const newHistory = prev.slice(0, currentHistoryIndex + 1);
        newHistory.push(newState);
        return newHistory;
      });
      setCurrentHistoryIndex((prev) => prev + 1);
    },
    [currentHistoryIndex]
  );

  // 勝利条件チェック
  const checkWinCondition = useCallback(
    (newPieces?: { [key: number]: [number, number] }, isPlayingHint?: boolean) => {
      if (!currentStage) return false;

      // ヒント再生中はクリア判定しない
      if (isPlayingHint) return false;

      // 既にクリア済みの場合は処理しない
      if (gameState.isCompleted) return false;

      const piecesToCheck = newPieces || gameState.pieces;

      const isWin = Object.entries(currentStage.goalPositions).every(
        ([pieceId, [goalX, goalY]]) => {
          const id = parseInt(pieceId);
          const [currentX, currentY] = piecesToCheck[id];
          return currentX === goalX && currentY === goalY;
        }
      );

      if (isWin) {
        setGameState((prev) => ({ ...prev, isCompleted: true }));
        // ステージクリア時にクリア済みステージに追加
        if (currentStage?.id) {
          setClearedStages((prev) => {
            const newClearedStages = new Set(prev);
            newClearedStages.add(currentStage.id);
            if (currentStage.id < 64) {
              // 次のステージをアンロック
            }
            saveClearedStages(newClearedStages);
            return newClearedStages;
          });
        }
        return true;
      }
      return false;
    },
    [currentStage, gameState.pieces, gameState.isCompleted, saveClearedStages]
  );

  // 一手戻る
  const stepBackward = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const prevState = gameHistory[currentHistoryIndex - 1];
      setGameState(prevState);
      setCurrentHistoryIndex((prev) => prev - 1);
      return true;
    }
    return false;
  }, [currentHistoryIndex, gameHistory]);

  // 一手進める
  const stepForward = useCallback(() => {
    if (currentHistoryIndex < gameHistory.length - 1) {
      const nextState = gameHistory[currentHistoryIndex + 1];
      setGameState(nextState);
      setCurrentHistoryIndex((prev) => prev + 1);
      return true;
    }
    return false;
  }, [currentHistoryIndex, gameHistory]);

  // ゲームリセット
  const resetGame = useCallback(() => {
    if (currentStage) {
      const resetState = {
        pieces: convertPositions(currentStage.startPositions),
        moves: 0,
        isCompleted: false,
      };
      setGameState(resetState);
      setGameHistory([resetState]);
      setCurrentHistoryIndex(0);
    }
  }, [currentStage, convertPositions]);

  // ステージ選択
  const selectStage = useCallback((stage: Stage) => {
    setCurrentStage(stage);
    const newState = {
      pieces: convertPositions(stage.startPositions),
      moves: 0,
      isCompleted: false,
    };
    setGameState(newState);
    setGameHistory([newState]);
    setCurrentHistoryIndex(0);
  }, [convertPositions]);

  // 駒を移動させる
  const updatePiecePosition = useCallback(
    (pieceId: number, newX: number, newY: number) => {
      const updatedPieces: { [key: number]: [number, number] } = {
        ...gameState.pieces,
        [pieceId]: [newX, newY],
      };

      const newState: GameState = {
        pieces: updatedPieces,
        moves: gameState.moves + 1,
        isCompleted: false,
      };

      setGameState(newState);
      addToHistory(newState);

      return updatedPieces;
    },
    [gameState, addToHistory]
  );

  // クリア済みステージの初期化
  useEffect(() => {
    setClearedStages(loadClearedStages());
  }, [loadClearedStages]);

  // ステージデータをロード
  useEffect(() => {
    const loadStages = async () => {
      try {
        const response = await fetch("/sliding_puzzle_stages.json");
        if (!response.ok) throw new Error("Failed to load stages");
        const data = await response.json();
        setStages(data);
        if (data.length > 0) {
          const firstStage = data[0];
          setCurrentStage(firstStage);
          const initialState = {
            pieces: convertPositions(firstStage.startPositions),
            moves: 0,
            isCompleted: false,
          };
          setGameState(initialState);
          setGameHistory([initialState]);
          setCurrentHistoryIndex(0);
        }
      } catch (error) {
        console.error("Error loading stages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStages();
  }, [convertPositions]);

  return {
    // State
    stages,
    currentStage,
    gameState,
    gameHistory,
    currentHistoryIndex,
    isLoading,
    clearedStages,

    // Actions
    convertPositions,
    addToHistory,
    checkWinCondition,
    stepBackward,
    stepForward,
    resetGame,
    selectStage,
    updatePiecePosition,

    // Constants
    MAZE_SIZE,
  };
};
