from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
import asyncio
import threading
import cv2
import base64
import time
import numpy as np
from collections import deque # Latency 평균 계산용

# ROS2 관련
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from std_msgs.msg import Float32, Float32MultiArray
from sensor_msgs.msg import JointState, Image
from cv_bridge import CvBridge, CvBridgeError

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 실제 배포 시에는 특정 도메인으로 제한하는 것이 좋습니다.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- 정적 파일 (React 앱) ----------
# 'dist' 디렉토리가 이 스크립트와 같은 위치에 있거나, 경로를 알맞게 수정해야 합니다.
try:
    app.mount("/app", StaticFiles(directory="dist", html=True), name="static")
except RuntimeError:
    print("Warning: 'dist' directory not found for StaticFiles. UI will not be served.")
    print("If you have a UI, ensure the 'dist' folder is in the correct location.")


@app.get("/")
async def redirect_to_app():
    # /app 경로가 마운트되지 않았을 경우를 대비한 간단한 메시지 반환
    if any(route.path == "/app" for route in app.routes if hasattr(route, "path")):
        return RedirectResponse(url="/app")
    return {"message": "FastAPI server is running. UI not found at /app."}

# ---------- 센서 데이터 저장용 공유 변수 ----------
sensor_data = {
    "battery": 0.0,
    "speed": 0.0,
    "steering_angle": 0.0,
    "gripper_opening": 0.0,
    "joint_angles": [0.0] * 6,
    "master_joint_values": [0.0] * 6,
    "force_sensor": [0.0] * 6,
    "angle": 0.0,
    "accel": 0,
    "brake": 0,
    "gear_status": "중립"
}
sensor_data_lock = threading.Lock()

# ---------- ROS2 이미지 데이터 저장을 위한 변수 및 Lock ----------
cv_bridge = CvBridge()
# (cv_image, header_stamp_sec, header_stamp_nanosec) 튜플 저장
ros_received_images = {
    "camera1_rgb": None,   # mobile_cam/rgb
    "camera1_depth": None, # mobile_cam/depth
    "camera2_rgb": None,   # hand_cam/rgb
    "camera2_depth": None, # hand_cam/depth
}
ros_images_lock = threading.Lock()

# ---------- FPS 및 Latency 측정을 위한 변수 ----------
gui_image_processed_count = 0
gui_fps_calc_start_time = time.perf_counter()
latencies = { # 각 카메라별 최근 Latency (ms) 저장 (평균 계산용)
    "camera1_rgb": deque(maxlen=100),
    "camera1_depth": deque(maxlen=100),
    "camera2_rgb": deque(maxlen=100),
    "camera2_depth": deque(maxlen=100),
}
latency_log_interval = 5.0  # 초 단위로 평균 Latency 로깅 간격
last_latency_log_time = time.perf_counter()

# ---------- ROS2 노드 및 클럭 인스턴스 (전역으로 관리) ----------
ros2_node: Node = None # 타입 힌트 추가
array_publisher = None

