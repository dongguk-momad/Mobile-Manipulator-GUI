import React, { useState, useEffect } from "react";
import RobotInfo from "./components/RobotInfo";
import SensorInfo from "./components/SensorInfo";
import ControllerInput from "./components/ControllerInput";
import ControlButtons from "./components/ControlButtons";
import NetworkStatus from "./components/NetworkStatus";
import ArmVisualizer from "./components/ArmVisualizer";
import ArmComparison3DVisualizer from "./components/ArmComparison3DVisualizer";

function App() {
  const [controlView, setControlView] = useState("joystick");
  const [robotStatus, setRobotStatus] = useState("E-STOP");
  const [speed, setSpeed] = useState(0);
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [battery, setBattery] = useState(85);
  const [jointAngles, setJointAngles] = useState([0, 0, 0, 0, 0, 0]);
  const [cartesianCoords, setCartesianCoords] = useState([1.5, 2.3, 0.8, 1.5, 2.3, 0.8]);
  const [gripperOpening, setGripperOpening] = useState(30.0);
  const [forceSensorValues, setForceSensorValues] = useState([0, 0, 0, 0, 0, 0]);
  const [cameraImages, setCameraImages] = useState({});
  const [camera1Fps, setCamera1Fps] = useState(30.0);
  const [camera2Fps, setCamera2Fps] = useState(29.8);
  const [camera1Latency, setCamera1Latency] = useState(12.3);
  const [camera2Latency, setCamera2Latency] = useState(11.5);
  const [logs, setLogs] = useState([]);
  const [angle, setAngle] = useState(0);
  const [accel, setAccel] = useState(0);
  const [brake, setBrake] = useState(0);
  const [gearStatus, setGearStatus] = useState("중립");
  const [masterJointValues, setMasterJointValues] = useState([0, 0, 0, 0, 0, 0]);

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    const baseWsUrl = window.location.origin.replace(/^http/, "ws");
  
    const wsData = new WebSocket(`${baseWsUrl}/ws/data`);
    const wsImage = new WebSocket(`${baseWsUrl}/ws/image`);
  
    // wsImage.onmessage = (event) => {
    //   try {
    //     const data = JSON.parse(event.data);
    //     setCameraImages((prev) => ({ ...prev, [data.camera_id]: data.image }));
    //   } catch (err) {
    //     console.error("Image WebSocket error:", err);
    //   }
    // };
    wsImage.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.images) {
          setCameraImages((prev) => ({ ...prev, ...data.images }));
        }
      } catch (err) {
        console.error("Image WebSocket error:", err);
      }
    };    
  
    wsData.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.force_sensor) setForceSensorValues(data.force_sensor);
        if (data.battery !== undefined) setBattery(data.battery);
        if (data.speed !== undefined) setSpeed(data.speed);
        if (data.steering_angle !== undefined) setSteeringAngle(data.steering_angle);
        if (data.gripper_opening !== undefined) setGripperOpening(data.gripper_opening);
        if (data.joint_angles) {
          setJointAngles(data.joint_angles);
          setMasterJointValues(data.joint_angles);
        }
        if (data.angle !== undefined) setAngle(data.angle);
        if (data.accel !== undefined) setAccel(data.accel);
        if (data.brake !== undefined) setBrake(data.brake);
        if (data.gear_status) setGearStatus(data.gear_status);
  
        addLog("ROS 메시지 수신됨");
      } catch (err) {
        console.error("Data WebSocket error:", err);
      }
    };
  
    return () => {
      wsImage.close();
      wsData.close();
    };
  }, []);

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">
        모바일 매니퓰레이터 GUI
      </h1>

      <div className="flex flex-col lg:flex-row gap-6 mb-6 w-full">
        <div className="lg:basis-2/3">
          <SensorInfo forceValues={forceSensorValues} cameraImages={cameraImages} />
        </div>
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
            onEStop={() => {
              setRobotStatus("E-STOP");
              setSpeed(0);
              addLog("E-STOP 활성화됨");
            }}
            onAuto={() => {
              setRobotStatus("Auto");
              setSpeed(1.5);
              setSteeringAngle(5);
              addLog("Auto 모드 전환");
            }}
            onManual={() => {
              setRobotStatus("Manual");
              setSpeed(0.5);
              setSteeringAngle(0);
              addLog("Manual 모드 전환");
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;