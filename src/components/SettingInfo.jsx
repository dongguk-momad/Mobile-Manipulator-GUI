import React, { useEffect, useState } from "react";

function ToggleChip({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={[
        "px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-150 flex items-center gap-1.5",
        value
          ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          value ? "bg-white" : "bg-gray-300"
        }`}
      />
    </button>
  );
}

export default function SettingInfo() {
  const [ws, setWs] = useState(null);
  useEffect(() => {
    const baseWsUrl = window.location.origin.replace(/^http/, "ws");
    const socket = new WebSocket(`${baseWsUrl}/ws/setting`);

    socket.onopen = () => console.log("✅ /ws/setting 연결됨");
    socket.onmessage = (e) => console.log("서버 응답:", e.data);
    socket.onerror = (err) => console.error("WebSocket 에러:", err);
    socket.onclose = () => console.log("❌ /ws/setting 연결 종료됨");

    setWs(socket);
    return () => socket.close();
  }, []);

  const wsOpen = ws && ws.readyState === WebSocket.OPEN;

  const [Hertz, setHertz] = useState("");
  const [savePath, setSavePath] = useState("");
  const [saveTask, setsaveTask] = useState("");
  const [robotSize, setRobotSize] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileFormat, setFileFormat] = useState("json");


  const [dataConfig, setDataConfig] = useState({
    test1: "",
    validation: "",
    test2: "",
  });

  const [robotArm, setRobotArm] = useState({
    position: false,
    velocity: false,
    current: false,
    gripper: false,
  });

  const [mobile, setMobile] = useState({
    linearVelocity: false,
    angularVelocity: false,
    odom: false,
  });

  const [sensors, setSensors] = useState({
    camera1: false,
    camera2: false,
    lidar: false,
    map: false,
  });

  // 저장 설정 전송
  const handleSave = () => {
    const payload = {
      type: "dataset_setting",
      Hertz,      
      robotArm,
      mobile,
      sensors,
      savePath,
      saveTask,
      fileName,
      fileFormat
    };

    if (wsOpen) {
      ws.send(JSON.stringify(payload));
      console.log("📤 저장 전송:", payload);
    } else {
      alert("⚠️ WebSocket 연결이 아직 준비되지 않았습니다.");
    }
  };

  // =========================
  // 데이터 수집 토글 + 경과 시간
  // =========================
  const [collecting, setCollecting] = useState(false);
  const [collectingStartMs, setCollectingStartMs] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const formatHMS = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!collecting || !collectingStartMs) {
      setElapsedSec(0);
      return;
    }
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - collectingStartMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [collecting, collectingStartMs]);

  const handleStratRecording = () => {
    const next = !collecting;
    const payload = {
      type: "start_recording", // 서버에서 이 type 처리하도록 구현됨
    };

    if (wsOpen) {
      wsSend({                          
        type: "start_recording",          
      });              
      setCollecting(next);
      if (next) {
        const now = Date.now();
        setCollectingStartMs(now);
        setElapsedSec(0);
      } else {
        setCollectingStartMs(null);
        setElapsedSec(0);
      }
    } else {
      alert("⚠️ WebSocket 연결이 아직 준비되지 않았습니다.");
    }
  };

  // =========================
  // 공통 WS 전송 헬퍼 (선택)
  // =========================
  const wsSend = (obj) => { 
    if (!ws || ws.readyState !== WebSocket.OPEN) { 
      console.warn("WS not ready");               
      return false;                                
    }                                              
    ws.send(JSON.stringify(obj));                  
    return true;                                   
  };                                               

  // =========================
  // 녹화 저장/폐기 핸들러
  // =========================
  const handleSaveRecording = () => { 
    wsSend({                          
      type: "save_recording",          
    });                               
    setCollecting(false);             
    setCollectingStartMs(null);       
    setElapsedSec(0);                 
  };                                   
     

  const handleDiscardRecording = () => { 
    wsSend({                             
      type: "discard_recording",         
    });
    setCollecting(false);                
    setCollectingStartMs(null);          
    setElapsedSec(0);                    
  };                                      

  return (
    <div className="bg-white rounded-lg shadow-md p-5 border border-gray-200 space-y-5">
      {/* 제목 + 구분선 */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Dataset setting</h2>
        </div>
        <div className="border-b border-gray-200 mt-2"></div>
      </div>

      {/* 본문: 좌우 2컬럼 */}
      <div className="grid grid-cols-1 md:grid-cols-[5.4fr_4.6fr] gap-4">
        {/* === Left: 토글 섹션들 === */}
        <div className="space-y-6">
          {/* Robot arm */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">Robot arm</h3>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="Position"
                value={robotArm.position}
                onChange={(v) => setRobotArm((s) => ({ ...s, position: v }))}
              />
              <ToggleChip
                label="Velocity"
                value={robotArm.velocity}
                onChange={(v) => setRobotArm((s) => ({ ...s, velocity: v }))}
              />
              <ToggleChip
                label="Current"
                value={robotArm.current}
                onChange={(v) => setRobotArm((s) => ({ ...s, current: v }))}
              />
              <ToggleChip
                label="Gripper"
                value={robotArm.gripper}
                onChange={(v) => setRobotArm((s) => ({ ...s, gripper: v }))}
              />
            </div>
          </section>

          {/* Mobile */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">Mobile</h3>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="Linear velocity"
                value={mobile.linearVelocity}
                onChange={(v) =>
                  setMobile((s) => ({ ...s, linearVelocity: v }))
                }
              />
              <ToggleChip
                label="Angular velocity"
                value={mobile.angularVelocity}
                onChange={(v) =>
                  setMobile((s) => ({ ...s, angularVelocity: v }))
                }
              />
              <ToggleChip
                label="Odom"
                value={mobile.odom}
                onChange={(v) => setMobile((s) => ({ ...s, odom: v }))}
              />
            </div>
          </section>

          {/* Sensor data */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">Sensor data</h3>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="Camera 1"
                value={sensors.camera1}
                onChange={(v) => setSensors((s) => ({ ...s, camera1: v }))}
              />
              <ToggleChip
                label="Camera 2"
                value={sensors.camera2}
                onChange={(v) => setSensors((s) => ({ ...s, camera2: v }))}
              />
              <ToggleChip
                label="Map"
                value={sensors.map}
                onChange={(v) => setSensors((s) => ({ ...s, map: v }))}
              />              
              <ToggleChip
                label="Lidar"
                value={sensors.lidar}
                onChange={(v) => setSensors((s) => ({ ...s, lidar: v }))}
              />

            </div>
          </section>
        </div>

        {/* === Right: 저장 설정 === */}
        <div className="space-y-2">
          {/* Data save period */}
          {/* === Data Save Settings (통합 섹션) === */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">Data Save Settings</h3>

            {/* 1행: Save Path (7) | Save Hz (3) */}
            <div className="grid grid-cols-10 gap-4">
              {/* Save Path */}
              <div className="col-span-7">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Save Path
                </label>
                <input
                  type="text"
                  placeholder="/home"
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Save Hz */}
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Save Hz
                </label>
                <input
                  type="number"
                  placeholder="10"
                  value={Hertz}
                  onChange={(e) => setHertz(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={1}
                  step={1}
                />
              </div>
            </div>

            {/* 2행: File Name (7) | File Format (3) */}
            <div className="grid grid-cols-10 gap-4">
              {/* File Name */}
              <div className="col-span-7">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  placeholder="data_1"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* File Format */}
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Format
                </label>
                <select
                  value={fileFormat}
                  onChange={(e) => setFileFormat(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="json">json</option>
                  <option value="csv">csv</option>
                  <option value="yaml">yaml</option>
                  <option value="hdf5">hdf5</option>

                </select>
              </div>
            </div>
          </section>


          {/* ✅ Task Description */}
          <section className="space-y-1">
            <label className="text-lg font-semibold text-gray-800">
              Task Description
            </label>
            <input
              type="text"
              placeholder="pick and place a red cube"
              value={saveTask}
              onChange={(e) => setsaveTask(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </section>

          {/* ✅ Robot Size(m) */}
          <section className="flex items-center space-x-2">
            <label className="text-lg font-semibold text-gray-800">
              Robot Size (m):
            </label>
            <input
              type="text"
              placeholder="0.6"
              value={robotSize}
              onChange={(e) => setRobotSize(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-24"
            />
          </section>

        </div>
      </div>



      {/* 버튼 영역: 저장(좌) / 데이터 수집 시작(우) */}
      <div className="pt-2">
        <div className="flex gap-3">
          {/* 좌측: Save Settings (4) */}
          <button
            onClick={handleSave}
            disabled={!wsOpen}
            className={`flex-[4] py-3 rounded-md font-semibold transition ${
              wsOpen
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
          >
            Saving settings
          </button>

          {/* 우측: Recording 영역 (6) */}
          <div className="flex-[6]">
            {!collecting ? (
              // === 기본 상태: Recording start ===
              <button
                onClick={handleStratRecording}
                disabled={!wsOpen}
                className={`w-full py-3 rounded-md font-semibold transition ${
                  !wsOpen
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
                title='서버에 "getting_data" 변수를 토글 전송'
              >
                Recording start
              </button>
            ) : (
              // === Recording 중: Saving / Discard 두 버튼 (5:5) ===
              <div className="flex gap-3">
                {/* Saving recording */}
                <button
                  onClick={handleSaveRecording}
                  className="flex-1 py-3 rounded-md font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Saving recording
                  <span className="ml-2 text-sm font-normal text-gray-200">
                    ({formatHMS(elapsedSec)})
                  </span>
                </button>

                {/* Discard recording */}
                <button
                  onClick={handleDiscardRecording}
                  className="flex-1 py-3 rounded-md font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                >
                  Discard recording
                </button>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* 버튼 영역: 저장(좌) / 데이터 수집 시작(우) 반반 */}
      {/* <div className="pt-2">
        <div className="flex gap-3"> */}
          {/* 저장 버튼 */}
          {/* <button
            onClick={handleSave}
            disabled={!wsOpen}
            className={`flex-1 py-3 rounded-md font-semibold transition ${
              wsOpen
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
          >
            Saving settings
          </button> */}

          {/* 데이터 수집 시작/중지 토글 버튼 (경과시간 표시) */}
          {/* <button
            onClick={handleToggleCollect}
            disabled={!wsOpen}
            className={`flex-1 py-3 rounded-md font-semibold transition ${
              !wsOpen
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : collecting
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
            title='서버에 "getting_data" 변수를 토글 전송'
          >
            {collecting
              ? `Recording stop (${formatHMS(elapsedSec)})`
              : "Recording start"}
          </button>
        </div>
      </div> */}
    </div>
  );
}
