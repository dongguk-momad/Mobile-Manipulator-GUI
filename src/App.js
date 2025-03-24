import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Header from './components/Header';
import CameraView from './components/CameraView';
import LidarView from './components/LidarView';
import RobotStatus from './components/RobotStatus';
import ControllerInput from './components/ControllerInput';
import AlertLog from './components/AlertLog';
import './App.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [robotStatus, setRobotStatus] = useState({
    battery: 0,
    motorTemp: 0,
    latency: 0,
    gripperState: 'unknown',
    jointAngles: [0, 0, 0, 0, 0]
  });
  
  useEffect(() => {
    const socket = io('http://localhost:5000');
    
    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected to server');
    });
    
    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });
    
    socket.on('robotStatus', (data) => {
      setRobotStatus(data);
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);
  
  return (
    <div className="flex flex-col h-screen">
      <Header connectionStatus={connected} />
      <div className="flex flex-1 p-4 bg-gray-100 overflow-hidden">
        <div className="flex flex-col w-2/3 pr-4">
          <div className="bg-white rounded-lg shadow mb-4 p-4 h-3/5">
            <h2 className="text-lg font-semibold mb-2">카메라 및 라이다 뷰</h2>
            <div className="h-3/4 mb-2">
              <CameraView />
            </div>
            <div className="h-1/4">
              <LidarView />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 h-2/5">
            <AlertLog />
          </div>
        </div>
        <div className="flex flex-col w-1/3">
          <div className="bg-white rounded-lg shadow mb-4 p-4 h-1/2">
            <RobotStatus status={robotStatus} />
          </div>
          <div className="bg-white rounded-lg shadow p-4 h-1/2">
            <ControllerInput />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;