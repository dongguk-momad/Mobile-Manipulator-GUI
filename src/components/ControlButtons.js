import React from "react";

function ControlButtons() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full h-full border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">조종 버튼</h2>
      
      <div className="space-y-4">
        <button className="w-full py-3 bg-red-600 text-white rounded-lg text-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">
          E-STOP
        </button>
        <button className="w-full py-3 bg-blue-600 text-white rounded-lg text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          Auto
        </button>
        <button className="w-full py-3 bg-green-600 text-white rounded-lg text-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400">
          Manual
        </button>
      </div>
    </div>
  );
}

export default ControlButtons;
