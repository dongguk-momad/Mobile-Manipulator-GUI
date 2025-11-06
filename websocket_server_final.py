#!/usr/bin/env python3
# merged_server_node.py

import asyncio
import base64
import cv2
import json
import numpy as np
import rclpy
import simplejpeg
import signal
import threading
import time
from collections import deque
from multiprocessing import shared_memory
import websockets

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

# ROS2 messages
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from std_msgs.msg import Float32, Float32MultiArray, Header
from std_msgs.msg import String, Bool
from sensor_msgs.msg import JointState
from momad_msgs.msg import ControlValue, GuiValue, RobotarmValue, MobileValue, GripperValue # For the new bridge

# --- FastAPI App Initialization ---
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

# --- Global Data Stores and Locks ---
# For sensor data from websocket_server_shm.py part
sensor_data = {
    "robot_status": "E-Stop",
    # Robot value
    "battery": 32, "linear_speed": 0.0, "angular_speed": 0.0, 
    "gripper_opening": 0.0, "joint_angles": [0.0, 0.0, 90.0, 90.0, 90.0, 90.0], 
    "cartesian_position": [0.0] * 6, "force_sensor": [0.0] * 6, 

    # Controller value
    "master_joint_angles": [0.0] * 6, "angle": 0.0, "accel": 0, "brake": 0, "gear_status": "중립",
    
    # 이제 안씀
    "camera1_fps": 0.0, "camera2_fps": 0.0,
    "camera1_latency": 0.0, "camera2_latency": 0.0,
}


sensor_data_lock = threading.Lock()

# For the new ROS teleoperation bridge (from server_node.py part)
slave_bridge_data = {
    "stamp": 0.0,
    "RobotarmValue": {"position": [0.0, 0.0, 90.0, 90.0, 90.0, 90.0], "velocity": [0.0]*6, "force": [0.0]*6},
    "GripperValue": {"position": 0.0, "velocity": 0.0, "force": 0.0},
    "MobileValue": {"linear_accel": 0.0, "linear_brake": 0.0, "steer": 0.0, "gear": True},
}
slave_bridge_data_lock = threading.Lock() # Changed from asyncio.Lock to threading.Lock


dataset_settings = {
    "robotArm":   {"position": False, "velocity": False, "current": False, "gripper": False},
    "mobile":     {"linearVelocity": False, "angularVelocity": False, "odom": False},  
    "sensors":    {"camera1": False, "camera2": False, "lidar": False, "map": False},
    "HZ": 10,
    "savePath": ".",
    "saveTask": "pick_and_place red cube",
    "fileName": "data_1",
    "fileFormat": "json"  # New field for file format
}
dataset_settings_lock = threading.Lock()

getting_state = False
getting_state_lock = threading.Lock()

# --- SHM Configuration and Variables ---
IMAGE_WIDTH = 640
IMAGE_HEIGHT = 480
RGB_CHANNELS = 3
RGB_DTYPE = np.uint8
DEPTH_CHANNELS = 1
DEPTH_DTYPE = np.float32

# SHM_CONFIG = {
#     "mobile_rgb": {"name": "shm_mobile_rgb", "shape": (IMAGE_HEIGHT, IMAGE_WIDTH, RGB_CHANNELS), "dtype": RGB_DTYPE},
#     "mobile_depth": {"name": "shm_mobile_depth", "shape": (IMAGE_HEIGHT, IMAGE_WIDTH), "dtype": DEPTH_DTYPE},
#     "hand_rgb": {"name": "shm_hand_rgb", "shape": (IMAGE_HEIGHT, IMAGE_WIDTH, RGB_CHANNELS), "dtype": RGB_DTYPE},
#     "hand_depth": {"name": "shm_hand_depth", "shape": (IMAGE_HEIGHT, IMAGE_WIDTH), "dtype": DEPTH_DTYPE},
# }

