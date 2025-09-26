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

const MAZE_SIZE = 9;
const CLEARED_STAGES_KEY = "sliding_puzzle_cleared_stages8";

interface StageRecord {
  moves: number;
  timestamp: number;
}

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
  const [clearedStages, setClearedStages] = useState<Map<number, StageRecord>>(new Map());

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
  const loadClearedStages = useCallback((): Map<number, StageRecord> => {
    if (typeof window === "undefined") return new Map();

    try {
      const saved = localStorage.getItem(CLEARED_STAGES_KEY);
      if (saved) {
        const stageData = JSON.parse(saved) as Record<string, StageRecord>;
        const stageMap = new Map<number, StageRecord>();
        Object.entries(stageData).forEach(([stageId, record]) => {
          stageMap.set(parseInt(stageId), record);
        });
        return stageMap;
      }
    } catch (error) {
      console.error("Failed to load cleared stages from localStorage:", error);
    }
    return new Map();
  }, []);

  // LocalStorageにクリア済みステージを保存する
  const saveClearedStages = useCallback((stages: Map<number, StageRecord>) => {
    if (typeof window === "undefined") return;

    try {
      const stageObject: Record<string, StageRecord> = {};
      stages.forEach((record, stageId) => {
        stageObject[stageId.toString()] = record;
      });
      localStorage.setItem(CLEARED_STAGES_KEY, JSON.stringify(stageObject));
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
        // ステージクリア時にクリア手数を記録
        if (currentStage?.id) {
          setClearedStages((prev) => {
            const newClearedStages = new Map(prev);
            const currentRecord = newClearedStages.get(currentStage.id);
            const currentMoves = gameState.moves + 1; // 最後の移動を含める

            // 既存記録がない場合、または今回の手数が少ない場合のみ更新
            if (!currentRecord || currentMoves < currentRecord.moves) {
              // console.log(`Recording stage ${currentStage.id} with ${currentMoves} moves (improved from ${currentRecord?.moves || 'none'})`);
              newClearedStages.set(currentStage.id, {
                moves: currentMoves,
                timestamp: Date.now()
              });
            } else {
              // console.log(`Stage ${currentStage.id}: Not updating record. Current: ${currentMoves}, Best: ${currentRecord.moves}`);
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

  // 星評価を計算する
  const getStarRating = useCallback((stageId: number, optimalMoves: number) => {
    const record = clearedStages.get(stageId);
    if (!record) return { stars: 0, perfect: false }; // 未クリア

    const playerMoves = record.moves;
    // console.log(`Stage ${stageId}: playerMoves=${playerMoves}, optimalMoves=${optimalMoves}, clearedStages:`, clearedStages);
    if (playerMoves === optimalMoves) return { stars: 3, perfect: true }; // ★★★ + PERFECT
    if (playerMoves <= optimalMoves + 2) return { stars: 2, perfect: false }; // ★★☆
    return { stars: 1, perfect: false }; // ★☆☆
  }, [clearedStages]);

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
        const response = await fetch("/sliding_puzzle_stages2.json");
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
    getStarRating,

    // Constants
    MAZE_SIZE,
  };
};
