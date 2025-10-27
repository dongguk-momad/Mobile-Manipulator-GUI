import React from "react";

function CommunicationInfo({
  camera1Fps = 0.0,
  camera2Fps = 0.0,
  camera1Latency = 0.0,
  camera2Latency = 0.0,
  logs = [],
}) {
  const getFpsColor = (fps) => {
    if (fps === 0) return "text-red-600";
    if (fps < 15) return "text-yellow-500";
    return "text-green-600";
  };

  const getLatencyColor = (latency) => {
    if (latency <= 180) return "text-green-600";
    if (latency <= 220) return "text-yellow-500";
    return "text-red-600";
  };

  const getFpsBgColor = (fps) => {
    if (fps === 0) return "bg-red-100";
    if (fps < 15) return "bg-yellow-100";
    return "bg-green-100";
  };

  const getLatencyBgColor = (latency) => {
    if (latency <= 180) return "bg-green-100";
    if (latency <= 220) return "bg-yellow-100";
    return "bg-red-100";
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-full mx-auto border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Communication Status</h2>

      {/* 통신 수치 정보 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`flex justify-between items-center p-3 border border-gray-200 rounded-lg ${getFpsBgColor(camera1Fps)}`}>
          <span className="text-gray-700 font-medium">Camera1 FPS:</span>
          <span className={`font-mono ml-auto ${getFpsColor(camera1Fps)}`}>{camera1Fps.toFixed(2)} fps</span>
        </div>

        <div className={`flex justify-between items-center p-3 border border-gray-200 rounded-lg ${getFpsBgColor(camera2Fps)}`}>
          <span className="text-gray-700 font-medium">Camera2 FPS:</span>
          <span className={`font-mono ml-auto ${getFpsColor(camera2Fps)}`}>{camera2Fps.toFixed(2)} fps</span>
        </div>

        <div className={`flex justify-between items-center p-3 border border-gray-200 rounded-lg ${getLatencyBgColor(camera1Latency)}`}>
          <span className="text-gray-700 font-medium">Camera1 Latency:</span>
          <span className={`font-mono ml-auto ${getLatencyColor(camera1Latency)}`}>{camera1Latency.toFixed(2)} ms</span>
        </div>

        <div className={`flex justify-between items-center p-3 border border-gray-200 rounded-lg ${getLatencyBgColor(camera2Latency)}`}>
          <span className="text-gray-700 font-medium">Camera2 Latency:</span>
          <span className={`font-mono ml-auto ${getLatencyColor(camera2Latency)}`}>{camera2Latency.toFixed(2)} ms</span>
        </div>
      </div>

      {/* 로그 영역 */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-gray-700 font-medium mb-2">Log</p>
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