## 태은 변경 ##
SHM_CONFIG = {
    "mobile_rgb":   {"name": "shm_mobile_rgb",  "shape": (IMAGE_HEIGHT, IMAGE_WIDTH, RGB_CHANNELS), "dtype": RGB_DTYPE},
    # "mobile_depth": {"name": "shm_mobile_depth","shape": (IMAGE_HEIGHT, IMAGE_WIDTH),               "dtype": DEPTH_DTYPE},
    "hand_rgb":     {"name": "shm_hand_rgb",    "shape": (IMAGE_HEIGHT, IMAGE_WIDTH, RGB_CHANNELS), "dtype": RGB_DTYPE},
    # "hand_depth":   {"name": "shm_hand_depth",  "shape": (IMAGE_HEIGHT, IMAGE_WIDTH),               "dtype": DEPTH_DTYPE},
    "map":          {"name": "shm_map",         "shape": (IMAGE_HEIGHT, IMAGE_WIDTH, RGB_CHANNELS), "dtype": RGB_DTYPE},
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

latest_frame = {"images": {key: "" for key in SHM_CONFIG.keys()}}
latest_frame_lock = threading.Lock()
connected_clients_image_ws = set() # For /ws/image


# --- ROS 2 Global Variables ---
ros2_node: Node = None # Will hold the instance of MergedROSNode

# --- Logging Helper Functions ---
def _get_logger():
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

def log_debug(message):
    logger = _get_logger()
    if logger: logger.debug(message) # Ensure logger level is set to DEBUG if these are needed
    else: print(f"DEBUG: {message}")

# --- Shared Memory Utility Functions ---
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
                log_error(f"SHM segment '{shm_name}' not found. Producer (e.g., Isaac Sim) must create it first.")
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
            # Attempt to clean up any partially successful attachments to avoid lingering file handles
            # This is a simplified cleanup for this specific init failure case
            for key_to_clean in list(shm_segments.keys()):
                if shm_segments[key_to_clean] is not None:
                    try:
                        shm_segments[key_to_clean].close()
                    except Exception as e_clean:
                        log_error(f"Error closing partially opened SHM {SHM_CONFIG[key_to_clean]['name']} during init failure: {e_clean}")
                shm_segments[key_to_clean] = None
                shm_np_arrays[key_to_clean] = None
            return False


def _cleanup_shared_memory():
    log_info("Closing shared memory segments (consumer side)...")
    with shm_lock:
        for key in list(shm_segments.keys()): # Iterate over a copy of keys for safe removal
            shm = shm_segments.pop(key, None)
            shm_np_arrays.pop(key, None)
            if shm is None: continue
            try:
                shm.close()
                log_debug(f"Closed SHM: {SHM_CONFIG[key]['name']}")
            except Exception as e:
                log_error(f"Error closing SHM {SHM_CONFIG[key]['name']}: {e}")
    log_info("Shared memory segments closed by consumer.")

# --- ROS 2 Node Definition ---
class MergedROSNode(Node):
    def __init__(self):
        super().__init__('merged_web_gui_server_node')
        log_info("MergedROSNode initializing...")

        # Publishers
        self.master_info_bridge_pub = self.create_publisher(ControlValue, '/master_info_to_robot', 10) # From server_node.py
        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )
        
        self.dataset_settings_pub = self.create_publisher(String, '/dataset_settings', qos)
        self.recording_state_pub = self.create_publisher(String, '/recording_state', 10)
        
        # Subscriptions
        self.create_subscription(Header, "/image_signal", self.image_signal_callback, 10) # SHM에 이미지 저장 시 콜백
        self.create_subscription(GuiValue, "/robot_to_gui", self.robot_to_gui_callback, 10)
        self.create_subscription(Float32MultiArray, "/cartesian_position", self.cartesian_callback, 10) # 이후 웹소켓으로 받기

        # Subscription from server_node.py for the teleop bridge
        self.create_subscription(ControlValue, '/slave_info', self.slave_info_bridge_callback, 10)
        
        log_info("MergedROSNode initialized with publishers and subscribers.")

    def image_signal_callback(self, msg: Header):
        global last_received_signal_stamp_ns, image_signal_event
        # log_debug(f"Signal: stamp={msg.stamp.sec}.{msg.stamp.nanosec:09d}, frame_id='{msg.frame_id}'")
        if msg.frame_id == "new_images_ready":
            with signal_stamp_lock:
                last_received_signal_stamp_ns = (msg.stamp.sec * 1_000_000_000) + msg.stamp.nanosec
            image_signal_event.set()
            
    def robot_to_gui_callback(self, msg: GuiValue):
        """Callback for GuiValue messages from Isaac Sim to GUI."""
        global sensor_data
        with sensor_data_lock:
            sensor_data["battery"] = msg.battery
            sensor_data["linear_speed"] = msg.linear_accel
            sensor_data["angular_speed"] = msg.steer
            sensor_data["gripper_opening"] = msg.gripper_opening
            sensor_data["joint_angles"] = list(msg.joint_angles)
            sensor_data["cartesian_position"] = list(msg.cartesian_position)
            sensor_data["force_sensor"] = list(msg.force_torque)            
        # log_debug(f"Received GuiValue: {msg}")

    # Callback from server_node.py for the teleop bridge
    def slave_info_bridge_callback(self, msg: ControlValue):
        """'/slave_info' 콜백: 들어온 데이터를 slave_bridge_data에 저장"""
        global slave_bridge_data
        with slave_bridge_data_lock:
            slave_bridge_data = {
                "stamp": msg.stamp,
                "RobotarmValue": {
                    "position": list(msg.robotarm_state.position),
                    "velocity": list(msg.robotarm_state.velocity),
                    "force":    list(msg.robotarm_state.force),
                },
                "GripperValue": {
                    "position": msg.gripper_state.position,
                    "velocity": msg.gripper_state.velocity,
                    "force":    msg.gripper_state.force,
                },
                "MobileValue": {
                    "linear_accel": msg.mobile_state.linear_accel,
                    "linear_brake": msg.mobile_state.linear_brake,
                    "steer": msg.mobile_state.steer,
                    "gear": msg.mobile_state.gear
                }
            }
        log_debug(f"Updated slave_bridge_data from /slave_info: stamp {msg.stamp}")
        global sensor_data
        
        with sensor_data_lock:
            sensor_data["robot_status"] = "AUTO"  # 예시로 상태 업데이트
            # sensor_data["battery"] = msg.battery
            sensor_data["linear_speed"] = msg.mobile_state.linear_accel
            sensor_data["angular_speed"] = msg.mobile_state.steer
            sensor_data["gripper_opening"] = np.clip((100.0 - msg.gripper_state.position)*1.5, 0.0, 150.0)  # 예시 변환
            sensor_data["joint_angles"] = list(msg.robotarm_state.position)
            # sensor_data["cartesian_position"] = list(msg.cartesian_position)
            sensor_data["force_sensor"] = list(msg.robotarm_state.force)            
        # log_debug(f"Received GuiValue: {msg}")

    def cartesian_callback(self, msg: Float32MultiArray):
        """Cartesian position 콜백 (필요시 사용)"""
        global sensor_data
        with sensor_data_lock:
            sensor_data["cartesian_position"] = list(msg.data)
        # log_debug(f"Received Cartesian Position: {msg.data}")


    def dataset_settings_publish(self, settings_dict: dict):
        """
        GUI로부터 받은 dataset_settings(딕셔너리)를 JSON으로 직렬화하여
        ROS2 토픽('/dataset_settings', std_msgs/String)으로 퍼블리시한다.
        """
        try:
            payload = json.dumps(settings_dict, ensure_ascii=False)
        except Exception as e:
            self.get_logger().error(f"Failed to serialize dataset_settings to JSON: {e}")
            return

        msg = String()
        msg.data = payload
        try:
            self.dataset_settings_pub.publish(msg)
            self.get_logger().info("Published /dataset_settings")
        except Exception as e:
            self.get_logger().error(f"Failed to publish /dataset_settings: {e}")

    def recording_state_publish(self, state):
        msg = String()
        msg.data = state
        try:
            self.recording_state_pub.publish(msg)
            self.get_logger().info("Published /recording_state")
        except Exception as e:
            self.get_logger().error(f"Failed to publish /recording_state: {e}")
    