# ---------- ROS2 이미지 콜백 공통 처리 함수 ----------
def process_image_callback(msg: Image, image_key: str):
    global ros_received_images, ros_images_lock
    try:
        header_stamp_sec = msg.header.stamp.sec
        header_stamp_nanosec = msg.header.stamp.nanosec
        
        processed_image = None
        if "depth" in image_key:
            cv_image_depth_raw = cv_bridge.imgmsg_to_cv2(msg, desired_encoding="passthrough")
            
            # Depth 이미지 시각화 처리 (예: 0.1m ~ 2m 범위를 0-255로 정규화 후 JET 컬러맵 적용)
            # 실제 환경과 카메라 특성에 맞게 min_d, max_d 값 조절이 매우 중요합니다.
            min_d, max_d = (0.1, 1.0) if "camera2" in image_key else (0.1, 2.0) # hand vs mobile camera depth range
            
            # NaN이나 inf 값을 처리 (예: 최대값으로 대체)
            cv_image_depth_raw = np.nan_to_num(cv_image_depth_raw, nan=max_d, posinf=max_d, neginf=min_d)
            
            # 0 이하의 값은 유효하지 않다고 가정 (또는 센서 스펙에 따라 조절)
            valid_depth_mask = cv_image_depth_raw > 1e-3 # 아주 작은 양수보다 큰 경우만
            
            if np.any(valid_depth_mask):
                # 값들을 min_d와 max_d 사이로 클리핑
                clipped_depth = np.clip(cv_image_depth_raw, min_d, max_d)
                # 정규화 (0~1 범위로)
                normalized_depth = (clipped_depth - min_d) / (max_d - min_d)
                depth_image_uint8 = (normalized_depth * 255).astype(np.uint8)
                processed_image = cv2.applyColorMap(depth_image_uint8, cv2.COLORMAP_JET)
            else: # 유효한 depth 값이 없는 경우 (예: 전체가 0이거나 너무 가까운 경우)
                processed_image = np.zeros((msg.height, msg.width, 3), dtype=np.uint8) # 검은색 BGR 이미지
        else: # RGB 이미지
            # Isaac Sim은 보통 RGB로 발행, OpenCV는 BGR을 기본으로 사용하므로 "rgb8" -> "bgr8" 변환
            processed_image = cv_bridge.imgmsg_to_cv2(msg, desired_encoding="bgr8") 
            
        with ros_images_lock:
            ros_received_images[image_key] = (processed_image, header_stamp_sec, header_stamp_nanosec)
            
    except CvBridgeError as e:
        if ros2_node: ros2_node.get_logger().error(f"CvBridge Error for {image_key}: {e}")
        else: print(f"CvBridge Error for {image_key}: {e}")
    except Exception as e:
        if ros2_node: ros2_node.get_logger().error(f"Callback Error for {image_key}: {e}")
        else: print(f"Callback Error for {image_key}: {e}")

# 각 이미지 토픽에 대한 콜백 함수
def mobile_rgb_callback(msg: Image): process_image_callback(msg, "camera1_rgb")
def mobile_depth_callback(msg: Image): process_image_callback(msg, "camera1_depth")
def hand_rgb_callback(msg: Image): process_image_callback(msg, "camera2_rgb")
def hand_depth_callback(msg: Image): process_image_callback(msg, "camera2_depth")

# ---------- 기존 센서 데이터 ROS2 콜백 ----------
def battery_callback(msg: Float32):
    with sensor_data_lock:
        sensor_data["battery"] = msg.data

def joint_callback(msg: JointState):
    with sensor_data_lock:
        # JointState.position은 튜플일 수 있으므로 list로 변환
        sensor_data["joint_angles"] = list(msg.position)

def force_callback(msg: Float32MultiArray):
    with sensor_data_lock:
        sensor_data["force_sensor"] = list(msg.data)

