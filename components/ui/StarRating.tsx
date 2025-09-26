import React from "react";

interface StarRatingProps {
  rating: { stars: number; perfect: boolean } | null;
  className?: string;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, className = "" }) => {
  if (!rating || rating.stars === 0) {
    return <div className={`text-gray-400 ${className}`}>未クリア</div>;
  }

  const { stars, perfect } = rating;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 星の表示 */}
      <div className="flex items-center">
        {Array.from({ length: stars }, (_, i) => (
          <span key={`filled-${i}`} className="text-yellow-400 text-lg">
            ★
          </span>
        ))}
        {Array.from({ length: 3 - stars }, (_, i) => (
          <span key={`empty-${i}`} className="text-gray-300 text-lg">
            ☆
          </span>
        ))}
      </div>
      {/* PERFECT表示 */}
      {perfect && (
        <div
          className="font-bold text-sm whitespace-nowrap"
          style={{
            background:
              "linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff0080, #ff0000)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "rainbow-flow 3s linear infinite reverse",
          }}
        >
          PERFECT
        </div>
      )}
    </div>
  );
};

export default StarRating;
