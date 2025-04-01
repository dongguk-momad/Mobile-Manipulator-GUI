import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: "/app/", // 👉 React 앱을 FastAPI의 /app 경로에서 서빙
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8000',  // 👉 FastAPI WebSocket 서버
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path, // 👉 '/ws' 경로 그대로 유지
      },
    },
    allowedHosts: [".ngrok-free.app"], // 👉 외부 ngrok 접속 허용
  },
});
