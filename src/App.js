import React, { useState, useEffect } from "react";
import RobotInfo from "./components/RobotInfo";
import SensorInfo from "./components/SensorInfo";
import ControllerInput from "./components/ControllerInput";
import ControlButtons from "./components/ControlButtons";
import NetworkStatus from "./components/NetworkStatus";
import ArmVisualizer from "./components/ArmVisualizer";
import ArmComparisonVisualizer from "./components/ArmComparisonVisualizer";
import ArmComparison3DVisualizer from "./components/ArmComparison3DVisualizer";

function App() {
  const [controlView, setControlView] = useState("joystick");

  // 로봇 기본 상태들
  const [robotStatus, setRobotStatus] = useState("E-STOP");
  const [speed, setSpeed] = useState(0);
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [battery, setBattery] = useState(85);
  const [jointAngles, setJointAngles] = useState([10, 20, 30, 15, 25, 5]);
  const [cartesianCoords, setCartesianCoords] = useState([1.5, 2.3, 0.8, 1.5, 2.3, 0.8]);
  const [gripperOpening, setGripperOpening] = useState(30.0);

  // Sensor 관련 state
  const [forceSensorValues, setForceSensorValues] = useState([0, 0, 0, 0, 0, 0]);

  // Network 관련 state
  const [camera1Fps, setCamera1Fps] = useState(30.0);
  const [camera2Fps, setCamera2Fps] = useState(29.8);
  const [camera1Latency, setCamera1Latency] = useState(12.3);
  const [camera2Latency, setCamera2Latency] = useState(11.5);
  const [logs, setLogs] = useState(["시스템 초기화됨", "카메라 연결됨"]);

  // 조종기 관련 state
  const [angle, setAngle] = useState(0);
  const [accel, setAccel] = useState(20);
  const [brake, setBrake] = useState(10);
  const [gearStatus, setGearStatus] = useState("중립");
  const [masterJointValues, setMasterJointValues] = useState([0, 0, 0, 0, 0, 0]);

  // E-STOP
  const handleEStop = () => {
    setRobotStatus("E-STOP");
    setSpeed(0);
    addLog("E-STOP 활성화됨");
  };

  // AUTO
  const handleAuto = () => {
    setRobotStatus("Auto");
    setSpeed(1.5);
    setSteeringAngle(5);
    addLog("Auto 모드 전환");
  };

  // MANUAL
  const handleManual = () => {
    setRobotStatus("Manual");
    setSpeed(0.5);
    setSteeringAngle(0);
    addLog("Manual 모드 전환");
  };

  // 로그 추가 함수
  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]); // 최대 50줄
  };

  const handleRosMessage = (msg) => {
    if (msg.battery !== undefined) {
      setBattery(Math.round(msg.battery * 10) / 10);
    }
    if (msg.speed !== undefined) {
      setSpeed(msg.speed);
    }
    if (msg.steering_angle !== undefined) {
      setSteeringAngle(Math.round(msg.steering_angle * 10) / 10);
    }
    if (msg.joint_angles !== undefined) {
      setJointAngles(msg.joint_angles);
      setMasterJointValues(msg.joint_angles);
    }
    if (msg.gripper_opening !== undefined) {
      setGripperOpening(Math.round(msg.gripper_opening * 10) / 10);
    }
    if (msg.force_sensor !== undefined) {
      setForceSensorValues(msg.force_sensor.map((v) => Math.round(v * 10) / 10));
    }
    if (msg.angle !== undefined) {
      setAngle(Math.round(msg.angle * 10) / 10);
    }
    if (msg.accel !== undefined) {
      setAccel(msg.accel);
    }
    if (msg.brake !== undefined) {
      setBrake(msg.brake);
    }
    if (msg.gear_status !== undefined) {
      setGearStatus(msg.gear_status);
    }
  
    addLog("ROS 메시지 수신됨");
  };  

  // Force 센서 시뮬레이션
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     const randomForces = Array.from({ length: 6 }, () =>
  //       (Math.random() * 10).toFixed(1)
  //     );
  //     setForceSensorValues(randomForces.map(Number));
  //   }, 1000);

  //   return () => clearInterval(interval);
  // }, []);

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     // 조이스틱 각도: -90 ~ +90 사이에서 왔다 갔다
  //     setAngle((prev) => {
  //       let next = prev + 10;
  //       if (next > 90) next = -90;
  //       return next;
  //     });
  
  //     // 페달: 랜덤
  //     setAccel(Math.floor(Math.random() * 100));
  //     setBrake(Math.floor(Math.random() * 50));
  
  //     // 기어 상태 변경: 중립 → 전진 → 후진 순환
  //     setGearStatus((prev) => {
  //       if (prev === "중립") return "전진";
  //       if (prev === "전진") return "후진";
  //       return "중립";
  //     });
  
  //     // 마스터 로봇팔 조인트 각도: 부드럽게 진동
  //     setMasterJointValues((prev) =>
  //       prev.map((v) => v + (Math.random() * 2 - 1)) // -1 ~ +1 변화
  //     );
  
  //     // 속도, 조향 각도, 배터리 등도 바꿔보기
  //     setSpeed((prev) => Math.max(0, Math.min(2, prev + (Math.random() - 0.5))));
  //     setSteeringAngle((prev) => Math.max(-30, Math.min(30, prev + (Math.random() * 6 - 3))));
  //     setBattery((prev) => Math.max(0, prev - 0.1)); // 점점 감소
  
  //     // 로그 추가 (랜덤하게)
  //     if (Math.random() < 0.3) {
  //       addLog("상태 업데이트됨");
  //     }
  
  //   }, 1000); // 1초마다 실행
  
  //   return () => clearInterval(interval);
  // }, []);
  
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
  
    socket.onopen = () => {
      console.log("✅ WebSocket connected");
      addLog("WebSocket 연결됨");
    };
  
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleRosMessage(msg);
      } catch (err) {
        console.error("❌ 메시지 파싱 실패:", err);
      }
    };
  
    socket.onclose = () => {
      console.log("❌ WebSocket disconnected");
      addLog("WebSocket 연결 종료됨");
    };
  
    return () => socket.close();
  }, []);  

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">
        모바일 매니퓰레이터 GUI
      </h1>

      {/* 센서 + 오른쪽 패널 */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6 w-full">
        {/* 센서 정보 */}
        <div className="lg:basis-2/3">
          <SensorInfo forceValues={forceSensorValues} />
        </div>

        {/* 오른쪽 패널 */}
        <div className="lg:basis-1/3 flex flex-col justify-between gap-6">
          <RobotInfo
            robotStatus={robotStatus}
            speed={speed}
            steeringAngle={steeringAngle}
            battery={battery}
            jointAngles={jointAngles}
            cartesianCoords={cartesianCoords}
            gripperOpening={gripperOpening}
          />
          <div className="flex flex-col gap-2">
            {/* 조종기 / 로봇팔 시각화 선택 */}
            <div className="flex justify-end">
              <select
                value={controlView}
                onChange={(e) => setControlView(e.target.value)}
                className="text-sm border rounded-md py-1 px-2 bg-gray-50"
              >
                <option value="joystick">조종기 인풋</option>
                <option value="arm">로봇팔 시각화</option>
                <option value="compare">마스터/슬레이브 비교</option>
              </select>
            </div>

            {/* 조건부 컴포넌트 렌더링 */}
            <div className="flex-1 flex items-stretch">
              {controlView === "joystick" ? (
                <ControllerInput
                  angle={angle}
                  onAngleChange={() => {}}
                  accel={accel}
                  brake={brake}
                  gearStatus={gearStatus}
                  jointValues={masterJointValues}
                />
              ) : controlView === "arm" ? (
                <ArmVisualizer jointAngles={masterJointValues} />
              ) : (
                <ArmComparison3DVisualizer
                  masterJointAngles={masterJointValues}
                  slaveJointAngles={jointAngles}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 통신 정보 + 버튼 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center w-full">
        <div className="lg:col-span-3">
          <NetworkStatus
            camera1Fps={camera1Fps}
            camera2Fps={camera2Fps}
            camera1Latency={camera1Latency}
            camera2Latency={camera2Latency}
            logs={logs}
          />
        </div>
        <div className="w-full lg:h-full flex items-stretch">
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
