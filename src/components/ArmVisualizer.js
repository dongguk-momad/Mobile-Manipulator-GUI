import React from "react";

const LINK_LENGTH = 50;

function ArmVisualizer({ jointAngles = [0, 0, 0, 0, 0, 0] }) {
  const points = [{ x: 200, y: 200 }];
  let currentAngle = 0;

  for (let i = 0; i < jointAngles.length; i++) {
    currentAngle += jointAngles[i] * (Math.PI / 180);
    const prev = points[points.length - 1];
    const next = {
      x: prev.x + LINK_LENGTH * Math.cos(currentAngle),
      y: prev.y + LINK_LENGTH * Math.sin(currentAngle),
    };
    points.push(next);
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 w-full h-full">
      <h2 className="text-xl font-semibold text-gray-800 mb-3">마스터 로봇팔 시각화</h2>
      <svg width="100%" height="100%" viewBox="0 0 400 400" className="bg-gray-50 rounded border">
        {points.map((pt, idx) =>
          idx > 0 ? (
            <line
              key={idx}
              x1={points[idx - 1].x}
              y1={points[idx - 1].y}
              x2={pt.x}
              y2={pt.y}
              stroke="#3B82F6"
              strokeWidth="4"
            />
          ) : null
        )}
        {points.map((pt, idx) => (
          <circle
            key={`joint-${idx}`}
            cx={pt.x}
            cy={pt.y}
            r="5"
            fill={idx === 0 ? "#10B981" : "#1E40AF"}
          />
        ))}
      </svg>
    </div>
  );
}

export default ArmVisualizer;
