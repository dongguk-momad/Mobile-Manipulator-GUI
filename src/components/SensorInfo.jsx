import React, { useState } from "react";

function SensorInfo({ cameraImages = {} }) {
  const cameraOptions = [
    { id: "mobile_rgb", label: "Camera1 RGB" },
    { id: "mobile_depth", label: "Camera1 Depth" },
    { id: "hand_rgb", label: "Camera2 RGB" },
    { id: "hand_depth", label: "Camera2 Depth" },
  ];

  const [camera1Source, setCamera1Source] = useState(cameraOptions[0]);
  const [camera2Source, setCamera2Source] = useState(cameraOptions[2]);

  // 단일 이미지 소스 키
  const SINGLE_IMAGE_ID = "map";

  const handleCamera1Change = (e) => {
    const selected = cameraOptions.find((option) => option.id === e.target.value);
    setCamera1Source(selected);
  };

  const handleCamera2Change = (e) => {
    const selected = cameraOptions.find((option) => option.id === e.target.value);
    setCamera2Source(selected);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-full mx-auto border border-gray-200">
      {/* 제목 */}
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">
        Sensor Status
      </h2>

      {/* 카메라 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 카메라 1 */}
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <select
              value={camera1Source.id}
              onChange={handleCamera1Change}
              className="text-sm border rounded-md py-1 px-2 bg-gray-50"
            >
              {cameraOptions.map((option) => (
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

        {/* 카메라 2 */}
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <select
              value={camera2Source.id}
              onChange={handleCamera2Change}
              className="text-sm border rounded-md py-1 px-2 bg-gray-50"
            >
              {cameraOptions.map((option) => (
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

        {/* Map */}
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-700 font-medium mt-1.5">
              Map
            </span>
          </div>
          <img
            src={cameraImages[SINGLE_IMAGE_ID] || ""}
            alt="map"
            className="w-full h-auto rounded-lg object-cover"
          />
        </div>
      </div>
    </div>
  );
}

export default SensorInfo;
