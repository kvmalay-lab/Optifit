/**
 * FitFlex Arena — app.js
 * Dashboard logic: WebSocket, MJPEG stream, UI updates, timer, lifecycle.
 */

const API    = 'http://localhost:8765';
const WS_URL = 'ws://localhost:8765/ws';

// ── State ──────────────────────────────────────────────────────────────────
let ws           = null;
let wsRetries    = 0;
const MAX_RETRY  = 10;
let startTime    = null;
let timerHandle  = null;
let lastRepCount = 0;
let paused       = false;

// ── Grab session info set during exercise selection ─────────────────────────
const sessionRaw = localStorage.getItem('activeSession');
const session    = sessionRaw ? JSON.parse(sessionRaw) : {};

// ─────────────────────────────────────────────────────────────────────────────
// 1.  INIT
// ─────────────────────────────────────────────────────────────────────────────
function init() {
  if (!window.location.pathname.includes('dashboard.html')) return;

  // Populate exercise label
  const el = document.getElementById('exerciseLabel');
  if (el && session.exercise) {
    el.textContent = session.exercise.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  startTimer();
  connectWebSocket();
  connectVideoStream();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  TIMER
// ─────────────────────────────────────────────────────────────────────────────
function startTimer() {
  startTime = Date.now();
  timerHandle = setInterval(() => {
    if (paused) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const el = document.getElementById('timerDisplay');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  WEBSOCKET
// ─────────────────────────────────────────────────────────────────────────────
function connectWebSocket() {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsRetries = 0;
    if (dot)  { dot.className  = 'dot dot-online'; }
    if (text) { text.textContent = 'LIVE TRACKING'; }
    showVideoOverlay(true);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      updateUI(data);
    } catch { /* ignore malformed frames */ }
  };

  ws.onclose = () => {
    if (dot)  { dot.className  = 'dot dot-offline'; }
    if (text) { text.textContent = 'RECONNECTING…'; }
    showVideoOverlay(false);

    if (wsRetries < MAX_RETRY) {
      wsRetries++;
      setTimeout(connectWebSocket, 1500);
    } else {
      if (text) text.textContent = 'DISCONNECTED';
    }
  };

  ws.onerror = () => ws.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  VIDEO STREAM
// ─────────────────────────────────────────────────────────────────────────────
function connectVideoStream() {
  const img     = document.getElementById('cameraFeed');
  const offline = document.getElementById('videoOffline');

  if (!img) return;

  img.src = `${API}/stream.mjpg?t=${Date.now()}`;

  img.onload = () => {
    img.style.display = 'block';
    if (offline) offline.style.display = 'none';
  };

  img.onerror = () => {
    img.style.display = 'none';
    if (offline) offline.style.display = 'flex';
    // Retry
    setTimeout(connectVideoStream, 3000);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  UI UPDATE (called on every WS message)
// ─────────────────────────────────────────────────────────────────────────────
function updateUI(data) {
  // ── Rep count
  const repEl = document.getElementById('repDisplay');
  if (repEl) {
    if (data.rep_count !== lastRepCount) {
      repEl.classList.add('bump');
      setTimeout(() => repEl.classList.remove('bump'), 200);
      lastRepCount = data.rep_count;
    }
    repEl.textContent = data.rep_count ?? '—';
  }

  // ── Angle
  const angle = data.current_angle ?? 0;
  setTextById('angleDisplay',  angle ? `${angle}°` : '—');
  setTextById('overlayAngle',  angle ? `${angle}°` : '—');
  setTextById('angleCurrent',  angle ? `${angle}°` : '—');

  // ── Angle bar (0–180 range)
  const bar = document.getElementById('angleBar');
  if (bar) bar.style.width = `${Math.min(100, (angle / 180) * 100)}%`;

  // ── State / phase
  const state = data.state || '—';
  setTextById('stateDisplay', state.replace('_',' '));

  // ── Confidence
  const conf = data.confidence != null ? `${Math.round(data.confidence * 100)}%` : '—';
  setTextById('confDisplay',  conf);
  setTextById('overlayConf',  conf);

  // ── Set
  setTextById('setDisplay', data.set_count ?? '—');

  // ── Form status
  const isInvalid = state === 'INVALID_FORM';
  updateFormStatus(isInvalid);

  // ── AI feedback text
  updateFeedback(data);
}

function updateFormStatus(isInvalid) {
  const panel   = document.getElementById('videoPanel');
  const formEl  = document.getElementById('overlayForm');
  const stateEl = document.getElementById('stateDisplay');

  if (isInvalid) {
    if (panel  && !panel.classList.contains('invalid-flash')) {
      panel.classList.add('invalid-flash');
      setTimeout(() => panel.classList.remove('invalid-flash'), 400);
    }
    if (formEl) { formEl.textContent = 'INVALID'; formEl.style.color = 'var(--red)'; }
    if (stateEl) stateEl.style.color = 'var(--red)';
  } else {
    if (formEl) { formEl.textContent = 'VALID'; formEl.style.color = 'var(--green)'; }
    if (stateEl) stateEl.style.color = '';
  }
}

function updateFeedback(data) {
  const box = document.getElementById('feedbackBox');
  if (!box) return;

  const state = data.state || '';
  let text = 'Tracking…';
  let cls  = '';

  if (state === 'INVALID_FORM') {
    text = '⚠️  Keep your elbow locked — reduce lateral drift!';
    cls  = 'error';
  } else if (state === 'UP') {
    text = '⬇  Lower the weight all the way down.';
    cls  = 'warning';
  } else if (state === 'DOWN') {
    text = '⬆  Curl up! Squeeze at the top.';
    cls  = 'good';
  } else if (state === 'WAITING') {
    text = '👀  Step into frame to begin tracking.';
    cls  = '';
  } else if (data.rep_count > 0) {
    text = `✅  Great rep! Keep it up — ${data.rep_count} done so far.`;
    cls  = 'good';
  }

  box.textContent = text;
  box.className   = `feedback-box${cls ? ' ' + cls : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function setTextById(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showVideoOverlay(show) {
  const el = document.getElementById('videoOverlay');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.  LIFECYCLE ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
async function stopWorkout() {
  // Close WS
  if (ws) { ws.onclose = null; ws.close(); }
  clearInterval(timerHandle);

  const btn = document.querySelector('.btn-danger');
  if (btn) { btn.textContent = 'Stopping…'; btn.disabled = true; }

  try {
    const res = await fetch(`${API}/stop`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const summary = await res.json();
    localStorage.setItem('lastSummary', JSON.stringify(summary));
    localStorage.removeItem('activeSession');
    window.location.href = 'summary.html';
  } catch (err) {
    alert(`Error stopping session: ${err.message}`);
    if (btn) { btn.textContent = '⏹ End Session'; btn.disabled = false; }
  }
}

function goBack() {
  if (confirm('End this session and go back?')) stopWorkout();
}

// ─────────────────────────────────────────────────────────────────────────────
// 8.  BOOT
// ─────────────────────────────────────────────────────────────────────────────
init();
