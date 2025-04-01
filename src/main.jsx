// src/main.jsx 또는 src/index.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 올바르게 root 선언하고 StrictMode로 감싸기
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// reportWebVitals 관련 줄 제거 (없으면 생략해도 됨)
