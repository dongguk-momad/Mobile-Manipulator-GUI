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
from collections import deque
from multiprocessing import shared_memory
import signal
import simplejpeg

# ROS2 관련
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from std_msgs.msg import Float32, Float32MultiArray, Header
from sensor_msgs.msg import JointState

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    app.mount("/app", StaticFiles(directory="dist", html=True), name="static")
except RuntimeError:
    print("Warning: 'dist' directory not found for StaticFiles. UI will not be served.")

@app.get("/")
async def redirect_to_app():
    if any(route.path == "/app" for route in app.routes if hasattr(route, "path")):
        return RedirectResponse(url="/app")
    return {"message": "FastAPI server is running. UI not found at /app."}

sensor_data = {
    "battery": 0.0, "speed": 0.0, "steering_angle": 0.0, "gripper_opening": 0.0,
    "joint_angles": [0.0] * 6, "master_joint_values": [0.0] * 6,
    "force_sensor": [0.0] * 6, "angle": 0.0, "accel": 0, "brake": 0, "gear_status": "중립"
}
sensor_data_lock = threading.Lock()

IMAGE_WIDTH = 640
IMAGE_HEIGHT = 480
RGB_CHANNELS = 3
RGB_DTYPE = np.uint8
DEPTH_CHANNELS = 1 
DEPTH_DTYPE = np.float32

# SHM_CONFIG 키는 Isaac Sim과 FastAPI 서버 간에, 그리고 이 파일 내 expected_cam_keys와 일치해야 합니다.
SHM_CONFIG = {
    "mobile_rgb": {"name": "shm_mobile_rgb", "shape": (IMAGE_HEIGHT, IMAGE_WIDTH, RGB_CHANNELS), "dtype": RGB_DTYPE},
    "mobile_depth": {"name": "shm_mobile_depth", "shape": (IMAGE_HEIGHT, IMAGE_WIDTH), "dtype": DEPTH_DTYPE},
    "hand_rgb": {"name": "shm_hand_rgb", "shape": (IMAGE_HEIGHT, IMAGE_WIDTH, RGB_CHANNELS), "dtype": RGB_DTYPE},
    "hand_depth": {"name": "shm_hand_depth", "shape": (IMAGE_HEIGHT, IMAGE_WIDTH), "dtype": DEPTH_DTYPE},
}
for key in SHM_CONFIG:
    config_item = SHM_CONFIG[key]
    config_item["size"] = int(np.prod(config_item["shape"]) * np.dtype(config_item["dtype"]).itemsize)

shm_segments = {}
shm_np_arrays = {}
shm_lock = threading.Lock()

image_signal_event = threading.Event()
last_received_signal_stamp_ns = None
signal_stamp_lock = threading.Lock()

gui_image_processed_count = 0
gui_fps_calc_start_time = time.perf_counter()
latencies = {key: deque(maxlen=100) for key in SHM_CONFIG.keys()}
latency_log_interval = 5.0
last_latency_log_time = time.perf_counter()

ros2_node: Node = None
array_publisher = None

# TypeError 방지를 위해 latest_frame을 적절한 구조로 전역에서 초기화
latest_frame = {"images": {key: "" for key in SHM_CONFIG.keys()}}
latest_frame_lock = threading.Lock()
connected_clients = set()


def _get_logger():
    """ Helper function to safely get the ROS2 node logger or fallback to print """
    if ros2_node and hasattr(ros2_node, 'get_logger'):
        return ros2_node.get_logger()
    return None

def log_info(message):
    logger = _get_logger()
    if logger: logger.info(message)
    else: print(f"INFO: {message}")

def log_warn(message):
    logger = _get_logger()
    if logger: logger.warn(message)
    else: print(f"WARN: {message}")

def log_error(message):
    logger = _get_logger()
    if logger: logger.error(message)
    else: print(f"ERROR: {message}")

def log_debug(message): # 디버그 로그는 필요시 주석 해제하여 사용
    logger = _get_logger()
    if logger: logger.debug(message)
    else: print(f"DEBUG: {message}")
    pass


