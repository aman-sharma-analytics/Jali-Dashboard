// =====================================================================
// INSIGHTS — turn parsed data into dashboard-ready aggregates.
// Every aggregate also keeps a reference back to the raw chat messages
// so the UI can drill down ("show me the messages behind this number").
// =====================================================================

const minutesBetween = (a, b) => (b.getTime() - a.getTime()) / 60000;

// ---------- Chat keyword detection ----------
// Each topic returns the matching messages (so the UI can show them on click)

const KEYWORD_TOPICS = {
  certificate: {
    label: "Certificate",
    patterns: [/\bcertificate?s?\b/i, /\bcertif/i, /प्रमाण/, /certification/i],
  },
  recording: {
    label: "Recording",
    patterns: [/\brecording\b/i, /\brecorded\b/i, /\breplay\b/i, /\bvideo\b.*\bsend/i, /रिकॉर्ड/i],
  },
  payment_link: {
    label: "Payment link queries",
    patterns: [
      /\bpayment\s+link\b/i,
      /\bpay(ment)?\b.*\blink\b/i,
      /\blink\b.*\bpay(ment)?\b/i,
      /\bpayment\b.*\bnot working\b/i,
      /\blink\b.*\bnot working\b/i,
      /\bunable\b.*\bpay\b/i,
      /\bcan(no|')?t\b.*\bpay\b/i,
      /\bwhere\b.*\bpay\b/i,
      /\bpaytm\b/i,
      /\bupi\b/i,
      /\bcheckout\b/i,
    ],
  },
  pricing: {
    label: "Pricing / Fees",
    patterns: [/\bprice\b/i, /\bfees?\b/i, /\bcost\b/i, /\bpaid\b/i, /\bpayment\b/i, /\bhow much\b/i, /\bdiscount\b/i, /\bcoupon\b/i, /कितना\b/, /कीमत/],
  },
  enrollment: {
    label: "Enrollment / Joining",
    patterns: [/\benroll/i, /\bjoin (the )?course\b/i, /\bregister/i, /\binterested\b/i, /\bsign ?up\b/i, /\bbuy\b/i, /\bpurchase\b/i],
  },
  audio_video: {
    label: "Audio / video issues",
    patterns: [
      /\baudio\b/i, /\bsound\b/i, /\bvoice\b/i, /\bmic\b/i,
      /\bnot clear\b/i, /\bnot audible\b/i, /\becho\b/i,
      /\blag/i, /\bbuffering\b/i, /\bfreezing\b/i,
      /\bcan(no|')t hear\b/i, /\bcan(no|')t see\b/i, /\bnot visible\b/i,
    ],
  },
  thanks: {
    label: "Thanks / appreciation",
    patterns: [/^\s*(thanks|thank ?you|thx|ty|tysm|thnx)[\s!.?]*$/i, /\bthank\s*u\b/i, /\bgreat session\b/i, /\bawesome\b/i, /\bamazing\b/i],
  },
  questions: {
    label: "Questions",
    patterns: [/\?$/, /^\s*(how|what|when|where|why|can|will|is|does|do|sir|mam|ma'am)\b/i],
  },
  greetings: {
    label: "Greetings",
    patterns: [/^\s*(hi+|hello+|hey+|namaste|good morning|gm)[\s!.?]*$/i],
  },
  hindi_language: {
    label: "Hindi language demand",
    patterns: [/\bhindi\b/i, /\bhinglish\b/i, /\bhindi me\b/i, /\bin hindi\b/i, /\bhindi language\b/i, /à¤¹à¤¿à¤‚à¤¦à¥€/i],
  },
  notes_materials: {
    label: "Notes & materials",
    patterns: [/\bnotes?\b/i, /\bslides?\b/i, /\bmaterials?\b/i, /\bppt\b/i, /\bpdf\b/i, /\bresou?rces?\b/i, /\bhandouts?\b/i],
  },
  link_access: {
    label: "Link access issues",
    patterns: [/\blink\b/i, /\baccess\b/i, /\blogin\b/i, /\bnot able\b.*\bjoin\b/i, /\bunable\b.*\bjoin\b/i, /\bjoin\b.*\blink\b/i],
  },
  simlive_suspicion: {
    label: "Simlive suspicion",
    patterns: [/\brecorded\b.*\blive\b/i, /\bpre[- ]?recorded\b/i, /\bis this live\b/i, /\bnot live\b/i, /\bsimlive\b/i, /\bautomated\b/i],
  },
  overselling: {
    label: "Over-selling fatigue",
    patterns: [/\bsell(ing)?\b/i, /\bsales?\b/i, /\bpitch\b/i, /\bpromotion\b/i, /\bprogram\b.*\b(last|hour|long)\b/i, /\btoo much\b.*\b(pitch|sell|sales)\b/i],
  },
  repeat_requests: {
    label: "Repeat requests",
    patterns: [/\brepeat\b/i, /\bonce again\b/i, /\bplease explain again\b/i, /\bdid not understand\b/i, /\bmissed\b.*\b(part|point)\b/i],
  },
  data_privacy: {
    label: "Data privacy",
    patterns: [/\bprivacy\b/i, /\bdata\b.*\bsecure\b/i, /\bpersonal data\b/i, /\bpermission\b/i, /\bconsent\b/i, /\bemail\b.*\bshare\b/i],
  },
  speed_pacing: {
    label: "Speed / pacing",
    patterns: [/\btoo fast\b/i, /\bslow(ly)?\b/i, /\bspeed\b/i, /\bpace\b/i, /\bpacing\b/i, /\bcan't follow\b/i, /\bcannot follow\b/i],
  },
  screen_visibility: {
    label: "Screen visibility",
    patterns: [/\bscreen\b/i, /\bzoom in\b/i, /\bnot visible\b/i, /\bfont\b.*\bsmall\b/i, /\bsmall\b.*\btext\b/i, /\bcan't see\b/i, /\bcannot see\b/i],
  },
};

function classifyMessages(messages) {
  // Returns { topicKey: [message indexes] }
  const byTopic = {};
  for (const k of Object.keys(KEYWORD_TOPICS)) byTopic[k] = [];

  messages.forEach((msg, idx) => {
    const body = msg.body || "";
    if (!body) return;
    for (const [k, def] of Object.entries(KEYWORD_TOPICS)) {
      if (def.patterns.some((re) => re.test(body))) {
        byTopic[k].push(idx);
      }
    }
  });
  if (byTopic.payment_link?.length && byTopic.pricing?.length) {
    const paymentIndexes = new Set(byTopic.payment_link);
    byTopic.pricing = byTopic.pricing.filter((idx) => !paymentIndexes.has(idx));
  }
  byTopic.hindi_language = Array.from(new Set([
    ...(byTopic.hindi_language || []),
    ...messages
      .map((msg, idx) => (/हिंदी|हिन्दी/i.test(msg.body || "") ? idx : null))
      .filter((idx) => idx != null),
  ]));
  return byTopic;
}

// ---------- Concurrent attendance curve from join/leave ----------

function buildConcurrentCurve(rows, start, end, stepMin = 2) {
  if (!start || !end) return [];
  const totalMin = Math.round(minutesBetween(start, end));
  const points = [];
  for (let m = 0; m <= totalMin; m += stepMin) {
    const t = new Date(start.getTime() + m * 60000);
    let active = 0;
    for (const r of rows) {
      if (!r.attended || !r.join || !r.leave) continue;
      if (r.join <= t && r.leave >= t) active++;
    }
    points.push({ min: m, active, clock: clockOf(start, m) });
  }
  return points;
}

const clockOf = (start, mOffset) => {
  const t = new Date(start.getTime() + mOffset * 60000);
  let h = t.getHours();
  const mi = String(t.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mi} ${ap}`;
};

// ---------- Time-in-session segmentation ----------

function segmentByTime(perPerson) {
  const buckets = [
    { segment: "Drive-by",  range: "<5 min",     min: 0,   max: 5,   count: 0 },
    { segment: "Browser",   range: "5–30 min",   min: 5,   max: 30,  count: 0 },
    { segment: "Engaged",   range: "30–90 min",  min: 30,  max: 90,  count: 0 },
    { segment: "Committed", range: "90–180 min", min: 90,  max: 180, count: 0 },
    { segment: "Super-fan", range: "180+ min",   min: 180, max: 9e9, count: 0 },
  ];
  perPerson.forEach((p) => {
    for (const b of buckets) {
      if (p.totalMin >= b.min && p.totalMin < b.max) {
        b.count++;
        break;
      }
    }
  });
  const total = perPerson.length || 1;
  return buckets.map((b) => ({ ...b, pct: +((b.count / total) * 100).toFixed(1) }));
}

// ---------- Lateness (first-join offset) ----------

function lateness(perPerson, start) {
  if (!start) return [];
  const buckets = [
    { bucket: "On time",     range: "0–15 min",  min: -300, max: 15,  count: 0 },
    { bucket: "Slightly late", range: "15–30 min", min: 15,   max: 30,  count: 0 },
    { bucket: "Late",        range: "30–60 min", min: 30,   max: 60,  count: 0 },
    { bucket: "Very late",   range: "1–2 hr",    min: 60,   max: 120, count: 0 },
    { bucket: "Final hr",    range: "2 hr+",     min: 120,  max: 9e9, count: 0 },
  ];
  perPerson.forEach((p) => {
    if (!p.firstJoin) return;
    const off = minutesBetween(start, p.firstJoin);
    for (const b of buckets) {
      if (off >= b.min && off < b.max) {
        b.count++;
        break;
      }
    }
  });
  return buckets;
}

// ---------- main: build full insights for one user ----------

export function buildInsights({ userName, attendee, chat, attendanceCount }) {
  const { meta, rows } = attendee;
  const start = meta.start;
  const end = meta.end;

  // Per-person aggregation
  const byEmail = new Map();
  rows.forEach((r) => {
    const k = r.email || r.name || "anon-" + Math.random();
    if (!byEmail.has(k)) {
      byEmail.set(k, {
        email: r.email,
        name: r.name,
        country: r.country,
        attended: r.attended,
        firstJoin: r.join,
        lastLeave: r.leave,
        totalMin: 0,
        sessions: 0,
        registrationTime: r.registrationTime,
      });
    }
    const p = byEmail.get(k);
    p.attended = p.attended || r.attended;
    p.totalMin += r.timeMin;
    p.sessions++;
    if (r.join && (!p.firstJoin || r.join < p.firstJoin)) p.firstJoin = r.join;
    if (r.leave && (!p.lastLeave || r.leave > p.lastLeave)) p.lastLeave = r.leave;
    if (r.country && r.country !== "Unknown") p.country = r.country;
  });
  const perPerson = Array.from(byEmail.values());
  const attendees = perPerson.filter((p) => p.attended);

  // Show-up rate
  const registered = perPerson.filter((p) => p.registrationTime);
  const registeredAttended = registered.filter((p) => p.attended).length;
  const showupRate = registered.length
    ? +((registeredAttended / registered.length) * 100).toFixed(1)
    : null;

  // Concurrent curve from join/leave (stepped every 2 min)
  const concurrentCurve = buildConcurrentCurve(rows, start, end, 2);
  const peak = concurrentCurve.reduce(
    (a, b) => (b.active > a.active ? b : a),
    { active: 0, min: 0 }
  );

  // Stayed-to-end (attendees with leave time within last 30 min)
  let stayedToEnd = 0;
  if (end) {
    const cutoff = new Date(end.getTime() - 30 * 60000);
    stayedToEnd = attendees.filter((p) => p.lastLeave && p.lastLeave >= cutoff).length;
  }

  // Engagement segments + lateness
  const segments = segmentByTime(attendees);
  const latenessRows = lateness(attendees, start);

  // Country counts
  const countryMap = new Map();
  attendees.forEach((p) => {
    const c = p.country || "Unknown";
    countryMap.set(c, (countryMap.get(c) || 0) + 1);
  });
  const countries = Array.from(countryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ---- Chat ----
  const isBot = (msg) =>
    /fireflies|notetaker|otter\.ai|meetgeek/i.test(msg.sender) ||
    /invited.*to record/i.test(msg.body) ||
    /view realtime notes/i.test(msg.body);

  const humanMessages = chat.filter((m) => !isBot(m));
  const botMessages = chat.length - humanMessages.length;
  const senderCounts = new Map();
  humanMessages.forEach((m) => {
    senderCounts.set(m.sender, (senderCounts.get(m.sender) || 0) + 1);
  });
  const topChatters = Array.from(senderCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Chat volume per 5 min relative to webinar start
  const chatPer5 = [];
  if (start) {
    const totalMin = end ? Math.round(minutesBetween(start, end)) : 240;
    for (let m = 0; m <= totalMin; m += 5) {
      const bucketStart = new Date(start.getTime() + m * 60000);
      const bucketEnd = new Date(start.getTime() + (m + 5) * 60000);
      let cnt = 0;
      humanMessages.forEach((msg) => {
        // Build full date by combining webinar date with HH:MM:SS
        const [h, mi, s] = msg.time.split(":").map(Number);
        const msgDate = new Date(start);
        msgDate.setHours(h, mi, s, 0);
        if (end && msgDate < start && end.toDateString() !== start.toDateString()) {
          msgDate.setDate(msgDate.getDate() + 1);
        }
        if (msgDate >= bucketStart && msgDate < bucketEnd) cnt++;
      });
      chatPer5.push({ min: m, messages: cnt, clock: clockOf(start, m) });
    }
  }

  // Topic classification (with original message indexes for drilldown)
  const topicMatches = classifyMessages(humanMessages);
  const chatTopics = Object.entries(KEYWORD_TOPICS).map(([k, def]) => ({
    key: k,
    label: def.label,
    count: topicMatches[k].length,
    messageIndexes: topicMatches[k],
  })).sort((a, b) => b.count - a.count);

  // ---- Live-count from XLSX, merged with chat curve where possible ----
  // Convert each row's time to "minutes since start"
  const liveCount = (attendanceCount || []).map((r) => {
    let minOffset = null;
    if (start && r.time) {
      const [h, mi, s] = r.time.split(":").map(Number);
      const t = new Date(start);
      t.setHours(h, mi, s || 0, 0);
      minOffset = Math.round(minutesBetween(start, t));
    }
    return { time: r.time, count: r.count, min: minOffset };
  });

  return {
    userName,
    meta,
    headline: {
      registrants: meta.registrants || registered.length,
      uniqueViewers: meta.uniqueViewers || attendees.length,
      attendedUnique: attendees.length,
      showupRate,
      peakConcurrent: peak.active,
      peakMinute: peak.min,
      avgConcurrent: Math.round(
        concurrentCurve.reduce((a, b) => a + b.active, 0) /
          (concurrentCurve.length || 1)
      ),
      stayedToEnd,
      stayedToEndPct: attendees.length
        ? +((stayedToEnd / attendees.length) * 100).toFixed(1)
        : 0,
      durationMin: meta.durationMin,
      ghostCount: registered.length - registeredAttended,
    },
    concurrentCurve,
    liveCount,
    segments,
    lateness: latenessRows,
    countries,
    chat: {
      total: chat.length,
      humanMessages: humanMessages.length,
      botMessages,
      uniqueChatters: senderCounts.size,
      topChatters,
      chatPer5,
      topics: chatTopics,
      // Keep human messages for drill-down (we'll index into this from topics)
      messages: humanMessages,
    },
  };
}

// =====================================================================
// COMPARISON across users
// =====================================================================

export function buildComparison(userInsights) {
  if (userInsights.length < 2) return null;

  const headlineKeys = [
    ["registrants", "Registrants", false],
    ["uniqueViewers", "Unique viewers", false],
    ["showupRate", "Show-up rate (%)", false],
    ["peakConcurrent", "Peak concurrent", false],
    ["avgConcurrent", "Avg concurrent", false],
    ["stayedToEndPct", "Stayed to close (%)", false],
    ["durationMin", "Duration (min)", false],
  ];

  const metricRows = headlineKeys.map(([k, label]) => ({
    metric: label,
    key: k,
    values: userInsights.map((u) => u.headline[k] ?? 0),
  }));

  // Aligned chat-topic comparison
  const allTopicKeys = Array.from(
    new Set(
      userInsights.flatMap((u) => u.chat.topics.map((t) => t.key))
    )
  );
  const topicCmp = allTopicKeys.map((k) => {
    const labels = userInsights.map((u) => u.chat.topics.find((t) => t.key === k));
    return {
      key: k,
      label: (labels.find(Boolean) || {}).label || k,
      values: userInsights.map((u, i) => {
        const t = u.chat.topics.find((tt) => tt.key === k);
        return t ? t.count : 0;
      }),
    };
  }).sort((a, b) => b.values.reduce((x, y) => x + y, 0) - a.values.reduce((x, y) => x + y, 0));

  // Aligned concurrent curve (use the first user's start as t=0; align by minute offset)
  const maxMin = Math.max(...userInsights.map((u) => u.concurrentCurve.at(-1)?.min || 0));
  const stepMap = {};
  for (let m = 0; m <= maxMin; m += 2) stepMap[m] = { min: m };
  userInsights.forEach((u, idx) => {
    u.concurrentCurve.forEach((p) => {
      if (stepMap[p.min] !== undefined) {
        stepMap[p.min][`u${idx}`] = p.active;
      }
    });
  });
  const alignedCurves = Object.values(stepMap);

  return {
    metricRows,
    topicCmp,
    alignedCurves,
    userNames: userInsights.map((u) => u.userName),
  };
}


// =====================================================================
// sanitizeInsights — ensures meta.start and meta.end are always real
// Date objects, not strings or null. Call this on every ins object
// after it's received from the server OR built fresh from parsers.
//
// WHY: When data round-trips through JSON (server save/load), Date
// objects become ISO strings like "2026-04-26T05:15:00.000Z".
// Chart components call start.getTime() which crashes on strings.
// This function converts strings back to Dates safely.
// =====================================================================

export function sanitizeInsights(ins) {
  if (!ins) return ins;

  const meta = { ...ins.meta };

  // Convert start to a real Date if it's a string or invalid
  if (meta.start && !(meta.start instanceof Date)) {
    const d = new Date(meta.start);
    meta.start = isNaN(d.getTime()) ? null : d;
  }

  // Convert end to a real Date if it's a string or invalid
  if (meta.end && !(meta.end instanceof Date)) {
    const d = new Date(meta.end);
    meta.end = isNaN(d.getTime()) ? null : d;
  }

  // If end is missing but we have start + durationMin, reconstruct it
  if (!meta.end && meta.start && meta.durationMin) {
    meta.end = new Date(meta.start.getTime() + meta.durationMin * 60000);
  }

  return { ...ins, meta };
}