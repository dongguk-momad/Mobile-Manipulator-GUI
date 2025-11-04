import React from "react";

function SensorInfo({ cameraImages = {} }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-full mx-auto border border-gray-200">
      {/* 제목 */}
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">
        Sensor Status
      </h2>

      {/* 카메라 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Camera 1 RGB */}
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-700 font-medium mt-1.5">
              Camera 1 RGB
            </span>
          </div>
          <img
            src={cameraImages["mobile_rgb"] || ""}
            alt="Camera 1 RGB"
            className="w-full h-auto rounded-lg object-cover"
          />
        </div>

        {/* Camera 2 RGB */}
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-700 font-medium mt-1.5">
              Camera 2 RGB
            </span>
          </div>
          <img
            src={cameraImages["hand_rgb"] || ""}
            alt="Camera 2 RGB"
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
            src={cameraImages["map"] || ""}
            alt="map"
            className="w-full h-auto rounded-lg object-cover"
          />
        </div>
      </div>
    </div>
  );
}

export default SensorInfo;
