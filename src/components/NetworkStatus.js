import React from "react";

function CommunicationInfo({
  camera1Fps = 0.0,
  camera2Fps = 0.0,
  camera1Latency = 0.0,
  camera2Latency = 0.0,
  logs = [],
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-full mx-auto border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">통신 정보</h2>

      {/* 통신 수치 정보 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex justify-between items-center p-3 bg-blue-50 border border-gray-200 rounded-lg">
          <span className="text-gray-700 font-medium">카메라1 FPS:</span>
          <span className="text-gray-800 font-mono ml-auto">{camera1Fps.toFixed(1)} fps</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-blue-50 border border-gray-200 rounded-lg">
          <span className="text-gray-700 font-medium">카메라2 FPS:</span>
          <span className="text-gray-800 font-mono ml-auto">{camera2Fps.toFixed(1)} fps</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-blue-50 border border-gray-200 rounded-lg">
          <span className="text-gray-700 font-medium">카메라1 지연시간:</span>
          <span className="text-gray-800 font-mono ml-auto">{camera1Latency.toFixed(1)} ms</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-blue-50 border border-gray-200 rounded-lg">
          <span className="text-gray-700 font-medium">카메라2 지연시간:</span>
          <span className="text-gray-800 font-mono ml-auto">{camera2Latency.toFixed(1)} ms</span>
        </div>
      </div>

      {/* 로그 영역 */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-gray-700 font-medium mb-2">로그</p>
        <div className="bg-gray-50 p-3 rounded border border-gray-200 h-24 overflow-y-auto font-mono text-sm text-gray-600 space-y-1">
          {logs.length === 0 ? (
            <p className="text-gray-400 italic">로그 없음</p>
          ) : (
            logs.map((log, idx) => <p key={idx}>{log}</p>)
          )}
        </div>
      </div>
    </div>
  );
}

export default CommunicationInfo;
