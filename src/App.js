import React from "react";
import RobotInfo from "./components/RobotInfo";
import SensorInfo from "./components/SensorInfo";
import ControllerInput from "./components/ControllerInput";
import ControlButtons from "./components/ControlButtons";
import NetworkStatus from "./components/NetworkStatus";

function App() {
  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">모바일 매니퓰레이터 GUI</h1>

      {/* 상단: 센서 + 오른쪽 패널 (3:2 비율) */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6 w-full">
        {/* 센서 영역 (카메라) - 3/5 */}
        <div className="lg:basis-2/3 lg:flex-grow-0">
          <SensorInfo />
        </div>

        {/* 오른쪽: 로봇 정보 + 조종기 인풋 - 2/5 */}
        <div className="lg:basis-1/3 lg:flex-grow-0 flex flex-col justify-between gap-6">
          <RobotInfo />
          <div className="flex-1 flex items-stretch">
            <ControllerInput />
          </div>
        </div>
      </div>

      {/* 하단: 통신 정보 + 조종 버튼 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center w-full">
        <div className="lg:col-span-3">
          <NetworkStatus />
        </div>
        <div className="w-full lg:h-full flex items-stretch">
          <ControlButtons />
        </div>
      </div>
    </div>
  );
}

export default App;