def _init_shared_memory():
    global shm_segments, shm_np_arrays
    log_info("Attempting to attach to shared memory segments...")
    successful_attachments = 0
    with shm_lock:
        for key, config_item in SHM_CONFIG.items():
            if key in shm_segments and shm_segments[key] is not None and \
               key in shm_np_arrays and shm_np_arrays[key] is not None:
                log_debug(f"SHM segment '{key}' already attached and view created. Skipping.")
                successful_attachments +=1
                continue

            shm_name = config_item["name"]
            try:
                shm = shared_memory.SharedMemory(name=shm_name, create=False, size=config_item["size"])
                shm_segments[key] = shm
                shm_np_arrays[key] = np.ndarray(config_item["shape"], dtype=config_item["dtype"], buffer=shm.buf)
                log_info(f"Successfully attached to SHM: {shm_name} (View shape: {shm_np_arrays[key].shape}, dtype: {shm_np_arrays[key].dtype})")
                successful_attachments += 1
            except FileNotFoundError:
                log_error(f"SHM segment '{shm_name}' not found. Isaac Sim (producer) must create it first.")
                shm_segments[key] = None
                shm_np_arrays[key] = None
            except Exception as e:
                log_error(f"Failed to attach or create view for SHM '{shm_name}': {e}")
                shm_segments[key] = None
                shm_np_arrays[key] = None
        
        if successful_attachments == len(SHM_CONFIG):
            log_info("All shared memory segments successfully attached and views created.")
            return True
        else:
            log_error(f"Only {successful_attachments}/{len(SHM_CONFIG)} SHM segments were attached/views created.")
            return False

def _cleanup_shared_memory():
    log_info("Closing shared memory segments (consumer side)...")
    with shm_lock:
        for key, shm in shm_segments.items():
            if shm is None: continue
            try:
                shm.close()
                log_debug(f"Closed SHM: {SHM_CONFIG[key]['name']}")
            except Exception as e:
                log_error(f"Error closing SHM {SHM_CONFIG[key]['name']}: {e}")
        shm_segments.clear()
        shm_np_arrays.clear()
    log_info("Shared memory segments closed by consumer.")

def image_signal_callback(msg: Header):
    global last_received_signal_stamp_ns, signal_stamp_lock, image_signal_event
    log_debug(f"Signal: stamp={msg.stamp.sec}.{msg.stamp.nanosec:09d}, frame_id='{msg.frame_id}'")
    if msg.frame_id == "new_images_ready":
        with signal_stamp_lock:
            last_received_signal_stamp_ns = (msg.stamp.sec * 1_000_000_000) + msg.stamp.nanosec
        image_signal_event.set()

def battery_callback(msg: Float32):
    with sensor_data_lock: sensor_data["battery"] = msg.data
def joint_callback(msg: JointState):
    with sensor_data_lock: sensor_data["joint_angles"] = list(msg.position)
def force_callback(msg: Float32MultiArray):
    with sensor_data_lock: sensor_data["force_sensor"] = list(msg.data)

def ros2_node_spin():
    global array_publisher, ros2_node
    if not rclpy.ok(): rclpy.init()
    ros2_node = Node("web_gui_server_shm_node_final")

    ros2_node.create_subscription(Float32, "/battery", battery_callback, 10)
    ros2_node.create_subscription(JointState, "/joint_states", joint_callback, 10)
    ros2_node.create_subscription(Float32MultiArray, "/force_sensor", force_callback, 10)
    ros2_node.create_subscription(Header, "/isaac_image_signal", image_signal_callback, 10)
    
    log_info("ROS 2 GUI Server SHM node started. Subscribing to /isaac_image_signal.")
    array_publisher = ros2_node.create_publisher(Float32MultiArray, "/master_joint_values", 10)

    try:
        rclpy.spin(ros2_node)
    except KeyboardInterrupt:
        log_info('KeyboardInterrupt received, shutting down ROS 2 node.')
    except Exception as e:
        log_error(f'Exception in ROS 2 spin: {str(e)}')
    finally:
        if ros2_node and ros2_node.context.ok(): ros2_node.destroy_node()
        if rclpy.ok(): rclpy.try_shutdown() # try_shutdown은 이미 shutdown 중이면 에러 안냄
        log_info("ROS 2 node (consumer) spin ended.")


