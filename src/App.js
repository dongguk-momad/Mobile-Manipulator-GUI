import React, { useState } from "react";
import RobotInfo from "./components/RobotInfo";
import SensorInfo from "./components/SensorInfo";
import ControllerInput from "./components/ControllerInput";
import ControlButtons from "./components/ControlButtons";
import NetworkStatus from "./components/NetworkStatus";

function App() {
  // 로봇 상태 관리를 위한 state 추가
  const [robotStatus, setRobotStatus] = useState("E-STOP");
  const [speed, setSpeed] = useState(0);
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [battery, setBattery] = useState(85);
  const [jointAngles, setJointAngles] = useState([10, 20, 30, 15, 25, 5]);
  const [cartesianCoords, setCartesianCoords] = useState([1.5, 2.3, 0.8]);
  const [gripperStatus, setGripperStatus] = useState("Open");

  // 버튼 핸들러 함수들
  const handleEStop = () => {
    setRobotStatus("E-STOP");
    setSpeed(0);
    // E-STOP 시 다른 값들은 그대로 유지
  };

  const handleAuto = () => {
    setRobotStatus("Auto");
    // Auto 모드 시 속도 및 기타 값 변경 (예시)
    setSpeed(1.5);
    setSteeringAngle(5);
  };

  const handleManual = () => {
    setRobotStatus("Manual");
    // Manual 모드 시 초기 값 설정 (예시)
    setSpeed(0.5);
    setSteeringAngle(0);
  };

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
          {/* RobotInfo 컴포넌트에 상태값 전달 */}
          <RobotInfo 
            robotStatus={robotStatus}
            speed={speed}
            steeringAngle={steeringAngle}
            battery={battery}
            jointAngles={jointAngles}
            cartesianCoords={cartesianCoords}
            gripperStatus={gripperStatus}
          />
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
          {/* ControlButtons 컴포넌트에 핸들러 함수 전달 */}
          <ControlButtons 
            onEStop={handleEStop}
            onAuto={handleAuto}
            onManual={handleManual}
          />
        </div>
      </div>
    </div>
  );
}

export default App;