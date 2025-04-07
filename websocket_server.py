from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
import asyncio
import random
import threading
import cv2
import base64
import time

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 외부 접속 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- 리다이렉트: / -> /app ----------
@app.get("/")
def redirect_to_app():
    return RedirectResponse(url="/app")

# ---------- 정적 파일 (React 앱) ----------
app.mount("/app", StaticFiles(directory="dist", html=True), name="static")

# ---------- WebSocket: 센서 데이터 ----------
@app.websocket("/ws/data")
async def websocket_data(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            message = {
                "battery": random.uniform(0, 100),
                "speed": random.uniform(0, 2),
                "steering_angle": random.uniform(-30, 30),
                "gripper_opening": random.uniform(0, 50),
                "joint_angles": [random.uniform(0, 180) for _ in range(6)],
                "force_sensor": [random.uniform(0, 10) for _ in range(6)],
                "angle": random.uniform(-90, 90),
                "accel": random.randint(0, 100),
                "brake": random.randint(0, 100),
                "gear_status": random.choice(["중립", "전진", "후진"]),
            }
            await websocket.send_json(message)
            await asyncio.sleep(1)
    except Exception as e:
        print("❌ 데이터 WebSocket 연결 종료:", e)

# ---------- WebSocket: 이미지 스트리밍 ----------
connected_clients = set()
latest_frame = None

@app.websocket("/ws/image")
async def websocket_image(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        while True:
            if latest_frame:
                await websocket.send_json(latest_frame)
            await asyncio.sleep(0.05)
    except Exception as e:
        print("❌ 이미지 WebSocket 연결 종료:", e)
    finally:
        connected_clients.remove(websocket)

# ---------- 웹캠 캡처 루프 ----------
def webcam_loop():
    global latest_frame
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ 카메라 열기 실패")
        return

    while True:
        success, frame = cap.read()
        if not success:
            continue

        frame = cv2.resize(frame, (640, 480))  # 예: 640x480
        h, w, _ = frame.shape
        mid_h, mid_w = h // 2, w // 2

        quadrants = {
            "camera1_rgb": frame[0:mid_h, 0:mid_w],
            "camera1_depth": frame[0:mid_h, mid_w:w],
            "camera2_rgb": frame[mid_h:h, 0:mid_w],
            "camera2_depth": frame[mid_h:h, mid_w:w],
        }

        encoded_images = {}
        for cam_id, img in quadrants.items():
            resized = cv2.resize(img, (320, 240))  # 선택적으로 리사이즈
            _, buffer = cv2.imencode(".jpg", resized, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
            encoded = base64.b64encode(buffer).decode("utf-8")
            encoded_images[cam_id] = f"data:image/jpeg;base64,{encoded}"

        # ✅ 한꺼번에 WebSocket으로 보내기 위해 묶어 저장
        latest_frame = {
            "images": encoded_images
        }

        time.sleep(0.05)  # 20fps
# ---------- 웹캠 백그라운드 시작 ----------
threading.Thread(target=webcam_loop, daemon=True).start()