# ---------- ROS2 노드 실행 스레드 ----------
def ros2_node_spin():
    global array_publisher, ros2_node
    
    if not rclpy.ok(): # 이미 init된 경우를 대비 (엄밀히는 컨텍스트 관리 필요)
        rclpy.init()
        
    ros2_node = Node("web_gui_server_node") # ROS2 노드 생성

    # 기존 센서 구독
    ros2_node.create_subscription(Float32, "/battery", battery_callback, 10)
    ros2_node.create_subscription(JointState, "/joint_states", joint_callback, 10)
    ros2_node.create_subscription(Float32MultiArray, "/force_sensor", force_callback, 10)

    # 이미지 토픽 구독 (QoS 설정)
    qos_profile_image = QoSProfile(
        reliability=ReliabilityPolicy.BEST_EFFORT,
        history=HistoryPolicy.KEEP_LAST,
        depth=1  # 최신 이미지만 받도록 설정
    )
    ros2_node.create_subscription(Image, "/mobile_cam/rgb", mobile_rgb_callback, qos_profile_image)
    ros2_node.create_subscription(Image, "/mobile_cam/depth", mobile_depth_callback, qos_profile_image)
    ros2_node.create_subscription(Image, "/hand_cam/rgb", hand_rgb_callback, qos_profile_image)
    ros2_node.create_subscription(Image, "/hand_cam/depth", hand_depth_callback, qos_profile_image)
    
    ros2_node.get_logger().info("ROS 2 GUI Server node started. Subscribing to sensor and image topics.")

    array_publisher = ros2_node.create_publisher(Float32MultiArray, "/master_joint_values", 10)

    try:
        rclpy.spin(ros2_node)
    except KeyboardInterrupt:
        ros2_node.get_logger().info('KeyboardInterrupt received, shutting down ROS 2 node.')
    except Exception as e:
        ros2_node.get_logger().error(f'Exception in ROS 2 spin: {str(e)}')
    finally:
        if ros2_node and ros2_node.context.ok(): # 컨텍스트가 유효할 때만 destroy
            ros2_node.destroy_node()
        if rclpy.ok(): # 한 번만 shutdown 호출 보장
            rclpy.shutdown()
        print("ROS 2 node shutdown complete.")

