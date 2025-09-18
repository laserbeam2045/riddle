import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRedo,
  faLightbulb,
  faVolumeUp,
  faVolumeMute,
} from "@fortawesome/free-solid-svg-icons";

interface PuzzleHeaderProps {
  currentStage: {
    id: number;
    name?: string;
  } | null;
  moves: number;
  currentHistoryIndex: number;
  gameHistoryLength: number;
  showSolution: boolean;
  soundEnabled: boolean;
  hasSolutionPath: boolean;
  onReset: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onToggleSolution: () => void;
  onToggleSound: () => void;
  onShowStageSelect: () => void;
}

const PuzzleHeader: React.FC<PuzzleHeaderProps> = ({
  currentStage,
  moves,
  currentHistoryIndex,
  gameHistoryLength,
  showSolution,
  soundEnabled,
  hasSolutionPath,
  onReset,
  onStepBackward,
  onStepForward,
  onToggleSolution,
  onToggleSound,
  onShowStageSelect,
}) => {
  return (
    <div className="puzzle-header">
      <div
        className="puzzle-header-top"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Left: Title */}
        <div
          className="stage-indicator"
          style={{ display: "flex", alignItems: "center", gap: "12px" }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "rgba(30, 30, 30, 0.8)",
              border: "1px solid rgba(64, 64, 64, 0.6)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 3px rgba(0,0,0,0.3)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 正三角形の辺（グラフエッジ） */}
              <line
                x1="12"
                y1="5"
                x2="5"
                y2="17"
                stroke="#6b7280"
                strokeWidth="2"
              />
              <line
                x1="5"
                y1="17"
                x2="19"
                y2="17"
                stroke="#6b7280"
                strokeWidth="2"
              />
              <line
                x1="19"
                y1="17"
                x2="12"
                y2="5"
                stroke="#6b7280"
                strokeWidth="2"
              />

              {/* 頂点（ノード） */}
              <circle cx="12" cy="5" r="2.5" fill="#ffffff" />
              <circle cx="5" cy="17" r="2.5" fill="#ffffff" />
              <circle cx="19" cy="17" r="2.5" fill="#ffffff" />
            </svg>
          </div>
          <div>
            <h3
              className="stage-title"
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#1f2937",
                margin: 0,
                letterSpacing: "0.3px",
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)",
              }}
            >
              The Three
            </h3>
          </div>
        </div>

        {/* Right: Stats */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div className="stage-name text-nowrap">
            <span className="stars-count">{moves} moves</span>
          </div>
          <div className="stage-name">#{currentStage?.id}</div>
        </div>
      </div>

      <div className="puzzle-header-bottom">
        <div className="buttons-container">
          <button className="puzzle-button hint-button" onClick={onReset}>
            <div className="button-icon text-white">
              <FontAwesomeIcon icon={faRedo} />
            </div>
          </button>

          <button
            className={`puzzle-button ${
              currentHistoryIndex > 0 ? "select-button" : "hint-button"
            }`}
            onClick={onStepBackward}
            disabled={currentHistoryIndex <= 0}
          >
            <div className="button-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                width="100%"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 12H5M12 19L5 12L12 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          <button
            className={`puzzle-button ${
              currentHistoryIndex < gameHistoryLength - 1
                ? "select-button"
                : "hint-button"
            }`}
            onClick={onStepForward}
            disabled={currentHistoryIndex >= gameHistoryLength - 1}
          >
            <div className="button-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                width="100%"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 12H19M12 5L19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          {hasSolutionPath && (
            <button
              className={`puzzle-button ${
                showSolution ? "hint-button" : "select-button"
              }`}
              onClick={onToggleSolution}
            >
              <div className="button-icon">
                <FontAwesomeIcon icon={faLightbulb} />
              </div>
            </button>
          )}

          <button
            className={`puzzle-button ${
              soundEnabled ? "select-button" : "hint-button"
            }`}
            onClick={onToggleSound}
          >
            <div className="button-icon">
              <FontAwesomeIcon
                icon={soundEnabled ? faVolumeUp : faVolumeMute}
              />
            </div>
            <span>{soundEnabled ? "ON" : "OFF"}</span>
          </button>

          <button className="puzzle-button select-button" onClick={onShowStageSelect}>
            <div className="button-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                width="100%"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PuzzleHeader;