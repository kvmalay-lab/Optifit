"""
FitFlex Arena — FastAPI backend
Run: uvicorn app:app --host 0.0.0.0 --port 8765 --reload
"""

import asyncio
import threading
import time
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from demo_fixed import FitFlexEngine

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------
SQLALCHEMY_DATABASE_URL = "sqlite:///./fitflex.db"
db_engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
Base = declarative_base()


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    exercise = Column(String)
    total_reps = Column(Integer, default=0)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)


Base.metadata.create_all(bind=db_engine)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class StartRequest(BaseModel):
    user_id: str
    exercise: str = "bicep_curl"
    camera_src: int = 0


class SessionSummary(BaseModel):
    session_id: int
    user_id: str
    exercise: str
    total_reps: int
    duration_seconds: float


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        dead: List[WebSocket] = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)


manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Global application state
# ---------------------------------------------------------------------------


class GlobalState:
    def __init__(self):
        self.engine: Optional[FitFlexEngine] = None
        self.is_tracking: bool = False
        self.current_session_id: Optional[int] = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.worker_thread: Optional[threading.Thread] = None


state = GlobalState()

# ---------------------------------------------------------------------------
# Background worker — broadcasts session data to all WebSocket clients
# ---------------------------------------------------------------------------


def _worker_loop():
    """Runs in a daemon thread; pushes live rep data to connected WS clients."""
    print("[Worker] Started")
    while state.is_tracking and state.engine:
        data = state.engine.get_session_data()
        if data and state.loop:
            future = asyncio.run_coroutine_threadsafe(
                manager.broadcast(data), state.loop
            )
            try:
                future.result(timeout=0.1)
            except Exception:
                pass
        time.sleep(1 / 20)  # 20 Hz broadcast
    print("[Worker] Stopped")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="FitFlex Arena API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/start")
async def start_session(request: StartRequest):
    if state.is_tracking:
        return {
            "status": "already_running",
            "session_id": state.current_session_id,
            "message": "Session already active.",
        }

    db: Session = SessionLocal()
    try:
        new_session = WorkoutSession(
            user_id=request.user_id, exercise=request.exercise
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        session_id = new_session.id
    finally:
        db.close()

    state.current_session_id = session_id
    state.engine = FitFlexEngine(request.user_id, request.exercise, request.camera_src)
    state.engine.start()
    state.is_tracking = True
    state.loop = asyncio.get_running_loop()
    state.worker_thread = threading.Thread(target=_worker_loop, daemon=True)
    state.worker_thread.start()

    return {"status": "started", "session_id": session_id}


@app.post("/stop")
async def stop_session():
    if not state.is_tracking or not state.engine:
        return {"status": "no_session", "message": "No active session to stop."}

    final_data = state.engine.get_session_data()
    final_reps = final_data.get("rep_count", 0)
    exercise = final_data.get("exercise", "unknown")

    state.engine.stop()
    state.engine = None
    state.is_tracking = False

    db: Session = SessionLocal()
    try:
        session = (
            db.query(WorkoutSession)
            .filter(WorkoutSession.id == state.current_session_id)
            .first()
        )
        summary = None
        if session:
            session.total_reps = final_reps
            session.end_time = datetime.utcnow()
            db.commit()
            duration = (
                (session.end_time - session.start_time).total_seconds()
                if session.end_time and session.start_time
                else 0.0
            )
            summary = SessionSummary(
                session_id=session.id,
                user_id=session.user_id,
                exercise=session.exercise,
                total_reps=session.total_reps,
                duration_seconds=round(duration, 1),
            )
    finally:
        db.close()

    state.current_session_id = None
    return summary.dict() if summary else {"status": "stopped"}


@app.get("/status")
async def get_status():
    data = state.engine.get_session_data() if state.engine else {}
    return {
        "is_tracking": state.is_tracking,
        "session_id": state.current_session_id,
        "live_data": data,
    }


@app.get("/sessions")
async def get_sessions():
    db: Session = SessionLocal()
    try:
        sessions = (
            db.query(WorkoutSession)
            .filter(WorkoutSession.end_time.isnot(None))
            .order_by(WorkoutSession.start_time.desc())
            .all()
        )
        return [
            {
                "session_id": s.id,
                "user_id": s.user_id,
                "exercise": s.exercise,
                "total_reps": s.total_reps,
                "start_time": s.start_time.isoformat() if s.start_time else None,
                "duration_seconds": round(
                    (s.end_time - s.start_time).total_seconds(), 1
                )
                if s.end_time and s.start_time
                else 0,
            }
            for s in sessions
        ]
    finally:
        db.close()


@app.get("/stream.mjpg")
async def stream_mjpg():
    if not state.is_tracking or not state.engine:
        raise HTTPException(status_code=404, detail="No active session")

    def generate():
        while state.is_tracking and state.engine:
            jpeg_bytes = state.engine.get_frame()
            if jpeg_bytes:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpeg_bytes)).encode() + b"\r\n\r\n"
                    + jpeg_bytes
                    + b"\r\n"
                )
            time.sleep(0.033)
        yield b"--frame\r\n"

    return StreamingResponse(
        generate(), media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive; data is pushed by worker thread
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8765, reload=True)
