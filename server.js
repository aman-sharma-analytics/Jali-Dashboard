// ─────────────────────────────────────────────────────────────────────────────
//  backend/server.js
//
//  ROUTES
//  POST   /api/sessions                save a session + all KPIs + messages
//  GET    /api/sessions                list all sessions (summary)
//  GET    /api/sessions/compare        compare sessions by webinar+date
//  GET    /api/sessions/compare-batches compare aggregated metrics by batch
//  GET    /api/batches                 list all batches with counts
//  GET    /api/sessions/:id            load one full session
//  DELETE /api/sessions/:id            delete a session
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import pool, { testConnection } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const app  = express();
const PORT = Number(process.env.PORT) || 3008;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));


// ═════════════════════════════════════════════════════════════════════════════
//  BATCH HELPER
//  Given a date string like "2026-05-08", computes the batch:
//    - Monday-Saturday week within the month
//    - Returns label "W{YYYY}-{MM}-W{N}"  e.g. "W2026-05-W2"
//    - Returns startDate (Monday), endDate (Saturday)
//
//  EXAMPLES:
//    May 3 (Sun) 2026 → still in W2026-05-W1 (week starts Mon Apr 27 → May 2)
//                       Actually: Apr 27 Mon → May 2 Sat → that's the LAST week
//                       of April since May 1-2 are the only May days in it.
//                       We assign batch by which month contains MORE of the week.
//    May 4 (Mon) 2026 → Batch 1 of May (W2026-05-W1)
//    May 11 (Mon) 2026 → Batch 2 of May (W2026-05-W2)
//
//  Logic: Find Monday of that week. If that Monday is in May → it's a May batch.
//         Otherwise it belongs to the previous month's batch.
// ═════════════════════════════════════════════════════════════════════════════

function computeBatch(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;

  // ── Week = Sunday to Saturday ─────────────────────────────────────
  // Week number within month = ceil(sunday's day-of-month / 7)
  // Batch label = month containing the SUNDAY

  const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dow);   // rewind to Sunday

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const year    = sunday.getFullYear();
  const month   = sunday.getMonth() + 1;        // 1-12
  const weekNum = Math.ceil(sunday.getDate() / 7); // 1-5

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


// ═════════════════════════════════════════════════════════════════════════════
//  POST /api/sessions
// ═════════════════════════════════════════════════════════════════════════════

