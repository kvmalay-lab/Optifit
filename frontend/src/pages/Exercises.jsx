import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Exercises() {
  const [userId, setUserId] = useState('guest');
  const [cameraIdx, setCameraIdx] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleStartWorkout = async () => {
    if (!selectedExercise) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId.trim() || 'guest',
          exercise: selectedExercise,
          camera_src: parseInt(cameraIdx) || 0
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      localStorage.setItem('activeSession', JSON.stringify({
        session_id: data.session_id,
        user_id: userId,
        exercise: selectedExercise
      }));

      navigate('/dashboard');
    } catch (e) {
      setErrorMsg(`Error: ${e.message} — Is the backend running?`);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <style>{`
        .exercises-header { text-align: center; margin-bottom: 56px; }
        .exercises-header h1 { font-family: var(--font-hero); font-size: 56px; letter-spacing: 3px; }
        .exercises-header p  { color: var(--muted); font-size: 15px; margin-top: 12px; }

        .exercises-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px,1fr));
          gap: 20px;
        }

        .ex-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 32px 28px;
          cursor: pointer;
          transition: all .25s;
          position: relative; overflow: hidden;
        }
        .ex-card::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(0,255,136,.04), transparent);
          opacity: 0; transition: opacity .3s;
        }
        .ex-card:hover::before { opacity: 1; }
        .ex-card:hover {
          border-color: var(--green);
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,.4), var(--glow-g);
        }
        .ex-card.active {
          border-color: var(--green);
          box-shadow: var(--glow-g);
        }

        .ex-icon { font-size: 48px; margin-bottom: 20px; }
        .ex-name { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
        .ex-desc { font-size: 13px; color: var(--muted); line-height: 1.7; margin-bottom: 20px; }

        .ex-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }

        .ex-select-btn {
          width: 100%;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: var(--radius);
          padding: 12px;
          font-family: var(--font-display);
          font-size: 14px; font-weight: 600;
          letter-spacing: 1px; text-transform: uppercase;
          transition: all .2s;
        }
        .ex-card:hover .ex-select-btn,
        .ex-card.active .ex-select-btn {
          background: var(--green); color: #000; border-color: var(--green);
        }

        .ex-card.disabled { opacity: .4; pointer-events: none; }
        .ex-card.disabled .ex-icon { filter: grayscale(1); }

        .setup-bar {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 24px 28px;
          margin-bottom: 40px;
          display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;
        }
        .setup-bar .field { flex: 1; min-width: 200px; }
        .setup-bar label { display: block; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
        .setup-bar .field-cam { width: 120px; flex: 0 0 120px; }

        .start-btn-area { text-align: center; margin-top: 48px; }
        .start-btn-area .selected-label {
          font-size: 13px; color: var(--muted); margin-bottom: 16px; letter-spacing: 1px;
        }
        .start-btn-area .selected-label span { color: var(--green); font-weight: 600; }
      `}</style>

      <div className="exercises-header">
        <h1>CHOOSE EXERCISE</h1>
        <p>Select an exercise and configure your session</p>
      </div>

      <div className="setup-bar">
        <div className="field">
          <label>Your Name / User ID</label>
          <input type="text" placeholder="e.g. john_doe" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
        <div className="field field-cam">
          <label>Camera Index</label>
          <input type="number" value={cameraIdx} min="0" max="5" onChange={(e) => setCameraIdx(e.target.value)} />
        </div>
      </div>

      <div className="exercises-grid">
        <div className={`ex-card ${selectedExercise === 'bicep_curl' ? 'active' : ''}`} onClick={() => setSelectedExercise('bicep_curl')}>
          <div className="ex-icon">💪</div>
          <div className="ex-name">Bicep Curl</div>
          <div className="ex-desc">Tracks elbow angle (shoulder→elbow→wrist). Counts reps automatically and flags lateral elbow drift.</div>
          <div className="ex-meta">
            <span className="badge badge-green">Supported</span>
            <span className="badge badge-cyan">Elbow Angle</span>
          </div>
          <button className="ex-select-btn">Select</button>
        </div>

        <div className="ex-card disabled">
          <div className="ex-icon">🏋️</div>
          <div className="ex-name">Lat Pulldown</div>
          <div className="ex-desc">Tracks elbow + shoulder angles. Monitors elbow width and back posture.</div>
          <div className="ex-meta">
            <span className="badge badge-yellow">Coming Soon</span>
          </div>
          <button className="ex-select-btn">Coming Soon</button>
        </div>

        <div className="ex-card disabled">
          <div className="ex-icon">🦵</div>
          <div className="ex-name">Squat</div>
          <div className="ex-desc">Tracks knee angle (hip→knee→ankle). Checks depth and knee alignment over toes.</div>
          <div className="ex-meta">
            <span className="badge badge-yellow">Coming Soon</span>
          </div>
          <button className="ex-select-btn">Coming Soon</button>
        </div>

        <div className="ex-card disabled">
          <div className="ex-icon">🤸</div>
          <div className="ex-name">Push-up</div>
          <div className="ex-desc">Tracks elbow angle and body alignment. Detects hip sagging and incomplete range of motion.</div>
          <div className="ex-meta">
            <span className="badge badge-yellow">Coming Soon</span>
          </div>
          <button className="ex-select-btn">Coming Soon</button>
        </div>

        <div className="ex-card disabled">
          <div className="ex-icon">🙌</div>
          <div className="ex-name">Shoulder Press</div>
          <div className="ex-desc">Tracks elbow and shoulder angles. Monitors vertical arm path and core stability.</div>
          <div className="ex-meta">
            <span className="badge badge-yellow">Coming Soon</span>
          </div>
          <button className="ex-select-btn">Coming Soon</button>
        </div>
      </div>

      <div className="start-btn-area">
        <p className="selected-label">
          {selectedExercise ? (
            <>Selected: <span>{selectedExercise.replace('_', ' ').toUpperCase()}</span></>
          ) : (
            'Select an exercise to continue'
          )}
        </p>
        <button
          className="btn btn-primary btn-lg"
          disabled={!selectedExercise || loading}
          onClick={handleStartWorkout}
        >
          {loading ? 'Starting…' : '▶  Start Session'}
        </button>
        {errorMsg && <p style={{ color: 'var(--red)', marginTop: '16px', fontSize: '13px' }}>{errorMsg}</p>}
      </div>
    </div>
  );
}
