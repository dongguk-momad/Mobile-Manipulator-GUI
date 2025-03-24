import React from 'react';

function Header({ connectionStatus }) {
  return (
    <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold">모바일 매니퓰레이터 원격 제어 시스템</h1>
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${connectionStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span>{connectionStatus ? '연결됨' : '연결 끊김'}</span>
      </div>
    </header>
  );
}

export default Header;