# --- ROS 2 Spin Function (to be run in a thread) ---
def ros2_thread_spin():
    global ros2_node
    if not rclpy.ok(): # Ensure rclpy is initialized if not already
        try:
            rclpy.init()
            log_info("RCLPY initialized in ros2_thread_spin.")
        except Exception as e:
            print(f"Failed to initialize RCLPY in ros2_thread_spin: {e}")
            return

    ros2_node = MergedROSNode()
    log_info("ROS 2 Merged Node started. Spinning...")
    try:
        rclpy.spin(ros2_node)
    except KeyboardInterrupt:
        log_info('KeyboardInterrupt received in ROS 2 spin, shutting down ROS 2 node.')
    except Exception as e:
        log_error(f'Exception in ROS 2 spin: {str(e)}')
    finally:
        if ros2_node and ros2_node.context.ok():
            log_info("Destroying ROS 2 node...")
            ros2_node.destroy_node()
        # rclpy.try_shutdown() will be called in FastAPI shutdown event
        log_info("ROS 2 node spin ended.")

# --- GUI to Server data --- # 
@app.websocket("/ws/setting")
async def websocket_save_interval(websocket: WebSocket):
    global dataset_settings, getting_state
    await websocket.accept()
    log_info(f"Client {websocket.client} connected to /ws/setting")
    try:
        while True:
            msg = await websocket.receive_text()

            # JSON only (legacy 제거)
            try:
                payload = json.loads(msg)
            except json.JSONDecodeError:
                await websocket.send_text("ERROR: Only JSON payloads are supported.")
                continue
            msg_type = payload.get("type")

            # === 데이터셋 설정 수신 ===
            if msg_type == "dataset_setting":
                with dataset_settings_lock:
                    dataset_settings.update({
                        "robotArm":    payload.get("robotArm", dataset_settings["robotArm"]),
                        "mobile":      payload.get("mobile", dataset_settings["mobile"]),
                        "sensors":     payload.get("sensors", dataset_settings["sensors"]),
                        "HZ": payload.get("Hertz", dataset_settings["HZ"]),
                        "savePath":    payload.get("savePath", dataset_settings["savePath"]),
                        "saveTask":    payload.get("saveTask", dataset_settings["saveTask"]),
                        "fileName":    payload.get("fileName", dataset_settings["fileName"]),
                        "fileFormat":  payload.get("fileFormat", dataset_settings["fileFormat"]),                        
                    })
                    local_copy = dict(dataset_settings)  # ROS publish용 스냅샷

                log_info(f"✅ Dataset settings updated: {dataset_settings}")

                # ROS2 퍼블리시
                if ros2_node:
                    try:
                        ros2_node.dataset_settings_publish(local_copy)
                    except Exception as e:
                        log_error(f"Failed to publish dataset settings to ROS: {e}")
                else:
                    log_warn("ROS node not ready; skipped publishing /dataset_settings")

                await websocket.send_text("ACK: dataset settings updated")
                continue

            # === recording_state ===
            elif msg_type in ("start_recording", "save_recording", "discard_recording"):
                try:
                    log_info(f"✅ Recording command received: {msg_type}")

                    if ros2_node:
                        try:
                            ros2_node.recording_state_publish(msg_type)
                        except Exception as e:
                            log_error(f"Failed to publish dataset command to ROS: {e}")
                    else:
                        log_warn("ROS node not ready; skipped publishing /dataset_settings")

                    await websocket.send_text(f"ACK: {msg_type}")

                except Exception as e:
                    await websocket.send_text(f"ERROR: {e}")
                continue
            # === 잘못된 type ===
            else:
                await websocket.send_text("ERROR: unknown payload type")
                continue

    except Exception as e:
        log_warn(f"/ws/setting closed: {e}")
    finally:
        log_info(f"Client {websocket.client} disconnected from /ws/setting")


