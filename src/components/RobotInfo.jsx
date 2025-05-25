import React from "react";
import { GripHorizontal, GripVertical } from "lucide-react"; // 아이콘 예시 (shadcn/ui 기반)

function RobotInfo({
  robotStatus = "E-STOP",
  speed = 0,
  steeringAngle = 0,
  battery = 100,
  jointAngles = [0, 0, 0, 0, 0, 0],
  cartesianCoords = [0, 0, 0, 0, 0, 0],
  gripperOpening = 0.0,
}) {
  const getBatteryColor = (battery) => battery <= 20 ? "text-red-600" : "text-gray-800";
  const getBatteryBgColor = (battery) => battery <= 20 ? "bg-red-600" : "bg-green-500";
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full h-full border border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-gray-800">Robot Status</span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              robotStatus === "E-STOP"
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {robotStatus}
          </span>
      </div>

      <div className="space-y-3">
        {/* 모바일로봇 상태 */}
        <div className="pt-3 mt-4 border-t border-gray-100 space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">Mobile Robot</h3>
          {/* 속도 */}
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Linear Velocity:</span>
            <span className="text-gray-800 font-mono">{speed.toFixed(2)} m/s</span>
          </div>

          {/* 조향 각도 */}
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Angular Velocity:</span>
            <span className="text-gray-800 font-mono">{steeringAngle.toFixed(2)} rad/s</span>
          </div>

          {/* 배터리 */}
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Battery:</span>
            <div className="flex items-center">
              <div className="w-24 bg-gray-200 rounded-full h-2.5 mr-2">
                <div
                  className={`h-2.5 rounded-full ${getBatteryBgColor(battery)}`}
                  style={{ width: `${battery}%` }}
                ></div>
              </div>
              <span className={`font-medium ${getBatteryColor(battery)}`}>
                {battery.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* 로봇팔 상태 */}
        <div className="pt-3 mt-4 border-t border-gray-100 space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">Robotarm</h3>

          {/* 조인트 각도 */}
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Joint Position:</span>
            <span className="text-gray-800 font-mono">
              [{jointAngles.map((angle) => `${angle.toFixed(1)}°`).join(", ")}]
            </span>
          </div>

          {/* 좌표 */}
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Cartesian Position:</span>
            <span className="text-gray-800 font-mono">
              ({cartesianCoords.map((v) => v.toFixed(2)).join(", ")})
            </span>
          </div>

          {/* 그리퍼 개방 정도 */}
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Gripper Opening:</span>
            <div className="flex items-center space-x-2 text-sm">
              <GripHorizontal className="text-blue-600 w-4 h-4" />
              <span className="text-gray-700 font-mono">
                {gripperOpening.toFixed(1)} mm
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default RobotInfo;
