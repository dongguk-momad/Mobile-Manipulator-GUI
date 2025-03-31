import React from "react";

function SensorInfo({
  camera1Src = "/images/camera1.jpg",
  camera2Src = "/images/camera2.jpg",
  forceValues = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-full mx-auto border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">센서 정보</h2>

      <div className="space-y-3">
        {/* 카메라 1, 2 */}
        <div className="flex space-x-4 mb-6">
          <div className="flex-1">
            <h3 className="text-center text-gray-700 font-medium mb-2">카메라 1</h3>
            <img
              src={camera1Src}
              alt="카메라1 영상"
              className="w-full h-auto rounded-lg object-cover"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-center text-gray-700 font-medium mb-2">카메라 2</h3>
            <img
              src={camera2Src}
              alt="카메라2 영상"
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