# ---------- WebSocket 핸들러들 ----------
@app.websocket("/ws/control")
async def websocket_control(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # master_joint_values는 sensor_data 딕셔너리 내에 있으므로 동일 lock 사용
            # 하지만 array_publisher는 ROS 컨텍스트에서 사용되므로 별도 Lock 불필요 (rclpy가 스레드 안전성 일부 보장)
            msg_control = await websocket.receive_json() 
            with sensor_data_lock:
                sensor_data["master_joint_values"] = list(msg_control["master_joint_values"])
            
            if array_publisher: # array_publisher가 초기화된 후에만 publish
                ros_msg = Float32MultiArray(data=sensor_data["master_joint_values"])
                array_publisher.publish(ros_msg)
            await asyncio.sleep(0.05)  # 약 20Hz
    except Exception as e:
        print(f"\u274c 컨트롤 WebSocket 연결 종료: {e}")

@app.websocket("/ws/data")
async def websocket_data(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            with sensor_data_lock:
                data_to_send = sensor_data.copy() # 전체 sensor_data 복사
            await websocket.send_json(data_to_send)
            await asyncio.sleep(0.05)  # 약 20Hz
    except Exception as e:
        print(f"\u274c 데이터 WebSocket 연결 종료: {e}")

# ---------- 이미지 스트리밍 WebSocket ----------
connected_clients = set()
latest_frame = None 
latest_frame_lock = threading.Lock() 

@app.websocket("/ws/image")
async def websocket_image(websocket: WebSocket):
    global latest_frame, latest_frame_lock
    await websocket.accept()
    connected_clients.add(websocket)
    # print(f"클라이언트 연결: {websocket.client}, 현재 연결된 클라이언트: {len(connected_clients)}")
    try:
        while True:
            frame_to_send = None
            with latest_frame_lock:
                if latest_frame:
                    frame_to_send = latest_frame # 전송할 프레임 참조 (얕은 복사)
            
            if frame_to_send:
                await websocket.send_json(frame_to_send)
            await asyncio.sleep(0.05) # 클라이언트 전송 주기 (약 20 FPS)
    except Exception as e:
        # print(f"\u274c 이미지 WebSocket 연결({websocket.client}) 종료: {e}")
        pass # 연결 종료 시 발생하는 일반적인 예외는 조용히 처리
    finally:
        connected_clients.remove(websocket)
        # print(f"클라이언트 연결 해제: {websocket.client}, 현재 연결된 클라이언트: {len(connected_clients)}")


# ---------- ROS 이미지 처리 및 latest_frame 업데이트 루프 ----------
def process_ros_images_loop():
    global latest_frame, latest_frame_lock, ros_received_images, ros_images_lock
    global gui_image_processed_count, gui_fps_calc_start_time
    global latencies, last_latency_log_time, latency_log_interval
    global ros2_node # 전역 ROS2 노드 인스턴스 사용

    # ros2_node가 초기화될 때까지 기다립니다.
    print("process_ros_images_loop: Waiting for ROS 2 node to be initialized...")
    while ros2_node is None or not hasattr(ros2_node, 'get_clock') or not rclpy.ok():
        if not rclpy.ok():
            print("process_ros_images_loop: RCLPY not OK. Exiting thread.")
            return
        time.sleep(0.5)
            
    print("process_ros_images_loop: ROS 2 node initialized. Starting image processing.")
    node_clock = ros2_node.get_clock()

    while rclpy.ok(): # ROS가 활성 상태일 때만 루프 실행
        images_to_process_with_ts = {} # (cv_image, original_stamp_sec, original_stamp_nanosec)
        with ros_images_lock:
            for key, value_tuple in ros_received_images.items():
                if value_tuple is not None:
                    # 튜플 (cv_image, sec, nanosec) 전체를 복사
                    images_to_process_with_ts[key] = (value_tuple[0].copy(), value_tuple[1], value_tuple[2])
                    ros_received_images[key] = None # 중요: 처리 후 None으로 설정하여 중복 방지

        if not images_to_process_with_ts:
            time.sleep(0.01) 
            continue

        # Latency 계산을 위한 현재 ROS 시간 (이미지 세트 처리 시작 시점)
        current_ros_time_msg = node_clock.now().to_msg()
        current_ros_time_total_ns = (current_ros_time_msg.sec * 1_000_000_000) + current_ros_time_msg.nanosec

        encoded_images = {}
        all_images_processed_for_this_frame = True # 이번 프레임에 모든 종류의 이미지가 다 있었는지

        # 기대하는 모든 카메라 키 (필요하다면 업데이트)
        expected_cam_keys = ["camera1_rgb", "camera1_depth", "camera2_rgb", "camera2_depth"]

        for cam_id_key in expected_cam_keys:
            if cam_id_key in images_to_process_with_ts:
                img_cv, header_sec, header_nanosec = images_to_process_with_ts[cam_id_key]
                if img_cv is None: 
                    all_images_processed_for_this_frame = False
                    continue # 혹시 모를 None 값
                
                try:
                    resized = cv2.resize(img_cv, (320, 240)) 
                    _, buffer = cv2.imencode(".jpg", resized, [int(cv2.IMWRITE_JPEG_QUALITY), 65]) # 품질 약간 조정
                    encoded = base64.b64encode(buffer).decode("utf-8")
                    encoded_images[cam_id_key] = f"data:image/jpeg;base64,{encoded}"

                    original_stamp_total_ns = (header_sec * 1_000_000_000) + header_nanosec
                    latency_ns = current_ros_time_total_ns - original_stamp_total_ns
                    latencies[cam_id_key].append(latency_ns / 1_000_000) # ms 단위

                except Exception as e:
                    print(f"Error encoding/processing image {cam_id_key}: {e}")
                    encoded_images[cam_id_key] = "" # 에러 시 빈 이미지
                    all_images_processed_for_this_frame = False
            else: # 해당 키의 이미지가 이번 사이클에 수신되지 않음
                all_images_processed_for_this_frame = False
                # 이전 프레임의 이미지를 그대로 사용할 수도 있지만, 여기서는 일단 비워둠
                # 또는 encoded_images에 해당 키를 넣지 않거나, placeholder 이미지 설정
                # encoded_images[cam_id_key] = "" # 또는 placeholder


        if encoded_images: # 인코딩된 이미지가 하나라도 있다면 latest_frame 업데이트
            with latest_frame_lock:
                if latest_frame is None: 
                    latest_frame = {"images": {}}
                # update는 키가 없으면 추가하고, 있으면 값을 변경합니다.
                # 만약 특정 카메라 이미지가 이번 루프에 없었다면, 해당 키는 업데이트되지 않고 이전 값을 유지하게 됩니다.
                # 모든 카메라 이미지가 항상 채워지길 원한다면, `encoded_images`를 초기화하고 채우는 방식 고려.
                # 여기서는 수신된 것만 업데이트하는 방식으로 동작 (키가 없다면 추가, 있다면 값 변경).
                # 더 나은 방법은 `latest_frame["images"]`를 `encoded_images`로 완전히 교체하되,
                # `encoded_images`가 항상 4개의 키를 가지도록 (값이 없으면 빈 문자열이라도) 보장하는 것.
                # 아래는 새로운 이미지가 있는 것만 업데이트하거나, 없으면 이전 값을 유지하는 방식.
                # latest_frame["images"].update(encoded_images)
                
                # 모든 키를 포함하되, 없는 이미지는 빈 문자열로 채우도록 수정
                new_frame_images = {}
                for key in expected_cam_keys:
                    new_frame_images[key] = encoded_images.get(key, latest_frame["images"].get(key, "") if latest_frame and "images" in latest_frame else "")
                latest_frame["images"] = new_frame_images

            # 모든 종류의 이미지가 다 처리되었을 때만 FPS 카운트 (선택적)
            if all_images_processed_for_this_frame:
                 gui_image_processed_count += 1
        
        current_perf_time = time.perf_counter()
        elapsed_time_fps = current_perf_time - gui_fps_calc_start_time
        if elapsed_time_fps >= latency_log_interval: # FPS도 Latency 로깅 간격과 동일하게
            if elapsed_time_fps > 0: # 0으로 나누는 것 방지
                actual_fps_gui = gui_image_processed_count / elapsed_time_fps
                print(f"FastAPI - Image Processing FPS (complete sets): {actual_fps_gui:.2f}")
            gui_image_processed_count = 0
            gui_fps_calc_start_time = current_perf_time
        
        if current_perf_time - last_latency_log_time >= latency_log_interval:
            log_output = "Average Latencies (ms) [ROS Time Based]: "
            has_latency_data = False
            for cam_id, lat_deque in latencies.items():
                if lat_deque:
                    avg_lat = sum(lat_deque) / len(lat_deque)
                    log_output += f"{cam_id}: {avg_lat:.2f} | "
                    has_latency_data = True
            if has_latency_data:
                 print(log_output)
            else:
                 print("No latency data yet.")
            last_latency_log_time = current_perf_time

        time.sleep(0.04)  # 약 25fps 목표 (0.05는 20fps)

# ---------- FastAPI 앱 시작 시 스레드 실행 ----------
@app.on_event("startup")
async def startup_event():
    threading.Thread(target=ros2_node_spin, daemon=True).start()
    # ROS 노드가 초기화될 시간을 약간 기다린 후 이미지 처리 루프 시작 (선택적)
    # time.sleep(2) # 간단한 지연 또는 더 나은 동기화 메커니즘 사용
    threading.Thread(target=process_ros_images_loop, daemon=True).start()
    print("FastAPI application startup complete. ROS2 node and Image processing threads started.")

# ---------- FastAPI 앱 종료 시 ----------
@app.on_event("shutdown")
async def shutdown_event():
    print("FastAPI application shutting down...")
    if rclpy.ok():
        print("RCLPY is OK, requesting shutdown.")
        if ros2_node and ros2_node.context.ok(): # ros2_node가 생성되었고 컨텍스트가 유효하면
            # rclpy.shutdown() 보다 destroy_node()를 먼저 시도하거나, spin 루프에서 처리하도록 유도
            # 여기서는 spin 루프의 KeyboardInterrupt나 예외 처리에 맡기는 것이 더 안전할 수 있음
            # 직접 shutdown을 호출하면 spin 중인 노드와 충돌 가능성
            pass 
    print("FastAPI application shutdown complete.")


# 터미널에서 uvicorn으로 실행 예시:
# uvicorn websocket_server:app --reload --host 0.0.0.0 --port 8000