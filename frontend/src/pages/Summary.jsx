import { Link } from 'react-router-dom';

export default function Summary() {
  const raw = localStorage.getItem('lastSummary');
  let d = {};
  if (raw) {
    try {
      d = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="container" style={{ maxWidth: '860px' }}>
      <style>{`
        .summary-hero {
          text-align: center; padding: 60px 0 48px;
          border-bottom: 1px solid var(--border); margin-bottom: 48px;
        }
        .summary-hero .trophy { font-size: 72px; margin-bottom: 20px; }
        .summary-hero h1 { font-family: var(--font-hero); font-size: 52px; letter-spacing: 3px; color: var(--green); }
        .summary-hero p { color: var(--muted); margin-top: 8px; font-size: 15px; }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 16px; margin-bottom: 40px;
        }
        .sum-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 28px 20px; text-align: center;
        }
        .sum-card .num {
          font-family: var(--font-mono); font-size: 48px; font-weight: 500;
          color: var(--green); line-height: 1;
        }
        .sum-card .lbl {
          font-size: 11px; letter-spacing: 2px; text-transform: uppercase;
          color: var(--muted); margin-top: 10px;
        }

        .sum-detail {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 28px; margin-bottom: 24px;
        }
        .sum-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 0; border-bottom: 1px solid rgba(31,45,61,.5);
          font-size: 14px;
        }
        .sum-row:last-child { border-bottom: none; }
        .sum-row .key { color: var(--muted); }
        .sum-row .val { font-family: var(--font-mono); font-weight: 500; }

        .action-bar { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 40px; }

        @media (max-width: 768px) {
          .summary-grid { grid-template-columns: repeat(2,1fr); }
        }
      `}</style>

      <div className="summary-hero">
        <div className="trophy">🏆</div>
        <h1>SESSION COMPLETE</h1>
        <p>
          {d.user_id ? `Great work, ${d.user_id}! Here's how you did.` : "Great work! Here's how you did."}
        </p>
      </div>

      <div className="summary-grid">
        <div className="sum-card">
          <div className="num">{d.total_reps ?? '—'}</div>
          <div className="lbl">Total Reps</div>
        </div>
        <div className="sum-card">
          <div className="num">{d.duration_seconds ?? '—'}</div>
          <div className="lbl">Duration (sec)</div>
        </div>
        <div className="sum-card">
          <div className="num">1</div>
          <div className="lbl">Sets</div>
        </div>
        <div className="sum-card">
          <div className="num">{d.session_id ?? '—'}</div>
          <div className="lbl">Session ID</div>
        </div>
      </div>

      <div className="sum-detail">
        <p className="section-title">Details</p>
        <div className="sum-row">
          <span className="key">Exercise</span>
          <span className="val">{(d.exercise || '—').replace('_', ' ').toUpperCase()}</span>
        </div>
        <div className="sum-row">
          <span className="key">User ID</span>
          <span className="val">{d.user_id ?? '—'}</span>
        </div>
        <div className="sum-row">
          <span className="key">Total Reps</span>
          <span className="val">{d.total_reps ?? '—'}</span>
        </div>
        <div className="sum-row">
          <span className="key">Duration</span>
          <span className="val">{formatDuration(d.duration_seconds ?? 0)}</span>
        </div>
      </div>

      <div className="action-bar">
        <Link to="/exercises" className="btn btn-primary btn-lg">▶ New Session</Link>
        <Link to="/history" className="btn btn-secondary">View History</Link>
        <Link to="/" className="btn btn-ghost">Home</Link>
      </div>
    </div>
  );
}
