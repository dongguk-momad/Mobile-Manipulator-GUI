import React from "react";

function Joystick({
  angle = 0,
  onAngleChange = () => {},
  accel = 0,
  brake = 0,
  gearStatus = "중립",
  jointValues = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
}) {
  // 1.1배 확대된 기본 크기 설정
  const radius = 40 * 1.1;
  const handleRadius = 5 * 1.1;
  const distance = radius - handleRadius;

  const angleInRadians = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(angleInRadians) * distance;
  const y = Math.sin(angleInRadians) * distance;

  const renderTicks = () => {
    const ticks = [];
    const tickLength = 5;
    for (let deg = 0; deg < 360; deg += 10) {
      const rad = ((deg - 90) * Math.PI) / 180;
      const innerX = 50 + ((Math.cos(rad) * (radius - tickLength)) / radius) * 50;
      const innerY = 50 + ((Math.sin(rad) * (radius - tickLength)) / radius) * 50;
      const outerX = 50 + ((Math.cos(rad) * radius) / radius) * 50;
      const outerY = 50 + ((Math.sin(rad) * radius) / radius) * 50;

      ticks.push(
        <line
          key={deg}
          x1={`${innerX}%`}
          y1={`${innerY}%`}
          x2={`${outerX}%`}
          y2={`${outerY}%`}
          stroke="#ccc"
          strokeWidth="1.25"
        />
      );
    }
    return ticks;
  };

  const renderLabels = () => {
    const labels = [
      { deg: 0, label: "0°" },
      { deg: 90, label: "90°" },
      { deg: 180, label: "180°" },
      { deg: 270, label: "-90°" },
    ];

    return labels.map(({ deg, label }) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      const labelRadius = radius + 8;
      const lx = 50 + ((Math.cos(rad) * labelRadius) / radius) * 50;
      const ly = 50 + ((Math.sin(rad) * labelRadius) / radius) * 50;

      return (
        <text
          key={label}
          x={`${lx}%`}
          y={`${ly}%`}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill="#666"
        >
          {label}
        </text>
      );
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full h-full border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">
        Controller Input
      </h2>

      {/* 상단 2분할: 왼쪽(Angular), 오른쪽(Pedal) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
        {/* 왼쪽: Angular Velocity Input */}
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-xl text-gray-700 font-semibold mb-3">
            Angular Velocity Input
          </p>
          {/* 1.1배 확대된 조이스틱 */}
          <div className="relative w-44 h-44 bg-gray-100 rounded-full border border-gray-300">
            <svg className="absolute top-0 left-0 w-full h-full">
              {renderTicks()}
              <line
                x1="50%"
                y1="50%"
                x2={`${50 + (x / radius) * 50}%`}
                y2={`${50 + (y / radius) * 50}%`}
                stroke="blue"
                strokeWidth="2.5"
              />
              {renderLabels()}
            </svg>
            <div
              className="absolute bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"
              style={{
                width: `${handleRadius * 2}px`,
                height: `${handleRadius * 2}px`,
                top: `calc(50% + ${y}px)`,
                left: `calc(50% + ${x}px)`,
              }}
            />
            <p className="absolute left-1/2 bottom-1.5 transform -translate-x-1/2 text-sm font-mono">
              {angle.toFixed(1)}°
            </p>
          </div>
        </div>

        {/* 오른쪽: Pedal Input */}
        <div className="flex flex-col justify-center px-4">
          <p className="text-xl text-gray-700 font-semibold mb-4 text-center">
            Pedal Input
          </p>

          {/* 게이지만 1.1배 확대 */}
          <div className="scale-[1.1] origin-center">
            {/* Accel */}
            <div className="mb-5">
              <p className="text-sm text-gray-500 mb-2">Accel</p>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-200"
                  style={{ width: `${accel}%` }}
                />
              </div>
              <p className="text-right text-xs text-gray-600 mt-1">{accel}%</p>
            </div>

            {/* Brake */}
            <div>
              <p className="text-sm text-gray-500 mb-2">Brake</p>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all duration-200"
                  style={{ width: `${brake}%` }}
                />
              </div>
              <p className="text-right text-xs text-gray-600 mt-1">{brake}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Master Robot Arm */}
      <div className="mt-10 pt-5 border-t border-gray-100">
        <p className="text-xl text-gray-700 font-medium mb-2">
          Master Robotarm Joint Position
        </p>
        <div className="grid grid-cols-6 gap-2">
          {jointValues.map((value, index) => (
            <div
              key={index}
              className="bg-blue-50 p-2 rounded text-center text-blue-700 font-mono text-sm"
            >
              {value.toFixed(1)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Joystick;
