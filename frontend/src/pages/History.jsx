import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ workouts: 0, reps: 0, time: 0 });
  const [filterEx, setFilterEx] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`);
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        setSessions(data);

        const totalReps = data.reduce((a, s) => a + (s.total_reps || 0), 0);
        const totalMins = Math.round(data.reduce((a, s) => a + (s.duration_seconds || 0), 0) / 60);
        setStats({ workouts: data.length, reps: totalReps, time: totalMins });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const fmtDur = (secs) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const filtered = sessions.filter(s => {
    if (filterEx && s.exercise !== filterEx) return false;
    if (filterUser && !(s.user_id || '').toLowerCase().includes(filterUser.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="container">
      <style>{`
        .history-header {
          display: flex; align-items: flex-end; justify-content: space-between;
          margin-bottom: 32px; flex-wrap: wrap; gap: 16px;
        }
        .history-header h1 { font-family: var(--font-hero); font-size: 52px; letter-spacing: 3px; }
        .history-header p { color: var(--muted); font-size: 14px; margin-top: 4px; }

        .hist-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 40px; }
        .hist-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 24px; text-align: center;
        }
        .hist-stat .num { font-family: var(--font-mono); font-size: 40px; color: var(--green); }
        .hist-stat .lbl { font-size: 11px; letter-spacing: 2px; color: var(--muted); text-transform: uppercase; margin-top: 8px; }

        .filters {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px 20px;
          display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
          margin-bottom: 24px;
        }
        .filters label { font-size: 11px; letter-spacing: 2px; color: var(--muted); text-transform: uppercase; }
        .filters select, .filters input { width: auto; }

        .table-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); overflow: hidden;
        }
        .table-empty {
          text-align: center; padding: 60px; color: var(--muted);
        }
        .table-empty .icon { font-size: 48px; margin-bottom: 16px; }
        .table-empty p { font-size: 14px; }

        tbody tr:hover { background: rgba(0,255,136,.03); cursor: pointer; }
        .ex-pill {
          display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;
          background: rgba(0,212,255,.1); color: var(--cyan); border: 1px solid rgba(0,212,255,.2);
        }

        @media (max-width: 768px) {
          .hist-stats { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="history-header">
        <div>
          <h1>HISTORY</h1>
          <p>All completed workout sessions</p>
        </div>
        <Link to="/exercises" className="btn btn-primary">▶ New Session</Link>
      </div>

      <div className="hist-stats">
        <div className="hist-stat">
          <div className="num">{stats.workouts}</div>
          <div className="lbl">Total Workouts</div>
        </div>
        <div className="hist-stat">
          <div className="num">{stats.reps}</div>
          <div className="lbl">Total Reps</div>
        </div>
        <div className="hist-stat">
          <div className="num">{stats.time}</div>
          <div className="lbl">Total Minutes</div>
        </div>
      </div>

      <div className="filters">
        <label>Filter</label>
        <select value={filterEx} onChange={(e) => setFilterEx(e.target.value)}>
          <option value="">All Exercises</option>
          <option value="bicep_curl">Bicep Curl</option>
        </select>
        <input
          type="text"
          placeholder="Filter by user…"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          style={{ maxWidth: '180px' }}
        />
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>User</th>
              <th>Exercise</th>
              <th>Reps</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6">
                  <div className="table-empty">
                    <div className="icon">⏳</div>
                    <p>Loading sessions…</p>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="6">
                  <div className="table-empty">
                    <div className="icon">⚠️</div>
                    <p>Could not reach backend. Is it running?</p>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <div className="table-empty">
                    <div className="icon">🏋️</div>
                    <p>No sessions found. <Link to="/exercises" style={{ color: 'var(--green)' }}>Start your first workout →</Link></p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(s => (
                <tr key={s.session_id}>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{s.session_id}</td>
                  <td>{fmtDate(s.start_time)}</td>
                  <td>{s.user_id || '—'}</td>
                  <td><span className="ex-pill">{(s.exercise || '').replace('_', ' ')}</span></td>
                  <td className="mono" style={{ color: 'var(--green)', fontWeight: '500' }}>{s.total_reps}</td>
                  <td className="mono">{fmtDur(s.duration_seconds)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
