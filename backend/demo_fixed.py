import cv2
import mediapipe as mp
import numpy as np
import time
import threading
from dataclasses import dataclass, asdict
from datetime import datetime
from threading import Lock
from one_euro_filter import OneEuroFilter

# --- CONFIGURATION ---
TARGET_WIDTH = 640
TARGET_HEIGHT = 480
FPS_TARGET = 30

# Form Validation Thresholds
MAX_LATERAL_DRIFT_RATIO = 0.25

ANGLE_THRESHOLD_UP = 35
ANGLE_THRESHOLD_DOWN = 160


@dataclass
class RepData:
    user_id: str
    exercise: str
    rep_count: int
    set_count: int
    timestamp: str
    confidence: float
    current_angle: float
    state: str


class BicepState:
    def __init__(self):
        self.count = 0
        self.internal_state = "DOWN"
        self.last_angle = 0.0

    def update(self, angle: float, form_valid: bool):
        # Always update internal state to count reps correctly even if form flickers
        new_state = self.internal_state
        if angle < ANGLE_THRESHOLD_UP:
            new_state = "UP"
        elif angle > ANGLE_THRESHOLD_DOWN:
            new_state = "DOWN"

        if self.internal_state == "UP" and new_state == "DOWN":
            self.count += 1

        self.internal_state = new_state
        self.last_angle = angle

        # Return invalid form purely for UI display if form is bad
        display_state = "INVALID_FORM" if not form_valid else self.internal_state
        return self.count, display_state


class VideoStream:
    def __init__(self, src: int = 0):
        self.cap = cv2.VideoCapture(src)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, TARGET_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, TARGET_HEIGHT)
        self.cap.set(cv2.CAP_PROP_FPS, FPS_TARGET)
        self.frame = None
        self.lock = threading.Lock()
        self.stopped = False

    def start(self) -> "VideoStream":
        self.update_thread = threading.Thread(target=self.update, daemon=True)
        self.update_thread.start()
        return self

    def update(self):
        while not self.stopped:
            ret, frame = self.cap.read()
            if ret:
                with self.lock:
                    self.frame = frame.copy()
            time.sleep(1 / FPS_TARGET)

    def read(self):
        with self.lock:
            return self.frame.copy() if self.frame is not None else None

    def stop(self):
        self.stopped = True
        self.cap.release()


