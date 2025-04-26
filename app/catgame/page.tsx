"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useSound from "use-sound";
import CatGame from "@/components/catgame/Game";
import { StageData } from "@/components/catgame/types";

const LOCAL_STORAGE_KEY = "catGameClearedStages";
const PLAYBACK_INTERVAL_MS = 800; // Interval for answer playback steps

export default function CatGamePage() {
  const [allStages, setAllStages] = useState<StageData[]>([]);
  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [retryCounter, setRetryCounter] = useState(0);
  const [clearedStages, setClearedStages] = useState<Set<number>>(new Set());

  // Sound hook for cat sound
  const [playCat] = useSound("/sounds/cat.mp3", { volume: 0.5 });

  // State for answer playback (moved from Game.tsx)
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  // Removed unused playbackStep state
  const [playbackMessage, setPlaybackMessage] = useState("");
  const [currentPlaybackState, setCurrentPlaybackState] = useState<
    [string, string] | undefined
  >(undefined);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for interval timer

  const selectedStage =
    selectedStageIndex !== null && allStages[selectedStageIndex]
      ? allStages[selectedStageIndex]
      : null;

  useEffect(() => {
    // Fetch stage data
    fetch("/cat_mouse_stages.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data: StageData[]) => {
        if (data && data.length > 0) {
          setAllStages(data);
          setSelectedStageIndex(0); // Select the first stage by default
        } else {
          setError("No stages found or data is invalid.");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error loading stage data:", err);
        setError(`Failed to load stages: ${err.message}`);
        setIsLoading(false);
      });

    // Load cleared stages from localStorage on mount
    const storedClearedStages = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedClearedStages) {
      try {
        const parsedIndices: number[] = JSON.parse(storedClearedStages);
        setClearedStages(new Set(parsedIndices));
      } catch (e) {
        console.error("Failed to parse cleared stages from localStorage:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear invalid data
      }
    }
    // Reset playback state when loading new stages initially (or if fetch fails)
    setIsPlayingBack(false);
    // Removed playbackStep reset
    setPlaybackMessage("");
    setCurrentPlaybackState(undefined);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  }, []);

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  // Reset playback when stage changes
  useEffect(() => {
    setIsPlayingBack(false);
    // Removed playbackStep reset
    setPlaybackMessage("");
    setCurrentPlaybackState(undefined);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  }, [selectedStageIndex]); // Depend on selectedStageIndex

  // --- Handlers ---

  const handleStageSelect = useCallback((index: number) => {
    setSelectedStageIndex(index);
    setIsStageModalOpen(false);
    setRetryCounter(0);
    // Play sound?
  }, []);

  const handleRetry = useCallback(() => {
    setRetryCounter((prev) => prev + 1); // Reset game state via key prop
    // Reset playback state on retry as well
    setIsPlayingBack(false);
    // Removed playbackStep reset
    setPlaybackMessage("");
    setCurrentPlaybackState(undefined);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    // Play sound?
  }, []);

  const handleStageClear = useCallback(
    (stageIndex: number) => {
      setClearedStages((prevCleared) => {
        const newCleared = new Set(prevCleared);
        newCleared.add(stageIndex);
        // Save to localStorage
        try {
          localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify(Array.from(newCleared))
          );
        } catch (e) {
          console.error("Failed to save cleared stages to localStorage:", e);
        }
        return newCleared;
      });
      // Play the cat sound on stage clear
      if (playCat) {
        playCat();
      }
    },
    [playCat]
  ); // Add playCatSound dependency

  const handleOpenModal = () => {
    setIsStageModalOpen(true);
    // Optionally play modal open sound
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    // Close only if clicking the overlay itself
    if (!e || e.target === e.currentTarget) {
      setIsStageModalOpen(false);
      // Optionally play modal close sound
    }
  };

  // Answer Playback Handler (moved from Game.tsx)
  const handleShowAnswer = useCallback(() => {
    if (!selectedStage?.optimal_path || isPlayingBack) return;

    const path = selectedStage.optimal_path;
    if (!path || path.length === 0) return;

    let currentStep = 0; // Use a local variable for step tracking

    setIsPlayingBack(true);
    setPlaybackMessage("最適経路を再生中...");

    // Clear previous interval if any
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }

    // Set initial state for playback display
    const startPath = path[currentStep];
    setCurrentPlaybackState([startPath[0].toString(), startPath[1].toString()]);
    currentStep++; // Increment step for the first interval call

    playbackIntervalRef.current = setInterval(() => {
      if (currentStep >= path.length) {
        // End of playback
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
        }
        setIsPlayingBack(false);
        setPlaybackMessage("再生終了");
        // Keep the last state displayed
        return; // Stop the interval logic
      }

      const [catPos, mousePos] = path[currentStep];
      setCurrentPlaybackState([catPos.toString(), mousePos.toString()]);
      currentStep++; // Increment step for the next interval
    }, PLAYBACK_INTERVAL_MS);
  }, [selectedStage, isPlayingBack]);

  // Determine if answer is available for the current stage
  const isAnswerAvailable =
    !!selectedStage?.optimal_path && selectedStage.optimal_path.length > 0;

  return (
    <div className="h-dvh w-dvw flex flex-col text-white bg-gray-900">
      {/* Header Area for Buttons */}
      <header className="p-3 flex justify-between items-center gap-3 border-b border-gray-700">
        {/* Retry Button */}
        <button
          onClick={handleRetry}
          disabled={
            isLoading ||
            error !== null ||
            selectedStageIndex === null ||
            isPlayingBack
          } // Disable during playback
          className="text-sm px-2 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          リトライ
        </button>
        {/* Stage Select Button */}
        <button
          onClick={handleOpenModal}
          disabled={
            isLoading ||
            error !== null ||
            allStages.length === 0 ||
            isPlayingBack
          } // Disable during playback
          className="text-sm px-2 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Loading..." : error ? "Error" : "ステージ選択"}
        </button>
        {/* Show Answer Button (New) */}
        <button
          onClick={handleShowAnswer}
          disabled={
            !isAnswerAvailable ||
            isPlayingBack ||
            isLoading ||
            error !== null ||
            selectedStageIndex === null
          }
          className="text-sm px-2 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPlayingBack ? "再生中..." : "答えを見る"}
        </button>
      </header>
      {/* Main content area */}
      <main className="flex flex-col flex-grow container mx-auto px-4 py-0 items-center">
        {/* Game Component */}
        <div className="w-full flex justify-center">
          {selectedStage ? (
            <CatGame
              stageData={selectedStage}
              key={`${selectedStageIndex}-${retryCounter}`} // Key includes retryCounter
              onStageClear={() =>
                handleStageClear(selectedStageIndex as number)
              }
              // Pass playback state down
              isPlaybackActive={isPlayingBack}
              playbackMessage={playbackMessage}
              currentPlaybackState={currentPlaybackState}
            />
          ) : (
            <div className="text-center p-4 text-gray-400">
              {isLoading
                ? "ステージを読み込み中..."
                : error
                ? `エラー: ${error}`
                : "ステージを選択してください"}
            </div>
          )}
        </div>
      </main>
      {/* Stage Selection Modal */}
      {isStageModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal} // Close on overlay click
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
          >
            <button
              onClick={() => handleCloseModal()} // Explicit close button
              className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl font-bold"
              aria-label="Close modal"
            >
              &times;
            </button>
            <h2 className="text-xl font-semibold mb-4 text-center">
              ステージ選択
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {allStages.map((stage, index) => {
                const isCleared = clearedStages.has(index);
                // Basic coloring like PuzzleGameScreen (can be enhanced)
                const hue = (index * (360 / allStages.length)) % 360;
                const bgColor = isCleared
                  ? `hsl(${hue}, 30%, 40%)`
                  : `hsl(${hue}, 60%, 50%)`; // Dim cleared stages
                const textColor = isCleared ? "text-gray-400" : "text-white";

                return (
                  <button
                    key={stage.graph_id || index}
                    onClick={() => handleStageSelect(index)}
                    className={`p-3 rounded-md font-medium text-center aspect-square flex flex-col items-center justify-center transition-transform transform hover:scale-105 relative ${textColor}`}
                    style={{ backgroundColor: bgColor }}
                    title={`Nodes: ${stage.nodes.length}, Moves: ${
                      stage.minimax_cat_moves // Use renamed key
                    }${isCleared ? " (クリア済み)" : ""}`}
                  >
                    {isCleared && (
                      <span
                        className="absolute top-1 right-1 text-lg"
                        role="img"
                        aria-label="Cleared"
                      >
                        ✅
                      </span>
                    )}
                    <span className="text-lg">{index + 1}</span>
                    <span className="text-xs mt-1">
                      ({stage.nodes.length}N/{stage.minimax_cat_moves}M){" "}
                      {/* Use renamed key */}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
  // } // Remove extra closing brace from previous error
}
