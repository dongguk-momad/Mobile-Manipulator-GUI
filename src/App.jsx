import React, { useState, useEffect } from "react";
import RobotInfo from "./components/RobotInfo";
import SensorInfo from "./components/SensorInfo";
import ControllerInput from "./components/ControllerInput";
import ControlButtons from "./components/ControlButtons";
import NetworkStatus from "./components/NetworkStatus";
import ArmComparison3DVisualizer from "./components/ArmComparison3DVisualizer";
import { add } from "three/tsl";

function App() {
  const [controlView, setControlView] = useState("joystick");
  const [robotStatus, setRobotStatus] = useState("E-STOP");
  const [speed, setLinearSpeed] = useState(0);
  const [steeringAngle, setAngularSpeed] = useState(0);
  const [battery, setBattery] = useState(85);
  const [jointAngles, setJointAngles] = useState([0, 0, 0, 0, 0, 0]);
  const [cartesianCoords, setCartesianPosition] = useState([0, 0, 0, 0, 0, 0]);
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
        if (data.linear_speed !== undefined) setLinearSpeed(data.linear_speed);
        if (data.angular_speed !== undefined) setAngularSpeed(data.angular_speed);
        if (data.gripper_opening !== undefined) setGripperOpening(data.gripper_opening);
        if (data.joint_angles !== undefined) setJointAngles(data.joint_angles);
        if (data.master_joint_angles !== undefined) setMasterJointValues(data.master_joint_angles);
        if (data.angle !== undefined) setAngle(data.angle);
        if (data.accel !== undefined) setAccel(data.accel);
        if (data.brake !== undefined) setBrake(data.brake);
        if (data.gear_status !== undefined) setGearStatus(data.gear_status);
        if (data.cartesian_position !== undefined) setCartesianPosition(data.cartesian_position);
        if (data.robot_status !== undefined) setRobotStatus(data.robot_status);
        if (data.camera1_fps !== undefined) setCamera1Fps(data.camera1_fps);
        if (data.camera2_fps !== undefined) setCamera2Fps(data.camera2_fps);
        if (data.camera1_latency !== undefined) setCamera1Latency(data.camera1_latency);
        if (data.camera2_latency !== undefined) setCamera2Latency(data.camera2_latency);
        if (data.log !== undefined) addLog(data.log);
  
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
        Mobile Manipulator Driver
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
                <option value="joystick">Controller Input</option>
                <option value="compare">Master vs Slave</option>
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