class FitFlexEngine:
    def __init__(self, user_id: str = "guest", exercise: str = "bicep_curl", camera_src: int = 0):
        self.user_id = user_id
        self.exercise = exercise
        self.camera_src = camera_src
        self.video_stream = None
        self.pose = None
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.left_arm = BicepState()
        self.right_arm = BicepState()
        self.set_count = 1
        self.l_filter = OneEuroFilter(t0=time.time(), x0=180.0, min_cutoff=1.0, beta=0.01)
        self.r_filter = OneEuroFilter(t0=time.time(), x0=180.0, min_cutoff=1.0, beta=0.01)
        self.is_running = False

        # Thread-safe state
        self.current_frame = None
        self.frame_lock = Lock()
        self._latest_data: dict = {
            "user_id": user_id,
            "exercise": exercise,
            "rep_count": 0,
            "set_count": 1,
            "timestamp": datetime.now().isoformat(),
            "confidence": 0.0,
            "current_angle": 0.0,
            "state": "WAITING",
        }
        self._data_lock = Lock()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self):
        self.video_stream = VideoStream(self.camera_src).start()
        self.pose = self.mp_pose.Pose(
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.is_running = True
        self.processing_thread = threading.Thread(
            target=self._process_video_loop, daemon=True
        )
        self.processing_thread.start()

    def stop(self):
        self.is_running = False
        if self.video_stream:
            self.video_stream.stop()
        if self.pose:
            self.pose.close()

    # ------------------------------------------------------------------
    # Public getters (thread-safe)
    # ------------------------------------------------------------------

    def get_frame(self):
        """Return the latest annotated JPEG bytes for MJPEG streaming."""
        with self.frame_lock:
            if self.current_frame is None:
                return None
            _, jpeg = cv2.imencode(
                ".jpg", self.current_frame, [cv2.IMWRITE_JPEG_QUALITY, 75]
            )
            return jpeg.tobytes()

    def get_session_data(self) -> dict:
        """Return the latest rep/form data snapshot (for WebSocket broadcast)."""
        with self._data_lock:
            return dict(self._latest_data)

    # ------------------------------------------------------------------
    # Internal processing loop
    # ------------------------------------------------------------------

    def _process_video_loop(self):
        while self.is_running:
            frame = self.video_stream.read()
            if frame is None:
                time.sleep(0.033)
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.pose.process(rgb)

            annotated = frame.copy()

            if results.pose_landmarks:
                self.mp_drawing.draw_landmarks(
                    annotated,
                    results.pose_landmarks,
                    self.mp_pose.POSE_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(0, 255, 136), thickness=2, circle_radius=3),
                    self.mp_drawing.DrawingSpec(color=(0, 212, 255), thickness=2),
                )

                lm = results.pose_landmarks.landmark

                # Body width for dynamic threshold
                sh_l = lm[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
                sh_r = lm[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
                body_width = abs(sh_l.x - sh_r.x)
                dyn_threshold = (
                    body_width * MAX_LATERAL_DRIFT_RATIO if body_width > 0 else 0.2
                )

                current_time = time.time()

                # Left arm
                l_sh = [lm[self.mp_pose.PoseLandmark.LEFT_SHOULDER].x, lm[self.mp_pose.PoseLandmark.LEFT_SHOULDER].y]
                l_el = [lm[self.mp_pose.PoseLandmark.LEFT_ELBOW].x, lm[self.mp_pose.PoseLandmark.LEFT_ELBOW].y]
                l_wr = [lm[self.mp_pose.PoseLandmark.LEFT_WRIST].x, lm[self.mp_pose.PoseLandmark.LEFT_WRIST].y]
                l_angle_raw = self._calculate_angle(l_sh, l_el, l_wr)
                l_angle = self.l_filter(current_time, l_angle_raw)
                l_drift = abs(l_wr[0] - l_el[0])
                l_form = l_drift < dyn_threshold
                l_reps, l_state = self.left_arm.update(l_angle, l_form)

                # Right arm
                r_sh = [lm[self.mp_pose.PoseLandmark.RIGHT_SHOULDER].x, lm[self.mp_pose.PoseLandmark.RIGHT_SHOULDER].y]
                r_el = [lm[self.mp_pose.PoseLandmark.RIGHT_ELBOW].x, lm[self.mp_pose.PoseLandmark.RIGHT_ELBOW].y]
                r_wr = [lm[self.mp_pose.PoseLandmark.RIGHT_WRIST].x, lm[self.mp_pose.PoseLandmark.RIGHT_WRIST].y]
                r_angle_raw = self._calculate_angle(r_sh, r_el, r_wr)
                r_angle = self.r_filter(current_time, r_angle_raw)
                r_drift = abs(r_wr[0] - r_el[0])
                r_form = r_drift < dyn_threshold
                r_reps, r_state = self.right_arm.update(r_angle, r_form)

                # Aggregate
                rep_count = max(l_reps, r_reps)
                current_angle = round((l_angle + r_angle) / 2, 1)
                form_ok = l_form and r_form
                state = (
                    "INVALID_FORM"
                    if not form_ok
                    else (l_state if l_reps >= r_reps else r_state)
                )
                confidence = round(
                    (
                        lm[self.mp_pose.PoseLandmark.LEFT_ELBOW].visibility
                        + lm[self.mp_pose.PoseLandmark.RIGHT_ELBOW].visibility
                    )
                    / 2,
                    3,
                )

                # Update latest data (thread-safe)
                with self._data_lock:
                    self._latest_data = {
                        "user_id": self.user_id,
                        "exercise": self.exercise,
                        "rep_count": rep_count,
                        "set_count": self.set_count,
                        "timestamp": datetime.now().isoformat(),
                        "confidence": confidence,
                        "current_angle": current_angle,
                        "state": state,
                    }

                # Overlay text
                color = (0, 255, 136) if form_ok else (0, 0, 255)
                cv2.putText(
                    annotated,
                    f"Reps: {rep_count}  Angle: {current_angle}  {state}",
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.0,
                    color,
                    2,
                )

            # Store annotated frame
            with self.frame_lock:
                self.current_frame = annotated

            time.sleep(0.033)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _calculate_angle(a, b, c) -> float:
        a, b, c = np.array(a), np.array(b), np.array(c)
        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(
            a[1] - b[1], a[0] - b[0]
        )
        angle = np.abs(radians * 180.0 / np.pi)
        return float(360 - angle if angle > 180.0 else angle)

    # Backward compat shim — not used by app.py but kept for local testing
    def process_frame(self):
        jpeg = self.get_frame()
        data = self.get_session_data()
        return None, [data] if data else [], jpeg


# ---------------------------------------------------------------------------
# Local debug runner
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    engine = FitFlexEngine("test_user")
    engine.start()
    print("Press Q to quit.")
    while engine.is_running:
        jpeg = engine.get_frame()
        if jpeg:
            arr = np.frombuffer(jpeg, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            cv2.imshow("FitFlex Debug", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
    engine.stop()
    cv2.destroyAllWindows()
