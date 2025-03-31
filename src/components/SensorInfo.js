import React, { useState } from "react";

function SensorInfo({
  forceValues = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
}) {
  // Camera source options
  const cameraOptions = [
    { id: "camera1_rgb", label: "카메라1 RGB", src: "/images/camera1.jpg" },
    { id: "camera1_depth", label: "카메라1 Depth", src: "/images/camera1_depth.jpg" },
    { id: "camera2_rgb", label: "카메라2 RGB", src: "/images/camera2.jpg" },
    { id: "camera2_depth", label: "카메라2 Depth", src: "/images/camera2_depth.jpg" },
  ];

  // Default selected cameras
  const [camera1Source, setCamera1Source] = useState(cameraOptions[0]);
  const [camera2Source, setCamera2Source] = useState(cameraOptions[2]);

  // Handlers for dropdown changes
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
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">센서 정보</h2>

      <div className="space-y-3">
        {/* 카메라 1, 2 */}
        <div className="flex space-x-4 mb-6">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              {/* <h3 className="text-gray-700 font-medium">영상 1</h3> */}
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
              src={camera1Source.src}
              alt={camera1Source.label}
              className="w-full h-auto rounded-lg object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              {/* <h3 className="text-gray-700 font-medium">영상 2</h3> */}
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
              src={camera2Source.src}
              alt={camera2Source.label}
              className="w-full h-auto rounded-lg object-cover"
            />
          </div>
        </div>

        {/* Force 센서 */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-gray-700 font-medium mb-2">6축 Force 센서:</p>
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
        </div>
      </div>
    </div>
  );
}

export default SensorInfo;