import React from "react";
import { Stage } from "../../composables/usePuzzleGame";
import StarRating from "../ui/StarRating";

interface StageSelectModalProps {
  stages: Stage[];
  clearedStages: Map<number, { moves: number; timestamp: number }>;
  currentStage: Stage | null;
  onStageSelect: (stage: Stage) => void;
  onClose: () => void;
  onPlayAudio: (sound: string) => void;
  getStarRating: (
    stageId: number,
    optimalMoves: number
  ) => { stars: number; perfect: boolean } | null;
}

const StageSelectModal: React.FC<StageSelectModalProps> = ({
  stages,
  clearedStages,
  currentStage,
  onStageSelect,
  onClose,
  onPlayAudio,
  getStarRating,
}) => {
  return (
    <div
      id="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onPlayAudio("cancel");
          onClose();
        }
      }}
    >
      <div id="modal-overlay">
        <button
          id="close-modal"
          className="close-button"
          onClick={() => {
            onPlayAudio("cancel");
            onClose();
          }}
        >
          ×
        </button>
        <div id="modal-content">
          <h2 className="stage-select-title">ステージを選択</h2>
          <div className="stage-grid-container">
            {stages.map((stage, index) => {
              const isCleared = clearedStages.has(stage.id);
              const isCurrentStage = currentStage?.id === stage.id;
              const hue = (index * (360 / stages.length)) % 360;

              return (
                <div
                  key={stage.id || index}
                  className={`stage-card ${
                    isCurrentStage ? "current-stage" : ""
                  } ${isCleared ? "cleared" : ""}`}
                  style={
                    {
                      "--stage-hue": `${hue}`,
                    } as React.CSSProperties
                  }
                >
                  <button
                    onClick={() => {
                      onPlayAudio("decision");
                      onStageSelect(stage);
                      onClose();
                    }}
                    className="stage-button"
                    disabled={
                      index > 0 && !clearedStages.has(stages[index - 1]?.id)
                    }
                  >
                    <div className="stage-number">{index + 1}</div>
                    <div className="stage-details">
                      <div className="stage-name">
                        {stage.name || `ステージ ${index + 1}`}
                      </div>
                      <div className="stage-status">
                        {isCleared && (
                          <span className="cleared-indicator">
                            <span className="mr-2">クリア済</span>
                            <StarRating
                              rating={getStarRating(
                                stage.id,
                                stage.optimalMoves || 0
                              )}
                            />
                          </span>
                        )}
                        {!isCleared && !isCurrentStage && (
                          <span className="locked-indicator">
                            {index > 0 &&
                            !clearedStages.has(stages[index - 1]?.id) ? (
                              <span className="lock-icon">🔒</span>
                            ) : (
                              <span className="available-indicator">
                                プレイ可能
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="stage-select-footer">
            <div className="legend">
              <div className="legend-item">
                <span className="legend-icon current"></span> プレイ中
              </div>
              <div className="legend-item">
                <span className="legend-icon cleared"></span> クリア済
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageSelectModal;