@app.websocket("/ws/control")
async def websocket_control(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            msg_control = await websocket.receive_json()
            with sensor_data_lock:
                sensor_data["master_joint_values"] = list(msg_control["master_joint_values"])
            if array_publisher:
                array_publisher.publish(Float32MultiArray(data=sensor_data["master_joint_values"]))
            await asyncio.sleep(0.05)
    except Exception as e: print(f"\u274c 컨트롤 WebSocket 연결 종료: {e}")

@app.websocket("/ws/data")
async def websocket_data(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            with sensor_data_lock: data_to_send = sensor_data.copy()
            await websocket.send_json(data_to_send)
            await asyncio.sleep(0.05)
    except Exception as e: print(f"\u274c 데이터 WebSocket 연결 종료: {e}")

@app.websocket("/ws/image")
async def websocket_image(websocket: WebSocket):
    global latest_frame, latest_frame_lock
    await websocket.accept()
    connected_clients.add(websocket)
    log_info(f"Client {websocket.client} connected to /ws/image. Total clients: {len(connected_clients)}")
    try:
        while True:
            frame_to_send = None
            images_available = False
            with latest_frame_lock:
                if latest_frame and latest_frame.get("images"): # "images" 키 존재 확인
                    # 실제로 이미지가 있는지 (빈 문자열이 아닌 값이 하나라도 있는지) 확인
                    if any(latest_frame["images"].values()):
                        frame_to_send = latest_frame 
                        images_available = True
            
            if frame_to_send:
                # print(f"Sending frame to {websocket.client}: {list(frame_to_send['images'].keys())}")
                # print(frame_to_send)
                log_debug(f"Sending frame to {websocket.client}: {list(frame_to_send['images'].keys())}")
                await websocket.send_json(frame_to_send)
            else:
                # print(f"No new frame to send to {websocket.client} or frame empty.")
                log_debug(f"No new frame to send to {websocket.client} or frame empty.")

            await asyncio.sleep(0.01) 
    except Exception as e: 
        print(f"\u274c 이미지 WebSocket 연결 종료: {e}")
        log_error(f"Image WebSocket connection closed for {websocket.client} with error: {e}")
    finally: 
        connected_clients.remove(websocket)
        log_info(f"Client {websocket.client} disconnected from /ws/image. Total clients: {len(connected_clients)}")

def process_shm_images_loop():
    global latest_frame, latest_frame_lock, shm_np_arrays, image_signal_event, last_received_signal_stamp_ns
    global gui_image_processed_count, gui_fps_calc_start_time
    global latencies, last_latency_log_time, latency_log_interval
    global ros2_node

    log_info("process_shm_images_loop: Thread started.")
    
    shm_fully_initialized = False
    while not shm_fully_initialized and rclpy.ok(): # 초기화 대기 루프
        if ros2_node and hasattr(ros2_node, 'get_clock'):
            log_info("process_shm_images_loop: ROS 2 node ready. Attempting SHM init...")
            if _init_shared_memory(): shm_fully_initialized = True; log_info("process_shm_images_loop: All SHM segments ready.")
            else: log_warn("process_shm_images_loop: Not all SHM segments ready. Retrying in 1s..."); time.sleep(1.0)
        else: log_debug("process_shm_images_loop: Waiting for ROS 2 node to be initialized..."); time.sleep(1.0)
        if not rclpy.ok(): log_warn("process_shm_images_loop: RCLPY not OK during init wait. Exiting thread."); return
            
    if not shm_fully_initialized: log_error("process_shm_images_loop: Could not initialize SHM. Exiting thread."); return

    node_clock = ros2_node.get_clock()
    expected_cam_keys = ["mobile_rgb", "mobile_depth", "hand_rgb", "hand_depth"]
    jpeg_quality = 60 # JPEG 품질 (0-100, 높을수록 고품질, 느림)

    while rclpy.ok():
        if not image_signal_event.wait(timeout=1.0): continue 
        image_signal_event.clear()

        with signal_stamp_lock: original_capture_stamp_ns = last_received_signal_stamp_ns
        if original_capture_stamp_ns is None: continue

        current_ros_time_msg = node_clock.now().to_msg()
        current_ros_time_total_ns = (current_ros_time_msg.sec * 1_000_000_000) + current_ros_time_msg.nanosec
        
        encoded_images_this_cycle = {}
        all_images_valid_for_this_frame = True

        for cam_id_key in expected_cam_keys:
            if cam_id_key not in shm_np_arrays or shm_np_arrays[cam_id_key] is None:
                log_warn(f"SHM view for {cam_id_key} not available this cycle.")
                all_images_valid_for_this_frame = False
                encoded_images_this_cycle[cam_id_key] = ""
                continue

            try:
                img_cv_shm = shm_np_arrays[cam_id_key]
                img_cv = img_cv_shm.copy() # 중요: SHM에서 로컬로 복사

                img_to_encode = None
                is_depth_image = "depth" in cam_id_key
                jpeg_bytes = None

                if is_depth_image:
                    # Depth 이미지 처리 간소화: 8비트 흑백 이미지로 정규화
                    min_d, max_d = (0.1, 1.0) if "hand_depth" == cam_id_key else (0.1, 2.0)
                    img_cv_float = img_cv.astype(np.float32)
                    img_cv_float = np.nan_to_num(img_cv_float, nan=max_d, posinf=max_d, neginf=min_d)
                    
                    clipped_depth = np.clip(img_cv_float, min_d, max_d)
                    if (max_d - min_d) == 0: normalized_depth = np.zeros_like(clipped_depth)
                    else: normalized_depth = (clipped_depth - min_d) / (max_d - min_d)
                    
                    depth_8bit_gray = (normalized_depth * 255).astype(np.uint8)
                    img_to_encode = depth_8bit_gray # 2D 흑백 이미지
                    
                    # Depth 이미지는 OpenCV의 imencode 사용 (흑백 JPEG)
                    ret, buffer = cv2.imencode(".jpg", img_to_encode, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
                    if not ret:
                        raise ValueError(f"cv2.imencode failed for GRACYSCALE depth image {cam_id_key}")
                    jpeg_bytes = buffer.tobytes()

                else: # RGB 이미지
                    img_to_encode = img_cv # 이미 RGB (H,W,3)
                    
                    # RGB 이미지만 simplejpeg 사용
                    jpeg_bytes = simplejpeg.encode_jpeg(
                        img_to_encode, 
                        quality=jpeg_quality, 
                        colorspace='RGB', # 입력이 RGB임을 명시
                        colorsubsampling='420' 
                    )
                
                encoded_images_this_cycle[cam_id_key] = f"data:image/jpeg;base64,{base64.b64encode(jpeg_bytes).decode('utf-8')}"

                # Latency 계산 (이전과 동일)
                # ...
                latency_ns = current_ros_time_total_ns - original_capture_stamp_ns 
                latencies[cam_id_key].append(latency_ns / 1_000_000)

            except Exception as e:
                log_error(f"Error processing/encoding image {cam_id_key} from SHM with simplejpeg: {e}")
                # import traceback; traceback.print_exc() # 상세 디버깅 필요시
                encoded_images_this_cycle[cam_id_key] = "" 
                all_images_valid_for_this_frame = False
        
        with latest_frame_lock:
            for key_cam in expected_cam_keys:
                 latest_frame["images"][key_cam] = encoded_images_this_cycle.get(key_cam, latest_frame["images"].get(key_cam, ""))
            
        if all_images_valid_for_this_frame:
             gui_image_processed_count += 1
        
        # FPS 및 Latency 로깅 (이전과 동일한 로직)
        current_perf_time = time.perf_counter()
        elapsed_time_fps = current_perf_time - gui_fps_calc_start_time
        if elapsed_time_fps >= latency_log_interval:
            if elapsed_time_fps > 0:
                actual_fps_gui = gui_image_processed_count / elapsed_time_fps
                log_info(f"Image Processing FPS (SHM, simplejpeg): {actual_fps_gui:.2f} over {elapsed_time_fps:.2f}s")
            gui_image_processed_count = 0 
            gui_fps_calc_start_time = current_perf_time 
        
        if current_perf_time - last_latency_log_time >= latency_log_interval:
            log_output_parts = []
            for cam_id, lat_deque in latencies.items():
                if lat_deque: avg_lat = sum(lat_deque) / len(lat_deque); log_output_parts.append(f"{cam_id}: {avg_lat:.2f}")
            if log_output_parts: log_info(f"Average Latencies (ms) [ROS Time Based, SHM]: {' | '.join(log_output_parts)} |")
            else: log_info("No latency data for SHM processing in this interval.")
            last_latency_log_time = current_perf_time

        time.sleep(0.04) # 약 25 FPS 목표
    
    log_info("Exiting process_shm_images_loop as rclpy is not ok.")

@app.on_event("startup")
async def startup_event():
    # _init_shared_memory() # 여기서 호출하지 않고, process_shm_images_loop 스레드 시작 시 내부에서 호출
    threading.Thread(target=ros2_node_spin, daemon=True).start()
    threading.Thread(target=process_shm_images_loop, daemon=True).start()
    log_info("FastAPI SHM application startup initiated. Background threads starting.")

@app.on_event("shutdown")
async def shutdown_event():
    log_info("FastAPI SHM application shutting down...")
    image_signal_event.set() 
    if rclpy.ok() and ros2_node is not None: # 안전하게 종료 요청
        # rclpy.shutdown() # ros2_node_spin의 finally에서 처리
        pass
    _cleanup_shared_memory() 
    log_info("FastAPI SHM application shutdown complete.")