import React from "react";

function RobotInfo() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full h-full border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">로봇 정보</h2>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-medium">로봇 상태:</span>
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">E-STOP</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-medium">속도:</span>
          <span className="text-gray-800 font-mono">0.0 m/s</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-medium">조향 각도:</span>
          <span className="text-gray-800 font-mono">0°</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-medium">배터리 상태:</span>
          <div className="flex items-center">
            <div className="w-24 bg-gray-200 rounded-full h-2.5 mr-2">
              <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <span className="text-gray-800 font-medium">100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RobotInfo;