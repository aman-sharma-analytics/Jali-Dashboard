// src/lib/api.js — all fetch calls to the backend

const SERVER = 'http://localhost:3008';

// Save one webinar session. `ins` = buildInsights() output + webinarDate.
export async function saveSession(ins) {
  const res = await fetch(`${SERVER}/api/sessions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(ins),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json(); // { message, sessionId }
}

// List all past sessions (summary cards).
export async function listSessions() {
  const res = await fetch(`${SERVER}/api/sessions`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

// Load one full session by id.
export async function loadSession(id) {
  const res = await fetch(`${SERVER}/api/sessions/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

// Delete a session permanently.
export async function deleteSession(id) {
  const res = await fetch(`${SERVER}/api/sessions/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

// Compare sessions by webinar names + dates.
// webinars = ['W1', 'W2']  dates = ['2026-04-26', '2026-05-03']
// Returns an array of full ins objects — one per (webinar, date) pair.
export async function compareSessionsByDate({ webinars, dates }) {
  const params = new URLSearchParams({
    webinars: webinars.join(','),
    dates:    dates.join(','),
  });
  const res = await fetch(`${SERVER}/api/sessions/compare?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json(); // array of ins objects
}


// ── List all batches with session counts ───────────────────────────────────
// Returns: [{batch_label, batch_year, batch_month, batch_week_num,
//            start_date, end_date, session_count, free_count, paid_count, unknown_count}]
export async function listBatches() {
  const res = await fetch(`${SERVER}/api/batches`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

// ── Compare batches: groupA vs groupB, optional audience filter ────────────
// groupA = ['W2026-05-W2', 'W2026-05-W1']
// groupB = ['W2026-04-W4']
// audience = 'all' | 'free' | 'paid'
// Returns: { groupA: {...metrics}, groupB: {...metrics}, audience, labelsA, labelsB }
export async function compareBatches({ groupA, groupB, audience = 'all' }) {
  const params = new URLSearchParams({
    groupA:   groupA.join(','),
    groupB:   groupB.join(','),
    audience,
  });
  const res = await fetch(`${SERVER}/api/sessions/compare-batches?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}


// ── Compute batch label for a given date (frontend mirror of backend logic) ─
// Week = Sunday to Saturday.
// Returns: { label, year, month, weekNum, startDate, endDate } or null
export function computeBatch(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;

  // Week = Sunday to Saturday
  // Week number = ceil(sunday's day-of-month / 7)
  // Batch label uses the month containing the SUNDAY
  const dow = d.getDay(); // 0=Sun
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dow);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const year    = sunday.getFullYear();
  const month   = sunday.getMonth() + 1;
  const weekNum = Math.ceil(sunday.getDate() / 7);

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  return {
    label:     `W${year}-${pad(month)}-W${weekNum}`,
    year,
    month,
    weekNum,
    startDate: fmt(sunday),
    endDate:   fmt(saturday),
  };
}