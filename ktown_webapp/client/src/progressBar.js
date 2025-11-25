import React, { useEffect, useRef, useState } from "react";

/**
 * Props:
 *   level: integer between 0 and 5 (inclusive)
 */
function JourneyVerticalProgress({ level }) {
  // sign = 1 → positive side, sign = -1 → negative side
  const [sign, setSign] = useState(1);
  const prevLevelRef = useRef(null);

  // Flip sign whenever we "arrive" at 0 (i.e., level becomes 0 from a non-zero value)
  useEffect(() => {
    const prev = prevLevelRef.current;

    if (prev !== null && prev !== level && level === 0) {
      setSign((prevSign) => (prevSign === 1 ? -1 : 1));
    }

    prevLevelRef.current = level;
  }, [level]);

  // Map external 0–5 to internal -5…5 depending on current sign
  const effectiveLevel = sign * clamp(level, 0, 5); // will be in [-5, 5]

  const positionPercent = levelToPercent(effectiveLevel); // 0% top, 100% bottom

  const levels = [];
  for (let i = 5; i >= -5; i--) {
    levels.push(i);
  }

  return (
    <div style={containerStyle}>
      <div style={trackWrapperStyle}>
        <div style={trackStyle}>
          {/* Level ticks and labels */}
          {levels.map((lvl) => (
            <div key={lvl} style={levelRowStyle}>
              <div style={tickStyle} />
              <span style={labelStyle}>{lvl}</span>
            </div>
          ))}

          {/* Animated horizontal line indicating current level */}
          <div
            style={{
              ...indicatorLineStyle,
              top: `${positionPercent}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Helpers

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert a level in [-5, 5] to a vertical percentage.
 * +5 → 0%, 0 → 50%, -5 → 100%.
 */
function levelToPercent(level) {
  const clamped = clamp(level, -5, 5);
  const steps = 10; // 5 to -5 has 10 intervals
  return ((5 - clamped) / steps) * 100;
}

// Styles

const containerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  height: "100%", // full height of parent
};

const trackWrapperStyle = {
  flex: "0 0 auto",
  height: "100%",
};

const trackStyle = {
  position: "relative",
  width: "40px",
  height: "100%",
  borderLeft: "2px solid var(--primary-color)",
  paddingLeft: "8px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const levelRowStyle = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const tickStyle = {
  width: "0px",
  height: "1px",
  backgroundColor: "var(--primary-color)",
  marginRight: "4px",
};

const labelStyle = {
  fontSize: "0px",
  color: "#666",
};

const indicatorLineStyle = {
  position: "absolute",
  left: 0,
  width: "100%",
  height: "2px",
  backgroundColor: "var(--primary-color)",
  transform: "translateY(-50%)",
  transition: "top 0.3s ease-out",
};

const infoStyle = {
  fontSize: "12px",
  color: "#333",
  lineHeight: 1.4,
};

export default JourneyVerticalProgress;