app.post('/api/sessions', async (req, res) => {
  const ins = req.body;

  if (!ins || !ins.userName || !ins.meta) {
    return res.status(400).json({ error: 'Invalid payload.' });
  }

  const { userName, meta, headline, segments, countries, chat, webinarDate, leadType } = ins;

  // Compute batch from webinarDate
  const batch = computeBatch(webinarDate);
  const safeLeadType = (leadType === 'free' || leadType === 'paid') ? leadType : 'unknown';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. sessions ───────────────────────────────────────────────
    const [sessionResult] = await conn.query(
      `INSERT INTO sessions
         (user_name, webinar_date, batch_label, batch_year, batch_month,
          batch_week_num, batch_start_date, batch_end_date, lead_type,
          topic, webinar_id, duration_min, registrants, unique_viewers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userName,
        webinarDate || null,
        batch?.label     ?? null,
        batch?.year      ?? null,
        batch?.month     ?? null,
        batch?.weekNum   ?? null,
        batch?.startDate ?? null,
        batch?.endDate   ?? null,
        safeLeadType,
        meta.topic       ?? '',
        meta.webinarId   ?? '',
        meta.durationMin ?? 0,
        headline.registrants   ?? 0,
        headline.uniqueViewers ?? 0,
      ]
    );
    const sessionId = sessionResult.insertId;

    // ── 2. kpis ──────────────────────────────────────────────────
    await conn.query(
      `INSERT INTO kpis
         (session_id, peak_live, final_count, show_up_rate, avg_time_min, rejoin_rate,
          avg_concurrent, stayed_to_end, stayed_to_end_pct, ghost_count,
          peak_minute, unique_chatters, human_messages, total_chat,
          webinar_start)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        headline.peakConcurrent  ?? 0,
        headline.stayedToEnd     ?? 0,
        headline.showupRate      ?? 0,
        estimateAvgTime(segments),
        headline.stayedToEndPct  ?? 0,
        headline.avgConcurrent   ?? 0,
        headline.stayedToEnd     ?? 0,
        headline.stayedToEndPct  ?? 0,
        headline.ghostCount      ?? 0,
        headline.peakMinute      ?? 0,
        chat?.uniqueChatters     ?? 0,
        chat?.humanMessages      ?? 0,
        chat?.total              ?? 0,
        meta.start ? new Date(meta.start).toISOString() : null,
      ]
    );

    // ── 3. insights_json ──────────────────────────────────────────
    await conn.query(
      `INSERT INTO insights_json
         (session_id, concurrent_curve, live_count, segments, lateness,
          countries, chat_topics, top_chatters, chat_per5, chat_messages)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        JSON.stringify(ins.concurrentCurve ?? []),
        JSON.stringify(ins.liveCount       ?? []),
        JSON.stringify(ins.segments        ?? []),
        JSON.stringify(ins.lateness        ?? []),
        JSON.stringify(countries           ?? []),
        JSON.stringify(chat?.topics        ?? []),
        JSON.stringify(chat?.topChatters   ?? []),
        JSON.stringify(chat?.chatPer5      ?? []),
        JSON.stringify(chat?.messages      ?? []),
      ]
    );

    await conn.commit();
    console.log(`✅  Saved id=${sessionId} webinar="${userName}" date=${webinarDate} batch=${batch?.label} lead=${safeLeadType}`);
    return res.status(201).json({ message: 'Session saved.', sessionId, batch: batch?.label, leadType: safeLeadType });

  } catch (err) {
    await conn.rollback();
    console.error('POST /api/sessions error:', err.message);
    return res.status(500).json({ error: 'Failed to save session.', detail: err.message });
  } finally {
    conn.release();
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /api/sessions  — summary list
// ═════════════════════════════════════════════════════════════════════════════

app.get('/api/sessions', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         s.id, s.user_name, s.webinar_date, s.batch_label, s.lead_type,
         s.topic, s.webinar_id, s.uploaded_at, s.duration_min,
         s.registrants, s.unique_viewers,
         k.peak_live, k.show_up_rate
       FROM sessions s
       LEFT JOIN kpis k ON k.session_id = s.id
       ORDER BY s.uploaded_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/sessions error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch sessions.', detail: err.message });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /api/batches
//  Returns all distinct batches with session counts and free/paid breakdown.
//  Used by the BatchCompare panel to populate the picker.
// ═════════════════════════════════════════════════════════════════════════════

app.get('/api/batches', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         batch_label,
         batch_year,
         batch_month,
         batch_week_num,
         MIN(batch_start_date) AS start_date,
         MAX(batch_end_date)   AS end_date,
         COUNT(*) AS session_count,
         SUM(CASE WHEN lead_type = 'free' THEN 1 ELSE 0 END) AS free_count,
         SUM(CASE WHEN lead_type = 'paid' THEN 1 ELSE 0 END) AS paid_count,
         SUM(CASE WHEN lead_type = 'unknown' THEN 1 ELSE 0 END) AS unknown_count,
         GROUP_CONCAT(DISTINCT user_name ORDER BY user_name SEPARATOR ', ') AS workshop_names
       FROM sessions
       WHERE batch_label IS NOT NULL
       GROUP BY batch_label, batch_year, batch_month, batch_week_num
       ORDER BY batch_year DESC, batch_month DESC, batch_week_num DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/batches error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch batches.', detail: err.message });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /api/sessions/compare-batches?groupA=W2026-05-W2,W2026-05-W1&groupB=W2026-04-W4&audience=all|free|paid
//
//  Returns aggregated metrics for each group so the BatchCompare panel can
//  show: total attendees, avg attendance, avg engagement, drop-off rate,
//  free vs paid breakdown, etc.
// ═════════════════════════════════════════════════════════════════════════════

app.get('/api/sessions/compare-batches', async (req, res) => {
  const { groupA, groupB, audience = 'all' } = req.query;

  if (!groupA || !groupB) {
    return res.status(400).json({ error: 'Provide groupA and groupB query params (comma-separated batch labels).' });
  }

  const labelsA = groupA.split(',').map((s) => s.trim()).filter(Boolean);
  const labelsB = groupB.split(',').map((s) => s.trim()).filter(Boolean);

  if (!labelsA.length || !labelsB.length) {
    return res.status(400).json({ error: 'groupA and groupB must each contain at least one batch label.' });
  }

  // Lead type filter
  let leadFilter = '';
  const audienceParams = [];
  if (audience === 'free') {
    leadFilter = " AND s.lead_type = 'free'";
  } else if (audience === 'paid') {
    leadFilter = " AND s.lead_type = 'paid'";
  }

  try {
    const buildAggregate = async (labels) => {
      const placeholders = labels.map(() => '?').join(',');
      const [rows] = await pool.query(
        `SELECT
           s.id, s.user_name, s.webinar_date, s.batch_label, s.lead_type,
           s.duration_min, s.registrants, s.unique_viewers,
           k.peak_live, k.final_count, k.show_up_rate, k.avg_time_min,
           k.avg_concurrent, k.stayed_to_end, k.stayed_to_end_pct, k.ghost_count,
           k.unique_chatters, k.human_messages, k.total_chat
         FROM sessions s
         LEFT JOIN kpis k ON k.session_id = s.id
         WHERE s.batch_label IN (${placeholders})${leadFilter}`,
        labels
      );

      // Aggregate metrics
      const sessionCount = rows.length;
      const totalRegistrants = rows.reduce((sum, r) => sum + (r.registrants || 0), 0);
      const totalAttendees   = rows.reduce((sum, r) => sum + (r.unique_viewers || 0), 0);
      const totalStayedEnd   = rows.reduce((sum, r) => sum + (r.stayed_to_end || 0), 0);
      const totalChatters    = rows.reduce((sum, r) => sum + (r.unique_chatters || 0), 0);
      const totalChat        = rows.reduce((sum, r) => sum + (r.total_chat || 0), 0);

      const avgAttendancePerSession = sessionCount > 0 ? Math.round(totalAttendees / sessionCount) : 0;
      const avgShowupRate = sessionCount > 0
        ? rows.reduce((s, r) => s + (parseFloat(r.show_up_rate) || 0), 0) / sessionCount
        : 0;

      // Engagement score (0-100): blend of stay rate, chat participation, peak ratio
      const engagementScore = sessionCount > 0
        ? Math.round(
            rows.reduce((sum, r) => {
              const stayRate   = (r.unique_viewers > 0) ? (r.stayed_to_end || 0) / r.unique_viewers : 0;
              const chatRate   = (r.unique_viewers > 0) ? (r.unique_chatters || 0) / r.unique_viewers : 0;
              const peakRatio  = (r.unique_viewers > 0) ? (r.peak_live || 0) / r.unique_viewers : 0;
              return sum + (stayRate * 50 + chatRate * 30 + peakRatio * 20);
            }, 0) / sessionCount
          )
        : 0;

      // Drop-off rate: % who joined but didn't stay to end
      const dropOffRate = totalAttendees > 0
        ? +((1 - (totalStayedEnd / totalAttendees)) * 100).toFixed(1)
        : 0;

      // Lead-type breakdown
      const freeRows = rows.filter((r) => r.lead_type === 'free');
      const paidRows = rows.filter((r) => r.lead_type === 'paid');
      const freeAttendees = freeRows.reduce((s, r) => s + (r.unique_viewers || 0), 0);
      const paidAttendees = paidRows.reduce((s, r) => s + (r.unique_viewers || 0), 0);

      // Distinct weeks in this group
      const distinctWeeks = new Set(rows.map((r) => r.batch_label)).size;

      return {
        sessionCount,
        weekCount: distinctWeeks,
        totalRegistrants,
        totalAttendees,
        avgAttendancePerSession,
        avgShowupRate: +avgShowupRate.toFixed(1),
        engagementScore,
        dropOffRate,
        totalStayedEnd,
        totalChatters,
        totalChat,
        freeAttendees,
        paidAttendees,
        freeSessionCount: freeRows.length,
        paidSessionCount: paidRows.length,
        sessions: rows.map((r) => ({
          id: r.id,
          userName: r.user_name,
          webinarDate: r.webinar_date,
          batchLabel: r.batch_label,
          leadType: r.lead_type,
          registrants: r.registrants,
          uniqueViewers: r.unique_viewers,
          stayedToEnd: r.stayed_to_end,
          showupRate: parseFloat(r.show_up_rate) || 0,
          peakLive: r.peak_live,
          uniqueChatters: r.unique_chatters,
        })),
      };
    };

    const [a, b] = await Promise.all([buildAggregate(labelsA), buildAggregate(labelsB)]);

    if (a.sessionCount === 0 && b.sessionCount === 0) {
      return res.status(404).json({
        error: 'No sessions found for the selected batches and audience filter.',
        groupA: labelsA,
        groupB: labelsB,
        audience,
      });
    }

    return res.json({
      groupA: a,
      groupB: b,
      audience,
      labelsA,
      labelsB,
    });

  } catch (err) {
    console.error('GET /api/sessions/compare-batches error:', err.message);
    return res.status(500).json({ error: 'Failed to compare batches.', detail: err.message });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /api/sessions/compare  ⚠ MUST be before /:id
// ═════════════════════════════════════════════════════════════════════════════

app.get('/api/sessions/compare', async (req, res) => {
  const { webinars, dates } = req.query;

  if (!webinars || !dates) {
    return res.status(400).json({ error: 'Provide webinars and dates query params.' });
  }

  const webinarList = webinars.split(',').map((w) => w.trim()).filter(Boolean);
  const dateList    = dates.split(',').map((d) => d.trim()).filter(Boolean);

  if (!webinarList.length || !dateList.length) {
    return res.status(400).json({ error: 'webinars and dates must not be empty.' });
  }

  try {
    const placeholders = [];
    const params = [];
    webinarList.forEach((w, i) => {
      const date = dateList[i] || dateList[0];
      placeholders.push('(s.user_name = ? AND s.webinar_date = ?)');
      params.push(w, date);
    });

    const [rows] = await pool.query(
      `SELECT
         s.id, s.user_name, s.webinar_date, s.batch_label, s.lead_type,
         s.topic, s.webinar_id, s.duration_min, s.registrants, s.unique_viewers,
         k.peak_live, k.final_count, k.show_up_rate, k.avg_time_min, k.rejoin_rate,
         k.avg_concurrent, k.stayed_to_end, k.stayed_to_end_pct, k.ghost_count,
         k.peak_minute, k.unique_chatters, k.human_messages, k.total_chat,
         k.webinar_start,
         j.concurrent_curve, j.live_count, j.segments, j.lateness,
         j.countries, j.chat_topics, j.top_chatters, j.chat_per5, j.chat_messages
       FROM sessions s
       LEFT JOIN kpis          k ON k.session_id = s.id
       LEFT JOIN insights_json j ON j.session_id = s.id
       WHERE ${placeholders.join(' OR ')}
       ORDER BY s.webinar_date ASC`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'No sessions found for the selected webinars and dates.',
        webinars: webinarList,
        dates: dateList,
      });
    }

    return res.json(rows.map((r) => buildInsFromRow(r)));

  } catch (err) {
    console.error('GET /api/sessions/compare error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch comparison data.', detail: err.message });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /api/sessions/:id  ⚠ Must come AFTER /compare and /compare-batches
// ═════════════════════════════════════════════════════════════════════════════

app.get('/api/sessions/:id', async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) {
    return res.status(400).json({ error: 'Session ID must be a number.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         s.id, s.user_name, s.webinar_date, s.batch_label, s.lead_type,
         s.topic, s.webinar_id, s.duration_min, s.registrants, s.unique_viewers,
         k.peak_live, k.final_count, k.show_up_rate, k.avg_time_min, k.rejoin_rate,
         k.avg_concurrent, k.stayed_to_end, k.stayed_to_end_pct, k.ghost_count,
         k.peak_minute, k.unique_chatters, k.human_messages, k.total_chat,
         k.webinar_start,
         j.concurrent_curve, j.live_count, j.segments, j.lateness,
         j.countries, j.chat_topics, j.top_chatters, j.chat_per5, j.chat_messages
       FROM sessions s
       LEFT JOIN kpis          k ON k.session_id = s.id
       LEFT JOIN insights_json j ON j.session_id = s.id
       WHERE s.id = ?`,
      [sessionId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: `Session ${sessionId} not found.` });
    }

    return res.json(buildInsFromRow(rows[0]));

  } catch (err) {
    console.error(`GET /api/sessions/${sessionId} error:`, err.message);
    return res.status(500).json({ error: 'Failed to load session.', detail: err.message });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  DELETE /api/sessions/:id
// ═════════════════════════════════════════════════════════════════════════════

app.delete('/api/sessions/:id', async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) {
    return res.status(400).json({ error: 'Session ID must be a number.' });
  }
  try {
    const [result] = await pool.query(
      'DELETE FROM sessions WHERE id = ?', [sessionId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `Session ${sessionId} not found.` });
    }
    console.log(`🗑️  Session ${sessionId} deleted.`);
    return res.json({ message: `Session ${sessionId} deleted.` });
  } catch (err) {
    console.error(`DELETE /api/sessions/${sessionId} error:`, err.message);
    return res.status(500).json({ error: 'Failed to delete session.', detail: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — rebuild full ins object from a DB row
// ─────────────────────────────────────────────────────────────────────────────

function buildInsFromRow(r) {
  let messages = [];
  if (r.chat_messages) {
    try {
      messages = typeof r.chat_messages === 'string'
        ? JSON.parse(r.chat_messages)
        : r.chat_messages;
    } catch (e) { messages = []; }
  }

  const start = r.webinar_start ? new Date(r.webinar_start) : null;
  const end   = (start && r.duration_min)
    ? new Date(start.getTime() + r.duration_min * 60000)
    : null;

  return {
    userName:    r.user_name,
    webinarDate: r.webinar_date,
    batchLabel:  r.batch_label,
    leadType:    r.lead_type || 'unknown',
    meta: {
      topic:       r.topic,
      webinarId:   r.webinar_id,
      durationMin: r.duration_min,
      start,
      end,
    },
    headline: {
      registrants:    r.registrants,
      uniqueViewers:  r.unique_viewers,
      attendedUnique: r.unique_viewers,
      showupRate:     parseFloat(r.show_up_rate)    || 0,
      peakConcurrent: r.peak_live                   || 0,
      peakMinute:     r.peak_minute                 || 0,
      avgConcurrent:  r.avg_concurrent              || 0,
      stayedToEnd:    r.stayed_to_end               || 0,
      stayedToEndPct: parseFloat(r.stayed_to_end_pct) || 0,
      durationMin:    r.duration_min                || 0,
      ghostCount:     r.ghost_count                 || 0,
    },
    concurrentCurve: r.concurrent_curve ?? [],
    liveCount:       r.live_count       ?? [],
    segments:        r.segments         ?? [],
    lateness:        r.lateness         ?? [],
    countries:       r.countries        ?? [],
    chat: {
      total:          r.total_chat       || messages.length,
      humanMessages:  r.human_messages  || messages.length,
      botMessages:    0,
      uniqueChatters: r.unique_chatters || new Set(messages.map((m) => m.sender)).size,
      topChatters:    r.top_chatters ?? [],
      chatPer5:       r.chat_per5    ?? [],
      topics:         r.chat_topics  ?? [],
      messages,
    },
  };
}


// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — estimate avg session time from segments
// ─────────────────────────────────────────────────────────────────────────────

function estimateAvgTime(segments) {
  if (!segments?.length) return 0;
  const MID = {
    'Drive-by':  2.5,
    'Browser':   17.5,
    'Engaged':   60,
    'Committed': 135,
    'Super-fan': 210,
  };
  let totalMin = 0, totalPeople = 0;
  for (const seg of segments) {
    totalMin    += (MID[seg.segment] ?? 0) * (seg.count || 0);
    totalPeople += (seg.count || 0);
  }
  return totalPeople > 0 ? Math.round(totalMin / totalPeople) : 0;
}


// ─────────────────────────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────────────────────────

await testConnection();

app.listen(PORT, () => {
  console.log(`\n🚀  Server running on http://localhost:${PORT}\n`);
  console.log('    POST   /api/sessions                  save a session');
  console.log('    GET    /api/sessions                  list all sessions');
  console.log('    GET    /api/batches                   list all batches');
  console.log('    GET    /api/sessions/compare          compare by webinar+date');
  console.log('    GET    /api/sessions/compare-batches  compare by batch + audience');
  console.log('    GET    /api/sessions/:id              load one session');
  console.log('    DELETE /api/sessions/:id              delete a session\n');
});