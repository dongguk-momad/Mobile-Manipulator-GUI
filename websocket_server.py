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

# ROS2 관련
import rclpy
from std_msgs.msg import Float32, Float32MultiArray
from sensor_msgs.msg import JointState

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- 정적 파일 (React 앱) ----------
app.mount("/app", StaticFiles(directory="dist", html=True), name="static")

@app.get("/")
def redirect_to_app():
    return RedirectResponse(url="/app")

# ---------- 센서 데이터 저장용 공유 변수 ----------
sensor_data = {
    "battery": 0.0,
    "speed": 0.0,
    "steering_angle": 0.0,
    "gripper_opening": 0.0,
    "joint_angles": [0.0] * 6,
    "force_sensor": [0.0] * 6,
    "angle": 0.0,
    "accel": 0,
    "brake": 0,
    "gear_status": "중립"
}
sensor_data_lock = threading.Lock()

# ---------- ROS2 콜백 ----------
def battery_callback(msg):
    with sensor_data_lock:
        sensor_data["battery"] = msg.data

def joint_callback(msg):
    with sensor_data_lock:
        sensor_data["joint_angles"] = list(msg.position)

def force_callback(msg):
    with sensor_data_lock:
        sensor_data["force_sensor"] = list(msg.data)

# ---------- ROS2 노드 스레드 ----------
def ros2_node_spin():
    rclpy.init()
    node = rclpy.create_node("web_bridge")

    node.create_subscription(Float32, "/battery", battery_callback, 10)
    node.create_subscription(JointState, "/joint_states", joint_callback, 10)
    node.create_subscription(Float32MultiArray, "/force_sensor", force_callback, 10)

    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

threading.Thread(target=ros2_node_spin, daemon=True).start()

# ---------- WebSocket: 센서 데이터 ----------
@app.websocket("/ws/data")
async def websocket_data(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            with sensor_data_lock:
                await websocket.send_json(sensor_data.copy())
            await asyncio.sleep(0.05)  # 20Hz
    except Exception as e:
        print("\u274c 데이터 WebSocket 연결 종료:", e)

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
        print("\u274c 이미지 WebSocket 연결 종료:", e)
    finally:
        connected_clients.remove(websocket)

# ---------- 웹캠 캡처 루프 ----------
def webcam_loop():
    global latest_frame
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("\u274c 카메라 열기 실패")
        return

    while True:
        success, frame = cap.read()
        if not success:
            continue

        frame = cv2.resize(frame, (640, 480))
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
            resized = cv2.resize(img, (320, 240))
            _, buffer = cv2.imencode(".jpg", resized, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
            encoded = base64.b64encode(buffer).decode("utf-8")
            encoded_images[cam_id] = f"data:image/jpeg;base64,{encoded}"

        latest_frame = {
            "images": encoded_images
        }

        time.sleep(0.05)  # 20fps

threading.Thread(target=webcam_loop, daemon=True).start()
