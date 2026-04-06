import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [stats, setStats] = useState({ workouts: '—', reps: '—', status: '—' });

  useEffect(() => {
    async function loadStats() {
      try {
        const [statusRes, sessionsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/health`),
          fetch(`${import.meta.env.VITE_API_URL}/sessions`)
        ]);
        const sessions = await sessionsRes.json();
        const totalReps = sessions.reduce((acc, s) => acc + (s.total_reps || 0), 0);

        setStats({
          workouts: sessions.length,
          reps: totalReps,
          status: 'ONLINE'
        });
      } catch {
        setStats(prev => ({ ...prev, status: 'OFFLINE' }));
      }
    }

    loadStats();
  }, []);

  return (
    <>
      <style>{`
        /* ── Landing-specific ── */
        .hero {
          min-height: calc(100vh - 60px);
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          text-align: center;
          position: relative; overflow: hidden;
          padding: 0 24px;
        }
        .hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(0,212,255,.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,.04) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: grid-shift 20s linear infinite;
        }
        @keyframes grid-shift {
          0%   { transform: translate(0,0); }
          100% { transform: translate(60px,60px); }
        }
        .orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none; opacity: .25;
        }
        .orb-1 { width: 400px; height: 400px; background: var(--green); top: -100px; left: -100px; animation: orb-float 8s ease-in-out infinite; }
        .orb-2 { width: 500px; height: 500px; background: var(--cyan);  bottom: -150px; right: -100px; animation: orb-float 10s ease-in-out infinite reverse; }
        @keyframes orb-float {
          0%,100% { transform: translate(0,0); }
          50%      { transform: translate(30px,-30px); }
        }
        .hero-content { position: relative; z-index: 2; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(0,212,255,.08); border: 1px solid rgba(0,212,255,.2);
          color: var(--cyan); font-size: 12px; font-weight: 600;
          letter-spacing: 3px; text-transform: uppercase;
          padding: 6px 16px; border-radius: 20px; margin-bottom: 32px;
        }
        .hero-eyebrow .dot-online { width: 6px; height: 6px; }
        .hero-title {
          font-family: var(--font-hero);
          font-size: clamp(72px, 12vw, 140px);
          line-height: .9;
          letter-spacing: 4px;
          margin-bottom: 8px;
        }
        .hero-title .line-green { color: var(--green); display: block; }
        .hero-title .line-dim   { color: rgba(232,237,242,.15); display: block; }
        .hero-sub {
          font-size: clamp(15px, 2vw, 18px);
          color: var(--muted); max-width: 520px; margin: 24px auto 48px;
          line-height: 1.7; font-weight: 500;
        }
        .hero-cta { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
        .stats-bar {
          position: absolute; bottom: 40px; left: 0; right: 0;
          z-index: 2;
        }
        .stats-bar-inner {
          max-width: 700px; margin: 0 auto; padding: 0 24px;
          display: flex; justify-content: space-around; align-items: center;
          background: rgba(13,17,23,.8);
          border: 1px solid var(--border);
          border-radius: 60px;
          padding: 16px 40px;
          backdrop-filter: blur(12px);
        }
        .stats-bar-item { text-align: center; }
        .stats-bar-item .num {
          font-family: var(--font-mono); font-size: 24px; font-weight: 500;
          color: var(--green);
        }
        .stats-bar-item .lbl { font-size: 11px; letter-spacing: 2px; color: var(--muted); margin-top: 2px; text-transform: uppercase; }
        .stats-bar-divider { width: 1px; height: 36px; background: var(--border); }
        .features { padding: 100px 0; }
        .features-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 48px; }
        .feature-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 32px 28px;
          transition: border-color .3s, transform .3s;
        }
        .feature-card:hover { border-color: var(--green); transform: translateY(-4px); }
        .feature-icon { font-size: 36px; margin-bottom: 20px; }
        .feature-title { font-size: 20px; font-weight: 700; margin-bottom: 10px; }
        .feature-desc { font-size: 14px; color: var(--muted); line-height: 1.7; }
        @media (max-width: 768px) {
          .features-grid { grid-template-columns: 1fr; }
          .stats-bar-inner { padding: 14px 20px; }
        }
      `}</style>

      <section className="hero">
        <div className="hero-grid"></div>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>

        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="dot dot-online"></span>
            AI-Powered Fitness Tracking
          </div>

          <h1 className="hero-title">
            <span className="line-green">FITFLEX</span>
            <span className="line-dim">ARENA</span>
          </h1>

          <p className="hero-sub">
            Real-time pose detection counts your reps, validates your form,
            and coaches you through every set — powered by MediaPipe AI.
          </p>

          <div className="hero-cta">
            <Link to="/exercises" className="btn btn-primary btn-lg">
              ▶ &nbsp;Start Training
            </Link>
            <Link to="/history" className="btn btn-secondary btn-lg">
              View History
            </Link>
          </div>
        </div>

        <div className="stats-bar">
          <div className="stats-bar-inner">
            <div className="stats-bar-item">
              <div className="num" id="totalWorkouts">{stats.workouts}</div>
              <div className="lbl">Workouts</div>
            </div>
            <div className="stats-bar-divider"></div>
            <div className="stats-bar-item">
              <div className="num" id="totalReps">{stats.reps}</div>
              <div className="lbl">Total Reps</div>
            </div>
            <div className="stats-bar-divider"></div>
            <div className="stats-bar-item">
              <div
                className="num"
                id="backendStatus"
                style={{ color: stats.status === 'ONLINE' ? 'var(--green)' : stats.status === 'OFFLINE' ? 'var(--red)' : '' }}
              >
                {stats.status}
              </div>
              <div className="lbl">Backend</div>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <p className="section-title">What you get</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <div className="feature-title">Accurate Rep Counting</div>
              <div className="feature-desc">MediaPipe Pose tracks 33 body landmarks at 30 FPS. Every clean rep is detected automatically — no guessing.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">✅</div>
              <div className="feature-title">Real-Time Form Feedback</div>
              <div className="feature-desc">Dynamic elbow drift detection flags bad form the instant it happens, keeping your joints safe.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📡</div>
              <div className="feature-title">Live Video Stream</div>
              <div className="feature-desc">MJPEG stream with neon skeleton overlay delivered straight to your browser — no plugin required.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <div className="feature-title">Session History</div>
              <div className="feature-desc">Every workout is stored locally. Track reps, duration, and progress over time.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <div className="feature-title">WebSocket Updates</div>
              <div className="feature-desc">Rep count, angle, and form status pushed to the dashboard at 20 Hz for zero-lag feedback.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔓</div>
              <div className="feature-title">Fully Open & Local</div>
              <div className="feature-desc">Runs entirely on your machine. Your camera feed and workout data never leave your device.</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
