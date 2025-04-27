"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import Confetti from "react-confetti";
import GraphDisplay from "./GraphDisplay";
import GameInfo from "./GameInfo";
import { GameState, StageData, NodeData, LinkData } from "./types";

type AdjacencyList = { [key: string]: string[] };

interface CatGameProps {
  stageData: StageData;
  onStageClear: () => void;
  isPlaybackActive: boolean;
  playbackMessage: string;
  currentPlaybackState?: [string, string];
  playMove?: () => void;
  playCat?: () => void;
}

// クリア履歴の型定義
interface ClearHistoryEntry {
  graphId: string | number;
  playerMoves: number;
  minMoves: number;
  isOptimal: boolean;
  timestamp: number;
}

// クリア状況の型 (GameInfo と共通)
interface ClearStatus {
  cleared: boolean;
  optimal: boolean | null;
}

// Minimax計算用の型
type Memo = { [key: string]: number };
const MAX_AI_DEPTH = 20; 

const CatGame: React.FC<CatGameProps> = ({
  stageData,
  onStageClear,
  isPlaybackActive,
  playbackMessage,
  currentPlaybackState,
  playMove,
  playCat,
}) => {
  const graphDisplayData = useMemo(() => {
    // Nodes are already in NodeData format
    const nodes: NodeData[] = stageData.nodes;

    // Links need conversion from [number, number] to LinkData { source: string, target: string }
    const links: LinkData[] = stageData.edges.map(([u, v]) => ({
      source: u.toString(),
      target: v.toString(),
    }));

    // Build adjacency list (still needed for game logic like highlighting)
    const adj: AdjacencyList = {};
    nodes.forEach((node) => {
      // Use node.id which is already a string in NodeData
      adj[node.id] = [];
    });
    links.forEach(({ source, target }) => {
      if (adj[source]) adj[source].push(target);
      if (adj[target]) adj[target].push(source); // Add edges in both directions
    });

    return { nodes, links, adj };
  }, [stageData]); // Recalculate when stageData changes

  // --- State ---
  const [gameState, setGameState] = useState<GameState>(() => ({
    // 初期化関数は初回のみ実行
    catNodeId: stageData.cat_start_node.toString(),
    mouseNodeId: stageData.mouse_start_node.toString(),
    currentPlayer: "cat",
    turnCount: 0,
    gameEnded: false,
    message: "猫のターン", // 初期メッセージ
  }));
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const memoRef = useRef<Memo>({});
  const [clearStatus, setClearStatus] = useState<ClearStatus | null>(null);

  // --- Effects ---

  // Window Resize Listener
  useEffect(() => {
    // クライアントサイドでのみ window オブジェクトにアクセス
    if (typeof window !== "undefined") {
      const handleResize = () => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener("resize", handleResize);
      handleResize(); // 初期サイズを設定
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Load Clear Status from LocalStorage when stageData changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    const historyKey = "cat-mouse-game-history";
    const status: ClearStatus = { cleared: false, optimal: null };
    try {
      const existingHistoryRaw = localStorage.getItem(historyKey);
      const existingHistory: ClearHistoryEntry[] = existingHistoryRaw
        ? JSON.parse(existingHistoryRaw)
        : [];
      const stageHistory = existingHistory.filter(
        (entry) => entry.graphId === stageData.graph_id
      );

      if (stageHistory.length > 0) {
        status.cleared = true;
        // 最適クリアしたことがあるかチェック
        status.optimal = stageHistory.some((entry) => entry.isOptimal);
      }
    } catch (error) {
      console.error("LocalStorage からクリア履歴の読み込みに失敗:", error);
    }
    setClearStatus(status);

    // Reset game state when stage changes
    setGameState({
      catNodeId: stageData.cat_start_node.toString(),
      mouseNodeId: stageData.mouse_start_node.toString(),
      currentPlayer: "cat",
      turnCount: 0,
      gameEnded: false,
      message: "猫のターン",
    });
    setShowConfetti(false);
  }, [stageData]);

  // Confetti Timer
  useEffect(() => {
    // 紙吹雪表示タイマー
    if (showConfetti) {
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
      return () => clearTimeout(timer); // クリーンアップ
    }
  }, [showConfetti]);

  // --- クリア時にonStageClearを一度だけ呼ぶ ---
  const prevGameEndedRef = useRef(false);
  useEffect(() => {
    if (
      gameState.gameEnded &&
      gameState.catNodeId === gameState.mouseNodeId &&
      !prevGameEndedRef.current
    ) {
      onStageClear();
    }
    prevGameEndedRef.current = gameState.gameEnded;
  }, [gameState.gameEnded, gameState.catNodeId, gameState.mouseNodeId, onStageClear]);

  // --- Callbacks ---

  // Save Clear History
  const saveClearHistory = useCallback(
    // クリア履歴保存
    (playerMoves: number) => {
      if (typeof window === "undefined" || !window.localStorage) return;
      const historyKey = "cat-mouse-game-history";
      const newEntry: ClearHistoryEntry = {
        graphId: stageData.graph_id,
        playerMoves: playerMoves,
        minMoves: stageData.minimax_cat_moves,
        isOptimal: playerMoves <= stageData.minimax_cat_moves,
        timestamp: Date.now(),
      };
      try {
        const existingHistoryRaw = localStorage.getItem(historyKey);
        const existingHistory: ClearHistoryEntry[] = existingHistoryRaw
          ? JSON.parse(existingHistoryRaw)
          : [];
        localStorage.setItem(
          historyKey,
          JSON.stringify([...existingHistory, newEntry])
        );
        console.log("クリア履歴を保存しました:", newEntry);
        // 保存後にクリアステータスを即時更新
        setClearStatus({
          cleared: true,
          optimal: newEntry.isOptimal || clearStatus?.optimal || false,
        });
      } catch (error) {
        console.error("LocalStorage への保存に失敗しました:", error);
      }
    },
    [stageData.graph_id, stageData.minimax_cat_moves, clearStatus]
  );

  // Minimax Calculation Helper
  const calculateMinimaxMove = useCallback(
    // Minimax計算 (鼠AI用)
    (
      currentGraph: AdjacencyList,
      catPos: string,
      mousePos: string,
      turn: "cat" | "mouse",
      depth: number,
      maxDepth: number,
      visited: Set<string>
    ): number => {
      // 終了条件
      if (catPos === mousePos) return 0; // Cat catches mouse
      if (depth >= maxDepth) return Infinity; // Depth limit reached, assume mouse escapes

      // メモ化キー (depth を含める)
      const stateKey = `${catPos}-${mousePos}-${turn}-${depth}`;
      if (memoRef.current[stateKey] !== undefined) {
        return memoRef.current[stateKey];
      }

      // ループ検出 (visited は Set<string> のまま)
      const loopCheckKey = `${catPos}-${mousePos}-${turn}`;
      if (visited.has(loopCheckKey)) return Infinity;
      visited.add(loopCheckKey);

      let result: number;
      // 猫ターン (最小化)
      if (turn === "cat") {
        const catNeighbors = currentGraph[catPos] ?? [];
        let minValue = Infinity;
        for (const nextCatPos of catNeighbors) {
          let value: number;
          if (nextCatPos === mousePos) {
            // 一手で捕獲
            value = 1;
          } else {
            // 再帰探索
            const sub = calculateMinimaxMove(
              currentGraph,
              nextCatPos,
              mousePos,
              "mouse",
              depth + 1,
              maxDepth,
              new Set(visited)
            );
            // 捕獲可能経路のみ +1
            value = sub === Infinity ? Infinity : sub + 1;
          }
          minValue = Math.min(minValue, value);
        }
        result = minValue;
      }
      // 鼠ターン (最大化)
      else {
        const mouseNeighbors = currentGraph[mousePos] ?? [];
        let maxValue = -Infinity;
        for (const nextMousePos of mouseNeighbors) {
          let value: number;
          if (nextMousePos === catPos) {
            // ネズミが猫と衝突 → 即ゲームオーバー
            value = 0;
          } else {
            // 再帰探索
            value = calculateMinimaxMove(
              currentGraph,
              catPos,
              nextMousePos,
              "cat",
              depth + 1,
              maxDepth,
              new Set(visited)
            );
          }
          maxValue = Math.max(maxValue, value);
        }
        result = maxValue;
      }
      visited.delete(loopCheckKey);
      memoRef.current[stateKey] = result; // メモ化
      return result;
    },
    [] // 依存配列なし
  );

  // Mouse Move Logic (AI)
  const moveMouse = useCallback(() => {
    // 鼠の移動 (AI)
    setGameState((prev) => {
      if (prev.gameEnded || prev.currentPlayer !== "mouse") return prev;
      const possibleMoves = graphDisplayData.adj[prev.mouseNodeId] ?? [];
      const validMoves = possibleMoves.filter(
        (move) => move !== prev.catNodeId
      ); // 猫の位置は除外
      // 鼠が動けない場合
      if (validMoves.length === 0) {
        console.warn("Mouse is trapped!");
        const canCatCatchNext = (
          graphDisplayData.adj[prev.catNodeId] ?? []
        ).includes(prev.mouseNodeId);
        if (canCatCatchNext) {
          return {
            ...prev,
            currentPlayer: "cat",
            message: "鼠は追い詰められた！猫のターンです。",
          };
        } else {
          return {
            ...prev,
            currentPlayer: "cat",
            message: "膠着状態？猫のターンです。",
          };
        }
      }
      // 最善手を選択
      let bestMove = validMoves[0];
      let maxEval = -Infinity;
      memoRef.current = {}; // メモクリア
      for (const nextMousePos of validMoves) {
        const evaluation = calculateMinimaxMove(
          graphDisplayData.adj,
          prev.catNodeId,
          nextMousePos,
          "cat",
          0,
          MAX_AI_DEPTH,
          new Set<string>()
        );
        if (evaluation > maxEval) {
          maxEval = evaluation;
          bestMove = nextMousePos;
        }
        if (maxEval === Infinity) break; // 捕まらない手が最優先
      }
      // 予期せず負ける手を選んだ場合 (デバッグ用)
      if (bestMove === prev.catNodeId) {
        console.error("AI chose a losing move unexpectedly!");
        return {
          ...prev,
          mouseNodeId: bestMove,
          gameEnded: true,
          currentPlayer: null,
          message: `猫の勝ち！🎉 (鼠が移動した先に猫がいました)`,
        };
      }
      // 状態更新
      return {
        ...prev,
        mouseNodeId: bestMove,
        currentPlayer: "cat",
        message: "猫のターン",
      };
    });
  }, [graphDisplayData.adj, calculateMinimaxMove]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setGameState((prev) => {
        if (isPlaybackActive || prev.gameEnded || prev.currentPlayer !== "cat")
          return prev;
        if (graphDisplayData.adj[prev.catNodeId]?.includes(nodeId)) {
          const newCatNodeId = nodeId;
          const newTurnCount = prev.turnCount + 1;
          if (newCatNodeId === prev.mouseNodeId) {
            saveClearHistory(newTurnCount);
            setShowConfetti(true);
            const isOptimal = newTurnCount <= stageData.minimax_cat_moves;
            const resultMessage = isOptimal
              ? `最短手数 (${stageData.minimax_cat_moves}手) でクリア！🎉`
              : `クリア！ (${newTurnCount}手) - 最短: ${stageData.minimax_cat_moves}手`;
            return {
              ...prev,
              catNodeId: newCatNodeId,
              turnCount: newTurnCount,
              gameEnded: true,
              currentPlayer: null,
              message: resultMessage,
            };
          } else {
            playMove && playMove();
          }
          setTimeout(moveMouse, 700);
          return {
            ...prev,
            catNodeId: newCatNodeId,
            turnCount: newTurnCount,
            currentPlayer: "mouse",
            message: "鼠のターン",
          };
        }
        else if (nodeId === prev.catNodeId) {
          return {
            ...prev,
            message: "現在地に留まることはできません。",
          };
        } else {
          return {
            ...prev,
            message: `そこへは移動できません。`,
          };
        }
      });
    },
    [isPlaybackActive, graphDisplayData.adj, moveMouse, saveClearHistory, stageData.minimax_cat_moves, playMove]
  );

  // --- Render ---

  // Determine display values based on playback state
  const displayCatNodeId =
    isPlaybackActive && currentPlaybackState
      ? currentPlaybackState[0]
      : gameState.catNodeId;
  const displayMouseNodeId =
    isPlaybackActive && currentPlaybackState
      ? currentPlaybackState[1]
      : gameState.mouseNodeId;
  const displayMessage = isPlaybackActive ? playbackMessage : gameState.message;
  const displayCurrentPlayer = isPlaybackActive
    ? null
    : gameState.currentPlayer;

  return (
    // Layout adjustment
    <div className="flex flex-col items-center p-4 relative w-full max-w-3xl mx-auto">
      {" "}
      {/* 最大幅と中央寄せ */}
      {/* Confetti Effect */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false} // 一度きり
          numberOfPieces={300} // 量
          gravity={0.15} // 落下速度
          style={{ position: "fixed", top: 0, left: 0, zIndex: 1000 }} // 画面全体に表示
        />
      )}
      {/* Game Info Area */}
      <GameInfo
        currentPlayer={displayCurrentPlayer} 
        turnCount={gameState.turnCount} 
        theoreticalMinTurns={stageData.minimax_cat_moves}
        message={displayMessage} 
        graphId={stageData.graph_id}
        clearStatus={clearStatus}
      />
      {/* Graph Display Area */}
      <div className="w-full h-[auto] mb-4">
        <GraphDisplay
          catNodeId={displayCatNodeId} 
          mouseNodeId={displayMouseNodeId} 
          currentPlayer={displayCurrentPlayer} 
          onNodeClick={handleNodeClick}
          nodes={graphDisplayData.nodes}
          links={graphDisplayData.links}
          adj={graphDisplayData.adj}
        />
      </div>
    </div>
  );
};

export default CatGame;
