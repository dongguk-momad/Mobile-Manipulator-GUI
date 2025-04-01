import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function SensorInfo({ forceValues = [0, 0, 0, 0, 0, 0], cameraImages = {} }) {
  const [viewMode, setViewMode] = useState("text");

  const cameraOptions = [
    { id: "camera1_rgb", label: "카메라1 RGB" },
    { id: "camera1_depth", label: "카메라1 Depth" },
    { id: "camera2_rgb", label: "카메라2 RGB" },
    { id: "camera2_depth", label: "카메라2 Depth" },
  ];

  const [camera1Source, setCamera1Source] = useState(cameraOptions[0]);
  const [camera2Source, setCamera2Source] = useState(cameraOptions[2]);

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

  const forceData = forceValues.map((value, index) => ({
    axis: `F${index + 1}`,
    value: parseFloat(value.toFixed(2)),
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-full mx-auto border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">센서 정보</h2>

      <div className="space-y-3">
        {/* 카메라 1, 2 */}
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
          <p className="text-gray-700 font-medium">6축 Force 센서:</p>
          <select
            value={viewMode}
            onChange={handleModeChange}
            className="text-sm border rounded-md py-1 px-2 bg-gray-50"
          >
            <option value="text">텍스트</option>
            <option value="graph">그래프</option>
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
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="axis" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default SensorInfo;
