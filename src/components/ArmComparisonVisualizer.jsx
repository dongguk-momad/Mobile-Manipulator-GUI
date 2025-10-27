import React from "react";

const LINK_LENGTH = 50;

function computePoints(jointAngles) {
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

  return points;
}

function ArmComparisonVisualizer({
  masterJointAngles = [0, 0, 0, 0, 0, 0],
  slaveJointAngles = [0, 0, 0, 0, 0, 0],
}) {
  const masterPoints = computePoints(masterJointAngles);
  const slavePoints = computePoints(slaveJointAngles);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 w-full h-full">
      <h2 className="text-xl font-semibold text-gray-800 mb-3">마스터 vs 슬레이브 로봇팔</h2>
      <svg width="100%" height="100%" viewBox="0 0 400 400" className="bg-gray-50 rounded border">
        {/* 마스터 팔 - 파란색 */}
        {masterPoints.map((pt, idx) =>
          idx > 0 ? (
            <line
              key={`m-${idx}`}
              x1={masterPoints[idx - 1].x}
              y1={masterPoints[idx - 1].y}
              x2={pt.x}
              y2={pt.y}
              stroke="#3B82F6"
              strokeWidth="4"
            />
          ) : null
        )}

        {/* 슬레이브 팔 - 빨간색 */}
        {slavePoints.map((pt, idx) =>
          idx > 0 ? (
            <line
              key={`s-${idx}`}
              x1={slavePoints[idx - 1].x}
              y1={slavePoints[idx - 1].y}
              x2={pt.x}
              y2={pt.y}
              stroke="#EF4444"
              strokeWidth="4"
              strokeDasharray="4 2"
            />
          ) : null
        )}

        {/* 조인트 원 표시 */}
        {[...masterPoints, ...slavePoints].map((pt, idx) => (
          <circle key={`pt-${idx}`} cx={pt.x} cy={pt.y} r="3" fill="#00000033" />
        ))}
      </svg>
    </div>
  );
}

export default ArmComparisonVisualizer;
