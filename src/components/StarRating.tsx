"use client";

import React, { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  value: number | undefined;
  onChange: (rating: number | undefined) => void;
  theme: Record<string, string>;
}

export function StarRating({ value, onChange, theme }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue ?? value ?? 0;

  const handleClick = (rating: number) => {
    // Click same value again to clear
    onChange(value === rating ? undefined : rating);
  };

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const halfValue = starIndex - 0.5;
        const fullValue = starIndex;

        // Determine fill: full, half, or empty
        const isFull = displayValue >= fullValue;
        const isHalf = !isFull && displayValue >= halfValue;

        return (
          <div key={starIndex} className="relative w-5 h-5">
            {/* Background empty star */}
            <Star
              className="w-5 h-5 absolute inset-0"
              style={{ color: theme.textLight }}
              fill="none"
              strokeWidth={1.5}
            />

            {/* Filled star (full or half via clip) */}
            {(isFull || isHalf) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: isHalf ? "50%" : "100%" }}
              >
                <Star
                  className="w-5 h-5"
                  style={{ color: "#eab308" }}
                  fill="#eab308"
                  strokeWidth={1.5}
                />
              </div>
            )}

            {/* Left half click zone (= x.5) */}
            <button
              type="button"
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer z-10"
              onClick={() => handleClick(halfValue)}
              onMouseEnter={() => setHoverValue(halfValue)}
              aria-label={`Rate ${halfValue}`}
            />
            {/* Right half click zone (= x.0) */}
            <button
              type="button"
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer z-10"
              onClick={() => handleClick(fullValue)}
              onMouseEnter={() => setHoverValue(fullValue)}
              aria-label={`Rate ${fullValue}`}
            />
          </div>
        );
      })}

    </div>
  );
}
