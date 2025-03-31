const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });
console.log("🚀 WebSocket 서버 실행 중 (ws://localhost:8080)");

wss.on("connection", (ws) => {
  console.log("클라이언트 연결됨");

  const interval = setInterval(() => {
    const message = {
      battery: Math.random() * 100,
      speed: Math.random() * 2,
      steering_angle: Math.random() * 60 - 30,
      gripper_opening: Math.random() * 50,
      joint_angles: Array.from({ length: 6 }, () => Math.random() * 180),
      force_sensor: Array.from({ length: 6 }, () => Math.random() * 10),
      angle: Math.random() * 180 - 90,
      accel: Math.floor(Math.random() * 100),
      brake: Math.floor(Math.random() * 100),
      gear_status: ["중립", "전진", "후진"][Math.floor(Math.random() * 3)],
    };

    ws.send(JSON.stringify(message));
  }, 1000);

  ws.on("close", () => {
    clearInterval(interval);
    console.log("클라이언트 연결 종료");
  });
});
