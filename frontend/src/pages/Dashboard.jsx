import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState({});
  const [timer, setTimer] = useState('00:00');
  const [wsStatus, setWsStatus] = useState('Connecting…');
  const [wsOnline, setWsOnline] = useState(false);
  const [videoOffline, setVideoOffline] = useState(false);

  const [data, setData] = useState({
    rep_count: 0,
    current_angle: null,
    confidence: null,
    state: '—',
    set_count: 1
  });
  const [repBump, setRepBump] = useState(false);
  const [invalidFlash, setInvalidFlash] = useState(false);

  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const sessionRaw = localStorage.getItem('activeSession');
    if (sessionRaw) {
      setSession(JSON.parse(sessionRaw));
    }

    // Start Timer
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      setTimer(`${m}:${s}`);
    }, 1000);

    // WebSocket
    connectWebSocket();

    return () => {
      clearInterval(timerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    let wsRetries = 0;
    const MAX_RETRY = 10;

    const connect = () => {
      wsRef.current = new WebSocket(import.meta.env.VITE_WS_URL);

      wsRef.current.onopen = () => {
        wsRetries = 0;
        setWsOnline(true);
        setWsStatus('LIVE TRACKING');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data);

          setData(prev => {
            if (newData.rep_count > prev.rep_count) {
              setRepBump(true);
              setTimeout(() => setRepBump(false), 200);
            }
            if (newData.state === 'INVALID_FORM') {
              setInvalidFlash(true);
              setTimeout(() => setInvalidFlash(false), 400);
            }
            return newData;
          });
        } catch { /* ignore */ }
      };

      wsRef.current.onclose = () => {
        setWsOnline(false);
        setWsStatus('RECONNECTING…');
        if (wsRetries < MAX_RETRY && !ending) {
          wsRetries++;
          setTimeout(connect, 1500);
        } else {
          setWsStatus('DISCONNECTED');
        }
      };

      wsRef.current.onerror = () => wsRef.current?.close();
    };

    connect();
  };

  const stopWorkout = async () => {
    setEnding(true);
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    clearInterval(timerRef.current);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/stop`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const summary = await res.json();
      localStorage.setItem('lastSummary', JSON.stringify(summary));
      localStorage.removeItem('activeSession');
      navigate('/summary');
    } catch (err) {
      alert(`Error stopping session: ${err.message}`);
      setEnding(false);
      connectWebSocket();
    }
  };

  const goBack = () => {
    if (window.confirm('End this session and go back?')) stopWorkout();
  };

  // Derived state values
  const angle = data.current_angle ?? 0;
  const stateDisplay = data.state ? data.state.replace('_', ' ') : '—';
  const confDisplay = data.confidence != null ? `${Math.round(data.confidence * 100)}%` : '—';
  const isInvalid = data.state === 'INVALID_FORM';

  // Feedback logic
  let feedbackText = 'Tracking…';
  let feedbackCls = '';
  if (isInvalid) {
    feedbackText = '⚠️  Keep your elbow locked — reduce lateral drift!';
    feedbackCls = 'error';
  } else if (data.state === 'UP') {
    feedbackText = '⬇  Lower the weight all the way down.';
    feedbackCls = 'warning';
  } else if (data.state === 'DOWN') {
    feedbackText = '⬆  Curl up! Squeeze at the top.';
    feedbackCls = 'good';
  } else if (data.state === 'WAITING') {
    feedbackText = '👀  Step into frame to begin tracking.';
    feedbackCls = '';
  } else if (data.rep_count > 0) {
    feedbackText = `✅  Great rep! Keep it up — ${data.rep_count} done so far.`;
    feedbackCls = 'good';
  }

  return (
    <div className="dashboard">
      <style>{`
        body { overflow: hidden; }
        .dashboard {
          display: grid;
          grid-template-rows: 60px 1fr 80px;
          height: 100vh;
          width: 100vw;
          background: var(--bg);
        }
        .top-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px;
          background: rgba(8,12,16,.95);
          border-bottom: 1px solid var(--border);
          z-index: 10;
        }
        .top-bar-left { display: flex; align-items: center; gap: 20px; }
        .logo { font-family: var(--font-hero); font-size: 22px; color: var(--green); letter-spacing: 2px; }
        .logo span { color: var(--cyan); }
        .exercise-badge {
          background: rgba(0,255,136,.1); border: 1px solid rgba(0,255,136,.25);
          color: var(--green); font-size: 12px; font-weight: 600; letter-spacing: 2px;
          padding: 4px 12px; border-radius: 20px; text-transform: uppercase;
        }
        .status-pill {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--muted); font-family: var(--font-mono); letter-spacing: 1px;
        }
        .timer {
          font-family: var(--font-mono); font-size: 20px; font-weight: 500;
          color: var(--cyan); letter-spacing: 3px;
        }
        .main-content {
          display: grid;
          grid-template-columns: 1fr 300px;
          overflow: hidden;
        }
        .video-panel {
          position: relative; background: #000; overflow: hidden;
        }
        #cameraFeed {
          width: 100%; height: 100%; object-fit: cover;
          display: block;
        }
        .video-offline {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; color: var(--muted);
        }
        .video-offline .icon { font-size: 64px; }
        .video-offline p { font-size: 14px; letter-spacing: 1px; }
        .video-overlay {
          position: absolute; top: 20px; right: 20px;
          display: flex; flex-direction: column; gap: 10px;
          pointer-events: none;
        }
        .overlay-chip {
          background: rgba(8,12,16,.85);
          border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 14px;
          font-family: var(--font-mono); font-size: 13px;
          backdrop-filter: blur(8px);
          min-width: 120px;
        }
        .overlay-chip .oc-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); }
        .overlay-chip .oc-val   { font-size: 18px; font-weight: 500; margin-top: 2px; }
        .sidebar {
          background: var(--bg-2);
          border-left: 1px solid var(--border);
          display: flex; flex-direction: column;
          overflow-y: auto;
        }
        .sidebar-section {
          padding: 20px; border-bottom: 1px solid var(--border);
        }
        .sidebar-section:last-child { border-bottom: none; }
        .sidebar-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
        .rep-counter {
          text-align: center; padding: 28px 20px;
          border-bottom: 1px solid var(--border);
        }
        .rep-number {
          font-family: var(--font-mono); font-size: 96px; font-weight: 500;
          line-height: 1; color: var(--green);
          transition: transform .15s;
        }
        .rep-number.bump { transform: scale(1.1); color: #fff; }
        .rep-label { font-size: 11px; letter-spacing: 3px; color: var(--muted); text-transform: uppercase; margin-top: 8px; }
        .mini-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); }
        .mini-stat {
          background: var(--bg-2);
          padding: 16px 14px; text-align: center;
        }
        .mini-stat .ms-val { font-family: var(--font-mono); font-size: 22px; font-weight: 500; }
        .mini-stat .ms-lbl { font-size: 10px; letter-spacing: 2px; color: var(--muted); text-transform: uppercase; margin-top: 4px; }
        .angle-gauge-wrap { padding: 20px; border-bottom: 1px solid var(--border); }
        .angle-bar-bg {
          height: 8px; background: var(--bg); border-radius: 4px; overflow: hidden; margin: 12px 0;
        }
        .angle-bar-fill {
          height: 100%; background: linear-gradient(90deg, var(--cyan), var(--green));
          border-radius: 4px; transition: width .3s;
        }
        .angle-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); font-family: var(--font-mono); }
        .ai-feedback {
          padding: 20px;
          flex: 1;
        }
        .feedback-box {
          background: var(--bg); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px;
          font-size: 14px; font-weight: 600; letter-spacing: .5px;
          min-height: 56px; display: flex; align-items: center; justify-content: center;
          text-align: center; line-height: 1.5;
          transition: all .3s;
        }
        .bottom-bar {
          display: flex; align-items: center; justify-content: center; gap: 16px;
          background: rgba(8,12,16,.95);
          border-top: 1px solid var(--border);
          padding: 0 24px;
        }
        .video-panel.invalid-flash {
          animation: border-flash .4s;
        }
        @keyframes border-flash {
          0%,100% { box-shadow: none; }
          50% { box-shadow: inset 0 0 0 3px var(--red); }
        }
        @media (max-width: 900px) {
          .main-content { grid-template-columns: 1fr; }
          .sidebar { display: none; }
          body { overflow: auto; }
          .dashboard { height: auto; }
        }
      `}</style>

      {/* TOP BAR */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="logo">FIT<span>FLEX</span></div>
          <div className="exercise-badge">
            {session.exercise ? session.exercise.replace(/_/g, ' ') : 'Exercise'}
          </div>
          <div className="status-pill">
            <span className={`dot ${wsOnline ? 'dot-online' : 'dot-offline'}`}></span>
            <span>{wsStatus}</span>
          </div>
        </div>
        <div className="timer">{timer}</div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">

        {/* Video */}
        <div className={`video-panel ${invalidFlash ? 'invalid-flash' : ''}`}>
          <img
            id="cameraFeed"
            src={`${import.meta.env.VITE_API_URL}/stream.mjpg?t=${Date.now()}`}
            alt="Live Feed"
            style={{ display: videoOffline ? 'none' : 'block' }}
            onError={() => {
              setVideoOffline(true);
              setTimeout(() => setVideoOffline(false), 3000); // retry
            }}
            onLoad={() => setVideoOffline(false)}
          />

          {videoOffline && (
            <div className="video-offline">
              <div className="icon">📷</div>
              <p>Waiting for video stream…</p>
            </div>
          )}

          {wsOnline && (
            <div className="video-overlay">
              <div className="overlay-chip">
                <div className="oc-label">Angle</div>
                <div className="oc-val">{angle ? `${angle}°` : '—'}</div>
              </div>
              <div className="overlay-chip">
                <div className="oc-label">Form</div>
                <div className="oc-val" style={{ color: isInvalid ? 'var(--red)' : 'var(--green)' }}>
                  {isInvalid ? 'INVALID' : 'VALID'}
                </div>
              </div>
              <div className="overlay-chip">
                <div className="oc-label">Confidence</div>
                <div className="oc-val">{confDisplay}</div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="rep-counter">
            <div className={`rep-number ${repBump ? 'bump' : ''}`}>
              {data.rep_count ?? '—'}
            </div>
            <div className="rep-label">Reps Completed</div>
          </div>

          <div className="mini-stats">
            <div className="mini-stat">
              <div className="ms-val">{data.set_count ?? '—'}</div>
              <div className="ms-lbl">Set</div>
            </div>
            <div className="mini-stat">
              <div className="ms-val">{angle ? `${angle}°` : '—'}</div>
              <div className="ms-lbl">Angle</div>
            </div>
            <div className="mini-stat">
              <div className="ms-val">{confDisplay}</div>
              <div className="ms-lbl">Conf %</div>
            </div>
            <div className="mini-stat">
              <div className="ms-val" style={{ color: isInvalid ? 'var(--red)' : '' }}>
                {stateDisplay}
              </div>
              <div className="ms-lbl">Phase</div>
            </div>
          </div>

          <div className="angle-gauge-wrap">
            <div className="sidebar-label">Elbow Angle</div>
            <div className="angle-bar-bg">
              <div className="angle-bar-fill" style={{ width: `${Math.min(100, (angle / 180) * 100)}%` }}></div>
            </div>
            <div className="angle-labels">
              <span>0°</span>
              <span>{angle ? `${angle}°` : '—'}</span>
              <span>180°</span>
            </div>
          </div>

          <div className="ai-feedback">
            <div className="sidebar-label">AI Coach</div>
            <div className={`feedback-box ${feedbackCls}`}>
              {feedbackText}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar">
        <button className="btn btn-ghost" onClick={goBack} disabled={ending}>← Back</button>
        <button className="btn btn-danger" onClick={stopWorkout} disabled={ending}>
          {ending ? 'Stopping…' : '⏹ End Session'}
        </button>
      </div>
    </div>
  );
}
