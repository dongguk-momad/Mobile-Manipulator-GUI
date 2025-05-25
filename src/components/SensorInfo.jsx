import React, { useState, useEffect, useRef } from "react"; // useRef import 추가
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const MAX_HISTORY_LENGTH = 100;

function SensorInfo({ forceValues = [0, 0, 0, 0, 0, 0], cameraImages = {} }) {
  const [viewMode, setViewMode] = useState("text");
  const [historicalForceData, setHistoricalForceData] = useState([]);
  const nextSampleId = useRef(0); // 데이터 순번을 위한 ref

  const cameraOptions = [
    { id: "mobile_rgb", label: "Camera1 RGB" },
    { id: "mobile_depth", label: "Camera1 Depth" },
    { id: "hand_rgb", label: "Camera2 RGB" },
    { id: "hand_depth", label: "Camera2 Depth" },
  ];

  const [camera1Source, setCamera1Source] = useState(cameraOptions[0]);
  const [camera2Source, setCamera2Source] = useState(cameraOptions[2]);

  useEffect(() => {
    if (forceValues && forceValues.length === 6) {
      const newPoint = {
        // X축에 표시될 데이터 순번
        sample: nextSampleId.current, // 현재 순번 사용
        // Y축에 표시될 각 센서 값
        F1: parseFloat(forceValues[0].toFixed(2)),
        F2: parseFloat(forceValues[1].toFixed(2)),
        F3: parseFloat(forceValues[2].toFixed(2)),
        F4: parseFloat(forceValues[3].toFixed(2)),
        F5: parseFloat(forceValues[4].toFixed(2)),
        F6: parseFloat(forceValues[5].toFixed(2)),
      };
      nextSampleId.current += 1; // 다음 순번으로 증가

      setHistoricalForceData(prevData => {
        const updatedData = [...prevData, newPoint];
        if (updatedData.length > MAX_HISTORY_LENGTH) {
          return updatedData.slice(updatedData.length - MAX_HISTORY_LENGTH);
        }
        return updatedData;
      });
    }
  }, [forceValues]);

  const handleModeChange = (e) => {
    setViewMode(e.target.value);
  };

  const handleCamera1Change = (e) => {
    const selected = cameraOptions.find(option => option.id === e.target.value);
    setCamera1Source(selected);
  };

  const handleCamera2Change = (e) => {
    const selected = cameraOptions.find(option => option.id === e.target.value);
    setCamera2Source(selected);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-full mx-auto border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Sensor Status</h2>
      <div className="space-y-3">
        {/* 카메라 UI 부분 (생략) */}
        <div className="flex space-x-4 mb-6">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <select 
                value={camera1Source.id}
                onChange={handleCamera1Change}
                className="text-sm border rounded-md py-1 px-2 bg-gray-50"
              >
                {cameraOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <img
              src={cameraImages[camera1Source.id] || ""}
              alt={camera1Source.label}
              className="w-full h-auto rounded-lg object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <select 
                value={camera2Source.id}
                onChange={handleCamera2Change}
                className="text-sm border rounded-md py-1 px-2 bg-gray-50"
              >
                {cameraOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <img
              src={cameraImages[camera2Source.id] || ""}
              alt={camera2Source.label}
              className="w-full h-auto rounded-lg object-cover"
            />
          </div>
        </div>
        {/* Force 센서 표시 방식 선택 */}
        <div className="flex justify-between items-center mb-3">
          <p className="text-gray-700 font-medium">6DoF Force-Torque:</p>
          <select
            value={viewMode}
            onChange={handleModeChange}
            className="text-sm border rounded-md py-1 px-2 bg-gray-50"
          >
            <option value="text">Test</option>
            <option value="graph">Graph</option>
          </select>
        </div>

        {/* 표시 방식 분기 */}
        {viewMode === "text" ? (
          <div className="grid grid-cols-3 gap-2">
            {forceValues.map((value, index) => (
              <div
                key={index}
                className="bg-blue-50 p-2 rounded text-center text-blue-700 font-mono"
              >
                {value.toFixed(1)}
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalForceData}>
                <CartesianGrid strokeDasharray="3 3" />
                {/* XAxis dataKey를 "sample"로 변경 */}
                <XAxis dataKey="sample" /> 
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="F1" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} dot={false} name="F1" />
                <Line type="monotone" dataKey="F2" stroke="#82ca9d" strokeWidth={2} activeDot={{ r: 6 }} dot={false} name="F2" />
                <Line type="monotone" dataKey="F3" stroke="#ffc658" strokeWidth={2} activeDot={{ r: 6 }} dot={false} name="F3" />
                <Line type="monotone" dataKey="F4" stroke="#ff7300" strokeWidth={2} activeDot={{ r: 6 }} dot={false} name="F4" />
                <Line type="monotone" dataKey="F5" stroke="#00C49F" strokeWidth={2} activeDot={{ r: 6 }} dot={false} name="F5" />
                <Line type="monotone" dataKey="F6" stroke="#FF00FF" strokeWidth={2} activeDot={{ r: 6 }} dot={false} name="F6" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default SensorInfo;