# --- Image Processing Loop (to be run in a thread) ---
async def process_shm_images_loop_thread_func():
    global latest_frame, latest_frame_lock, shm_np_arrays, image_signal_event, last_received_signal_stamp_ns
    global gui_image_processed_count, gui_fps_calc_start_time
    global latencies, last_latency_log_time, latency_log_interval
    global ros2_node # For get_clock

    log_info("process_shm_images_loop: Thread started.")
    
    shm_fully_initialized = False
    while not shm_fully_initialized and (not ros2_node or not rclpy.ok()): # Wait for rclpy.ok() and ros2_node
        log_debug("process_shm_images_loop: Waiting for RCLPY and ROS 2 node to be initialized...")
        time.sleep(1.0)
        if ros2_node and rclpy.ok(): break # Break if ready

    if not ros2_node or not rclpy.ok():
        log_error("process_shm_images_loop: RCLPY not OK or ROS2 node not available. Exiting thread.")
        return

    while not shm_fully_initialized and rclpy.ok():
        if hasattr(ros2_node, 'get_clock') and ros2_node.get_clock().now().nanoseconds > 0 : # Check if clock is active
            log_info("process_shm_images_loop: ROS 2 node ready. Attempting SHM init...")
            if _init_shared_memory():
                shm_fully_initialized = True
                log_info("process_shm_images_loop: All SHM segments ready.")
            else:
                log_warn("process_shm_images_loop: Not all SHM segments ready. Retrying in 1s...")
                time.sleep(1.0)
        else:
            log_debug("process_shm_images_loop: Waiting for ROS 2 node clock to be active...")
            time.sleep(1.0)
        if not rclpy.ok():
            log_warn("process_shm_images_loop: RCLPY not OK during SHM init wait. Exiting thread.")
            return
            
    if not shm_fully_initialized:
        log_error("process_shm_images_loop: Could not initialize SHM. Exiting thread.")
        return

    node_clock = ros2_node.get_clock()
    expected_cam_keys = list(SHM_CONFIG.keys()) # Use keys from SHM_CONFIG
    jpeg_quality = 15

    while rclpy.ok():
        if not image_signal_event.wait(timeout=1.0):
            if not rclpy.ok(): break # Exit if rclpy is not ok during wait
            continue 
        image_signal_event.clear()

        with signal_stamp_lock:
            original_capture_stamp_ns = last_received_signal_stamp_ns
        if original_capture_stamp_ns is None:
            continue

        current_ros_time_msg = node_clock.now().to_msg()
        current_ros_time_total_ns = (current_ros_time_msg.sec * 1_000_000_000) + current_ros_time_msg.nanosec
        
        encoded_images_this_cycle = {}
        all_images_valid_for_this_frame = True

        for cam_id_key in expected_cam_keys:
            if cam_id_key not in shm_np_arrays or shm_np_arrays[cam_id_key] is None:
                # log_warn(f"SHM view for {cam_id_key} not available this cycle.")
                all_images_valid_for_this_frame = False
                encoded_images_this_cycle[cam_id_key] = "" # Ensure key exists even if empty
                continue

            try:
                with shm_lock: # Ensure exclusive access while reading from SHM buffer view
                    # Check again if it's still valid after acquiring lock, might have been cleaned up
                    if cam_id_key not in shm_np_arrays or shm_np_arrays[cam_id_key] is None:
                        all_images_valid_for_this_frame = False
                        encoded_images_this_cycle[cam_id_key] = ""
                        continue
                    img_cv_shm = shm_np_arrays[cam_id_key]
                    img_cv = img_cv_shm.copy() # 중요: SHM에서 로컬로 복사

                img_to_encode = None
                is_depth_image = "depth" in cam_id_key
                jpeg_bytes = None
                
                # jpeg로 인코딩
                if is_depth_image:
                    continue
                    min_d, max_d = (0.1, 1.0) if "hand_depth" == cam_id_key else (0.1, 2.0)
                    img_cv_float = img_cv.astype(np.float32)
                    img_cv_float = np.nan_to_num(img_cv_float, nan=max_d, posinf=max_d, neginf=min_d)
                    
                    clipped_depth = np.clip(img_cv_float, min_d, max_d)
                    if (max_d - min_d) == 0: normalized_depth = np.zeros_like(clipped_depth)
                    else: normalized_depth = (clipped_depth - min_d) / (max_d - min_d)
                    
                    depth_8bit_gray = (normalized_depth * 255).astype(np.uint8)
                    img_to_encode = depth_8bit_gray
                    
                    ret, buffer = cv2.imencode(".jpg", img_to_encode, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
                    if not ret: raise ValueError(f"cv2.imencode failed for GRACYSCALE depth image {cam_id_key}")
                    jpeg_bytes = buffer.tobytes()
                else: # RGB 이미지
                    img_to_encode = img_cv
                    jpeg_bytes = simplejpeg.encode_jpeg(
                        img_to_encode, quality=jpeg_quality, colorspace='RGB', colorsubsampling='420'
                    )
                
                # Base64 문자열로 변함
                encoded_images_this_cycle[cam_id_key] = f"data:image/jpeg;base64,{base64.b64encode(jpeg_bytes).decode('utf-8')}"
                latency_ns = current_ros_time_total_ns - original_capture_stamp_ns 
                latencies[cam_id_key].append(latency_ns / 1_000_000) # ms

            except Exception as e:
                log_error(f"Error processing/encoding image {cam_id_key} from SHM: {e}")
                encoded_images_this_cycle[cam_id_key] = "" 
                all_images_valid_for_this_frame = False
        
        with latest_frame_lock:
            for key_cam in expected_cam_keys: # Ensure all expected keys are updated
                 latest_frame["images"][key_cam] = encoded_images_this_cycle.get(key_cam, latest_frame["images"].get(key_cam, ""))
            
        if all_images_valid_for_this_frame:
             gui_image_processed_count += 1
        
        # current_perf_time = time.perf_counter()
        # elapsed_time_fps = current_perf_time - gui_fps_calc_start_time
        # if elapsed_time_fps >= latency_log_interval:
        #     if elapsed_time_fps > 0:
        #         actual_fps_gui = gui_image_processed_count / elapsed_time_fps
        #         log_info(f"Image Processing FPS (SHM): {actual_fps_gui:.2f} over {elapsed_time_fps:.2f}s")
        #         with sensor_data_lock:
        #             if "mobile_rgb" in latest_frame["images"]:
        #                 sensor_data["camera1_fps"] = gui_image_processed_count / elapsed_time_fps if elapsed_time_fps > 0 else sensor_data["camera1_fps"]
        #                 sensor_data["camera2_fps"] = gui_image_processed_count / elapsed_time_fps if elapsed_time_fps > 0 else sensor_data["camera2_fps"]

        #     gui_image_processed_count = 0 
        #     gui_fps_calc_start_time = current_perf_time 

        # if current_perf_time - last_latency_log_time >= latency_log_interval:
        #     log_output_parts = []
        #     for cam_id, lat_deque in latencies.items():
        #         if lat_deque: avg_lat = sum(lat_deque) / len(lat_deque); log_output_parts.append(f"{cam_id}: {avg_lat:.2f}")
        #     if log_output_parts:
        #         log_info(f"Average Image Latencies (ms) [ROS Time Based, SHM]: {' | '.join(log_output_parts)}")
        #         with sensor_data_lock:
        #             if "hand_rgb" in latest_frame["images"]:
        #                 sensor_data["camera1_latency"] = float(np.mean(latencies["mobile_rgb"])) if latencies["mobile_rgb"] else sensor_data["camera1_latency"]
        #                 sensor_data["camera2_latency"] = float(np.mean(latencies["hand_rgb"])) if latencies["hand_rgb"] else sensor_data["camera2_latency"]

        #     else: log_debug("No latency data for SHM processing in this interval.")
        #     last_latency_log_time = current_perf_time
        
            

        await asyncio.sleep(0.001) # Small sleep to yield control, adjust as needed. Original server_node.py used 0.01, process_shm was 0.04.
                                # This loop is driven by image_signal_event, so sleep can be minimal.
    
    log_info("Exiting process_shm_images_loop as rclpy is not ok.")


# --- FastAPI WebSocket Endpoints --- websocket 경로(/ws/data, /ws/image 등)에 데이터 들어오면 자동 실행
@app.websocket("/ws/data")
async def websocket_data(websocket: WebSocket):
    await websocket.accept()
    log_info(f"Client {websocket.client} connected to /ws/data")
    try:
        while True:
            with sensor_data_lock:
                data_to_send = sensor_data.copy()
            await websocket.send_json(data_to_send)
            await asyncio.sleep(0.05)
    except Exception as e:
        log_warn(f"/ws/data WebSocket connection closed for {websocket.client}: {e}")
    finally:
        log_info(f"Client {websocket.client} disconnected from /ws/data")

@app.websocket("/ws/image")
async def websocket_image(websocket: WebSocket):
    global latest_frame, latest_frame_lock, connected_clients_image_ws
    await websocket.accept()
    connected_clients_image_ws.add(websocket)
    log_info(f"Client {websocket.client} connected to /ws/image. Total clients: {len(connected_clients_image_ws)}")
    try:
        while True:
            frame_payload_to_send = None # 전송할 최종 페이로드
            with latest_frame_lock:
                if latest_frame and latest_frame.get("images") and any(latest_frame["images"].values()):
                    # latest_frame을 직접 수정하지 않기 위해 복사본 사용
                    current_frame_data = latest_frame.copy() 
                    # 여기에 서버 전송 타임스탬프 추가 (밀리초 단위 UNIX epoch)
                    current_frame_data["server_send_timestamp_ms"] = int(time.time() * 1000)
                    frame_payload_to_send = current_frame_data
            
            if frame_payload_to_send:
                await websocket.send_json(frame_payload_to_send)
            else:
                # 이미지가 없거나 비어있으면 아무것도 보내지 않거나, 빈 메시지를 정의할 수 있음
                pass 

            await asyncio.sleep(0.04) # 약 33Hz, 이미지 처리 속도에 따라 조절
    except Exception as e: 
        log_warn(f"/ws/image WebSocket connection closed for {websocket.client}: {e}")
    finally: 
        if websocket in connected_clients_image_ws: # Check before removing
            connected_clients_image_ws.remove(websocket)
        log_info(f"Client {websocket.client} disconnected from /ws/image. Total clients: {len(connected_clients_image_ws)}")


# New WebSocket endpoint for the teleoperation bridge (from server_node.py)
async def ros_teleop_bridge_send_loop(websocket: WebSocket):
    """Periodically sends slave_bridge_data to the WebSocket client."""
    log_info(f"ROS Teleop Bridge Send Loop started for {websocket.client}")
    while True: # Loop will be broken by gather if websocket closes or rclpy not ok
        if not rclpy.ok(): 
            log_warn("RCLPY not OK in ros_teleop_bridge_send_loop. Breaking.")
            break
        payload_dict = {}
        with slave_bridge_data_lock:
            payload_dict = slave_bridge_data.copy() # Make a shallow copy
        
        try:
            await websocket.send_json(payload_dict)
            # log_debug(f"Sent to /ws/ros_teleop_bridge: {payload_dict['stamp']}")
        except Exception as e:
            log_warn(f"Error in ros_teleop_bridge_send_loop for {websocket.client}: {e}. Breaking.")
            break
        await asyncio.sleep(0.01) # 100Hz, as in original server_node.py
    log_info(f"ROS Teleop Bridge Send Loop stopped for {websocket.client}")

### Slave에게 Master 명령 전달 ###(마)
async def ros_teleop_bridge_recv_loop(websocket: WebSocket):
    """Receives master commands from WebSocket and publishes to /master_info."""
    log_info(f"ROS Teleop Bridge Recv Loop started for {websocket.client}")
    while True: # Loop will be broken by gather if websocket closes or rclpy not ok
        if not rclpy.ok():
            log_warn("RCLPY not OK in ros_teleop_bridge_recv_loop. Breaking.")
            break
        if not ros2_node or not ros2_node.master_info_bridge_pub:
            log_warn("ROS node or master_info_bridge_pub not available yet. Retrying...")
            await asyncio.sleep(0.1)
            continue
            
        try:
            text = await websocket.receive_text()
            data = json.loads(text)
            # log_debug(f"Received from /ws/ros_teleop_bridge: {data.get('stamp')}")

            msg = ControlValue()
            msg.stamp = data.get("stamp", 0.0) # Provide default for stamp

            rv_data = data.get("RobotarmValue", {})
            msg.robotarm_state = RobotarmValue(
                position=np.array(rv_data.get("position", [0.0, 0.0, 90.0, 90.0, 90.0, 90.0]), dtype=np.float64).tolist(),
                velocity=np.array(rv_data.get("velocity", [0.0]*6), dtype=np.float64).tolist(),
                force=np.array(rv_data.get("force", [0.0]*6), dtype=np.float64).tolist()
            )

            gv_data = data.get("GripperValue", {})
            msg.gripper_state = GripperValue(
                position=float(gv_data.get("position", 0.0)),
                velocity=float(gv_data.get("velocity", 0.0)),
                force=float(gv_data.get("force", 0.0))
            )

            mv_data = data.get("MobileValue", {})
            msg.mobile_state = MobileValue(
                linear_accel=float(mv_data.get("linear_accel", 0.0)),
                linear_brake=float(mv_data.get("linear_brake", 0.0)),
                steer=float(mv_data.get("steer", 0.0)),
                gear=bool(mv_data.get("gear", True))
            )
            
            ros2_node.master_info_bridge_pub.publish(msg)

            with sensor_data_lock:
                sensor_data["master_joint_angles"] = list(msg.robotarm_state.position)
                sensor_data["accel"] = msg.mobile_state.linear_accel*100
                sensor_data["brake"] = msg.mobile_state.linear_brake*100
                sensor_data["angle"] = msg.mobile_state.steer*90 # 임시로 angle에 각속도 저장(태은)
                
                sensor_data["gear_status"] = "전진" if msg.mobile_state.linear_accel > 0 else "후진" if msg.mobile_state.linear_accel < 0 else "중립"
            await asyncio.sleep(0) # Yield control, effectively processing messages as fast as they come

        except websockets.exceptions.ConnectionClosedOK:
            log_info(f"Client {websocket.client} closed /ws/ros_teleop_bridge connection gracefully.")
            break
        except Exception as e:
            log_warn(f"Error in ros_teleop_bridge_recv_loop for {websocket.client}: {e}. Breaking.")
            # Consider if other exceptions should also break or be handled differently
            break
    log_info(f"ROS Teleop Bridge Recv Loop stopped for {websocket.client}")


@app.websocket("/ws/ros_teleop_bridge")
async def websocket_ros_teleop_bridge(websocket: WebSocket):
    await websocket.accept()
    log_info(f"Client {websocket.client} connected to /ws/ros_teleop_bridge")
    try:
        # Run send and receive loops concurrently
        await asyncio.gather(
            ros_teleop_bridge_send_loop(websocket),
            ros_teleop_bridge_recv_loop(websocket),
        )
    except Exception as e:
        # This might catch errors from gather itself or if one of the tasks raises an unhandled exception
        # that isn't a normal closure.
        log_error(f"Exception in /ws/ros_teleop_bridge handler for {websocket.client}: {e}")
    finally:
        log_info(f"Client {websocket.client} disconnected from /ws/ros_teleop_bridge")


# --- FastAPI Startup/Shutdown Events ---
@app.on_event("startup")
async def startup_event():
    log_info("FastAPI application startup initiated.")
    # Initialize RCLPY globally once before starting any ROS-dependent threads
    if not rclpy.ok():
        try:
            rclpy.init()
            log_info("RCLPY initialized successfully at startup.")
        except Exception as e:
            print(f"FATAL: Failed to initialize RCLPY at startup: {e}")
            # Depending on desired behavior, you might want to raise an exception here
            # or prevent the app from fully starting. For now, it will log and continue.
            log_error("ROS functionalities will likely fail.")
            # return # Optionally prevent threads from starting if rclpy init fails

    # Start ROS 2 node spinning in a separate thread
    ros_thread = threading.Thread(target=ros2_thread_spin, daemon=True)
    ros_thread.start()
    log_info("ROS 2 spin thread started.")

    # Start SHM image processing loop in a separate thread
    # This thread now runs an async function, so we need to run it in an event loop
    async def run_process_shm_images():
        await process_shm_images_loop_thread_func()

    def start_shm_image_processing_thread():
        asyncio.run(run_process_shm_images())
        
    # Since process_shm_images_loop_thread_func is now async, run it with asyncio.create_task if FastAPI loop is already running
    # Or, if it needs its own loop because it's long-running and might block, use threading with asyncio.run
    # For simplicity and to match the original threaded approach for long tasks:
    shm_thread = threading.Thread(target=lambda: asyncio.run(process_shm_images_loop_thread_func()), daemon=True)
    shm_thread.start()
    log_info("SHM image processing thread started.")

@app.on_event("shutdown")
async def shutdown_event():
    log_info("FastAPI application shutting down...")
    
    # Signal image processing loop to stop (if it's waiting on this event)
    image_signal_event.set() 

    # Cleanup SHM
    _cleanup_shared_memory()
    log_info("Shared memory cleaned up.")

    # Shutdown ROS 2
    if rclpy.ok():
        log_info("RCLPY is OK. Attempting to shutdown ROS 2...")
        if ros2_node and ros2_node.context.ok(): # Check if node was created and context is valid
            # Node destruction is handled in ros2_thread_spin's finally block
            pass
        rclpy.try_shutdown() # Safely try to shutdown rclpy
        log_info("RCLPY shutdown attempted.")
    else:
        log_info("RCLPY was not OK at shutdown.")
        
    log_info("FastAPI application shutdown complete.")

# --- Main Execution Block (for running with Uvicorn) ---
if __name__ == "__main__":
    import uvicorn
    # Note: rclpy.init() is called in startup_event
    # It's generally better to initialize rclpy once, as early as possible,
    # but before any rclpy operations. Startup event is a good place.
    
    log_info("Starting Uvicorn server for merged application.")
    # Host 0.0.0.0 to make it accessible from network
    # Port 8000 as in server_node.py example (FastAPI default is also 8000)
    uvicorn.run(app, host="0.0.0.0", port=8000)

# uvicorn websocket_server_final:app --reload --host 0.0.0.0 --port 8000