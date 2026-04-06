# FitFlex Arena 🏋️

Real-time AI-powered fitness tracker using MediaPipe pose detection, FastAPI, and a plain HTML/JS frontend.

---

## Quick Start

### 1 — Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8765 --reload
```

Backend runs at **http://localhost:8765**

### 2 — Frontend

Open `frontend/index.html` directly in your browser, or serve it with:

```bash
cd frontend
python -m http.server 5173
```

Then visit **http://localhost:5173**

---

## How It Works

```
Browser                      FastAPI (8765)            Camera
  │                               │                      │
  ├─ POST /start ────────────────>│                      │
  │                               ├─ FitFlexEngine.start()─>│
  │                               │  (spawns video thread)   │
  │                               │                          │
  ├─ GET /stream.mjpg ───────────>│<─ JPEG frames ──────────┤
  │  (img tag, live video)        │                          │
  │                               │                          │
  ├─ WS /ws ──────────────────────│                          │
  │  (receives JSON @ 20 Hz)      │                          │
  │   { rep_count, angle, state } │                          │
  │                               │                          │
  ├─ POST /stop ──────────────────>│                         │
  │<─ { session_id, total_reps }   │                         │
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Health check |
| `POST` | `/start` | Start a session `{ user_id, exercise, camera_src }` |
| `POST` | `/stop`  | Stop session, returns summary |
| `GET`  | `/status` | Current tracking status |
| `GET`  | `/sessions` | All completed sessions |
| `GET`  | `/stream.mjpg` | MJPEG video stream |
| `WS`   | `/ws` | Real-time rep/form data |

---

## File Structure

```
fitflex-arena/
├── backend/
│   ├── app.py            # FastAPI app, routes, WebSocket broadcaster
│   ├── demo_fixed.py     # FitFlexEngine: MediaPipe + rep counting
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html        # Landing page
│   ├── exercises.html    # Exercise + user setup
│   ├── dashboard.html    # Live workout (MJPEG + WS)
│   ├── summary.html      # Post-session summary
│   ├── history.html      # All past sessions
│   ├── app.js            # Dashboard JS (WS, UI, lifecycle)
│   └── style.css         # Global dark-theme CSS
└── README.md
```

---

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and adjust:

```
HOST=0.0.0.0
PORT=8765
DATABASE_URL=sqlite:///./fitflex.db
ALLOWED_ORIGINS=*
```

---

## Supported Exercises

| Exercise | Status |
|----------|--------|
| Bicep Curl | ✅ Supported |
| Lat Pulldown | 🔜 Coming Soon |
| Squat | 🔜 Coming Soon |
| Push-up | 🔜 Coming Soon |
| Shoulder Press | 🔜 Coming Soon |

---

## Requirements

- Python 3.10+
- Webcam (default index 0)
- Modern browser (Chrome/Firefox recommended for MJPEG)
