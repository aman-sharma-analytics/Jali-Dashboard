import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, AreaChart, Area, ReferenceLine, Cell, ComposedChart, Legend,
  PieChart, Pie, FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  MessageSquare, Award, Users, FileText, Hash, ChevronRight,
  TrendingUp, TrendingDown, Clock, Zap, Globe, Star, BarChart2,
  Activity, AlertTriangle, Target, Layers,
} from "lucide-react";

import { Panel, Stat, TT, Modal, Rec } from "./UI.jsx";
import { fmtNum, fmtPct, fmtMin, minToClock } from "../lib/format.js";

// ─────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (from dashboard.jsx palette mapped to CSS vars)
// ─────────────────────────────────────────────────────────────────────
const C = {
  bg:     "var(--bg)",
  s1:     "var(--panel)",
  s2:     "var(--panel-hi)",
  s3:     "var(--panel-card)",
  bdr:    "var(--border)",
  bdrHi:  "var(--border-hi)",
  txt:    "var(--text)",
  muted:  "var(--text-dim)",
  accent: "#E8294A",
  red:    "#ef4444",
  yellow: "#F5A623",
  green:  "#2ECC71",
  blue:   "#4D9FFF",
  purple: "#A78BFA",
  cyan:   "#06b6d4",
};

const sevColors = {
  critical: C.red, high: C.accent, moderate: C.yellow,
  medium: C.yellow, healthy: C.green, growth: C.green, low: C.blue,
};

const overviewKpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 10,
};

const ISSUE_DEFS = [
  { key: "audio", name: "Audio not clear", color: C.red, patterns: [/\baudio\b/i, /\bsound\b/i, /\bvoice\b/i, /\bmic\b/i, /\bnot audible\b/i, /\bcan't hear\b/i, /\bcannot hear\b/i, /\bcant hear\b/i, /\bnot clear\b/i] },
  { key: "payment", name: "Payment link not working", color: C.accent, patterns: [/\bpayment\s+link\b/i, /\bpay(ment)?\b.*\blink\b/i, /\blink\b.*\bnot working\b/i, /\bnot working\b.*\blink\b/i, /\bunable\b.*\bpay\b/i, /\bcan't\b.*\bpay\b/i, /\bcannot\b.*\bpay\b/i, /\berror\b.*\bpay/i] },
  { key: "video", name: "Video issue", color: C.blue, patterns: [/\bvideo\b/i, /\bscreen\b/i, /\bnot visible\b/i, /\bcan't see\b/i, /\bcannot see\b/i, /\bcant see\b/i, /\blag/i, /\bbuffer/i, /\bfreez/i, /\bstuck\b/i] },
  { key: "certificate", name: "Certificate issue", color: C.green, patterns: [/\bcertificate?s?\b/i, /\bcertif/i, /\bcertificate\b.*\bnot\b/i, /\bnot\b.*\bcertificate\b/i] },
  { key: "recording", name: "Recording issue", color: C.purple, patterns: [/\brecording\b/i, /\brecorded\b/i, /\breplay\b/i, /\bsend\b.*\bvideo\b/i] },
  { key: "price", name: "Price confusion", color: C.yellow, patterns: [/\bprice\b/i, /\bfees?\b/i, /\bcost\b/i, /\bpaid\b/i, /\bhow much\b/i, /\bdiscount\b/i, /\bcoupon\b/i] },
  { key: "access", name: "Access / joining issue", color: C.cyan, patterns: [/\bjoin\b/i, /\blogin\b/i, /\bregister\b/i, /\baccess\b/i, /\bnot able\b/i, /\bunable\b/i] },
];

// ─────────────────────────────────────────────────────────────────────
// SHARED SMALL COMPONENTS (dashboard.jsx style inside webinar theme)
// ─────────────────────────────────────────────────────────────────────

const Tag = ({ sev }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 9,
    fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.5,
    background: `${sevColors[sev]}18`, color: sevColors[sev], textTransform: "uppercase",
  }}>{sev}</span>
);

const KPI = ({ label, value, sub, color }) => (
  <div style={{
    background: C.s1, border: `1px solid ${C.bdr}`, padding: "14px 16px",
    position: "relative", overflow: "hidden", minWidth: 0,
  }}>
    <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: color }} />
    <div style={{ fontSize: 9.5, fontFamily: "JetBrains Mono,monospace", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: C.muted, marginBottom: 3 }}>{label}</div>
    <div className="serif" style={{ fontSize: 24, color: C.txt, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: "JetBrains Mono,monospace" }}>{sub}</div>}
  </div>
);

const ChartInfoContent = ({ info }) => {
  if (!info) return null;
  const sections = [
    ["What this chart is for", info.purpose],
    ["How to read it", info.read],
    ["What to look for", info.lookFor],
  ].filter(([, body]) => body);

  return (
    <div style={{ padding: 20 }}>
      {sections.map(([heading, body]) => (
        <section key={heading} style={{ marginBottom: 18 }}>
          <div className="mono" style={{ color: "var(--accent)", fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6 }}>
            {heading}
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "var(--text-dim)" }}>{body}</p>
        </section>
      ))}
    </div>
  );
};

const Card = ({ title, dotColor, children, style = {}, info }) => {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="ppt-chart" data-ppt-title={title || "Chart"} style={{ background: C.s1, border: `1px solid ${C.bdr}`, padding: 20, ...style }}>
      {title && (
        <div style={{
          fontSize: 10, fontFamily: "JetBrains Mono,monospace", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: 1.2, color: C.muted, marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor || C.accent, flexShrink: 0 }} />
            <span>{title}</span>
          </span>
          {info && (
            <button
              type="button"
              className="chart-info-btn"
              aria-label={`About ${title}`}
              title="What is this chart?"
              onClick={() => setShowInfo(true)}
            >
              i
            </button>
          )}
        </div>
      )}
      {children}
      {showInfo && (
        <Modal onClose={() => setShowInfo(false)} title={title} subtitle="What it shows and how to read it">
          <ChartInfoContent info={info} />
        </Modal>
      )}
    </div>
  );
};

const HBar = ({ label, value, max, color }) => (
  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 48px", alignItems: "center", gap: 10, marginBottom: 5 }}>
    <div style={{ fontSize: 11, color: C.muted, textAlign: "right", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
    <div style={{ height: 20, background: C.s3, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
    </div>
    <div style={{ fontSize: 11, fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: C.txt }}>{fmtNum(value)}</div>
  </div>
);

const messageMinute = (start, msg, end = null) => {
  const safeStart = start instanceof Date ? start : (start ? new Date(start) : null);
  const safeEnd = end instanceof Date ? end : (end ? new Date(end) : null);
  start = safeStart; end = safeEnd;
  if (!start || !msg?.time) return null;
  const [h, mi, s] = msg.time.split(":").map(Number);
  if ([h, mi].some(Number.isNaN)) return null;
  const t = new Date(start);
  t.setHours(h, mi, s || 0, 0);
  if (end && t < start && end.toDateString() !== start.toDateString()) {
    t.setDate(t.getDate() + 1);
  }
  const min = Math.round((t.getTime() - start.getTime()) / 60000);
  return min >= 0 ? min : null;
};

const topicMessages = (topic, messages) =>
  (topic?.messageIndexes || []).map((idx) => messages[idx]).filter(Boolean);

const cleanExamples = (items, limit = 3) =>
  items
    .filter((m) => (m?.body || "").trim().length > 6)
    .slice(0, limit)
    .map((m) => ({
      time: m.time,
      sender: m.sender || "Attendee",
      body: (m.body || "").trim().slice(0, 150),
    }));

const buildTopicTrend = (topic, messages, start, step = 10, end = null) => {
  const selected = topicMessages(topic, messages);
  const buckets = new Map();
  selected.forEach((msg) => {
    const min = messageMinute(start, msg, end);
    if (min == null) return;
    const bucket = Math.floor(min / step) * step;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  });
  const maxMin = Math.max(0, ...Array.from(buckets.keys()));
  const rows = [];
  for (let min = 0; min <= maxMin; min += step) {
    rows.push({
      min,
      clock: start ? minToClock(start, min) : `${min}m`,
      count: buckets.get(min) || 0,
    });
  }
  return rows.length ? rows : [{ min: 0, clock: start ? minToClock(start, 0) : "0m", count: 0 }];
};

const TopicExampleTooltip = ({ active, payload, messages }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const examples = d.examples || cleanExamples(topicMessages(d.topic, messages), 3);
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border-hi)", padding: 12, width: 320, boxShadow: "0 12px 30px rgba(0,0,0,0.35)" }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>
        {d.label}
      </div>
      <div className="serif" style={{ fontSize: 18, color: "var(--text)", marginBottom: 8 }}>
        {fmtNum(d.value)} messages
      </div>
      {examples.length > 0 ? examples.map((msg, i) => (
        <div key={i} style={{ borderTop: i ? "1px solid var(--rule)" : "none", paddingTop: i ? 8 : 0, marginTop: i ? 8 : 0 }}>
          <div className="mono" style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 3 }}>
            {msg.time} - {msg.sender}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.45 }}>"{msg.body}"</div>
        </div>
      )) : (
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>No example comments available.</div>
      )}
    </div>
  );
};

const ChartTT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.s2, border: `1px solid ${C.bdrHi}`, padding: "8px 12px", fontSize: 11, color: C.txt, fontFamily: "JetBrains Mono,monospace" }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", color: p.color || C.txt, gap: 16, padding: "2px 0" }}>
          <span>{p.name}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{typeof p.value === "number" ? fmtNum(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const AttendanceTT = ({ active, payload, label, labelFormatter }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div
      className="mono"
      style={{
        background: "#060810",
        border: "1px solid var(--border-hi)",
        padding: "10px 12px",
        fontSize: 11,
        minWidth: 210,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ color: C.muted, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>
        {labelFormatter ? labelFormatter(label) : label}
      </div>
      {row.issueName && (
        <div style={{ color: C.txt, borderLeft: `2px solid ${row.issueColor || C.red}`, paddingLeft: 8, marginBottom: 6, lineHeight: 1.35 }}>
          <div style={{ color: row.issueColor || C.red, fontWeight: 700 }}>{row.issueName}</div>
          <div style={{ color: C.muted, fontSize: 10 }}>{fmtNum(row.issueCount || 0)} relevant issue messages</div>
        </div>
      )}
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: p.color || C.txt,
            gap: 16,
            padding: "2px 0",
          }}
        >
          <span>{p.name}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{typeof p.value === "number" ? fmtNum(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const IssueDot = ({ cx, cy, payload }) => {
  if (cx == null || cy == null) return null;
  const color = payload?.issueColor || C.red;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={color} stroke="#060810" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill="#fff" fillOpacity={0.95} />
    </g>
  );
};

const IssueLabel = ({ x, y, value, payload }) => {
  if (x == null || y == null || !value) return null;
  const color = payload?.issueColor || C.red;
  return (
    <text
      x={x}
      y={y - 12}
      textAnchor="middle"
      fill={color}
      fontSize={9.5}
      fontFamily="JetBrains Mono,monospace"
      fontWeight={700}
    >
      {value}
    </text>
  );
};

const RecoPanel = ({ items }) => (
  <div style={{
    background: "var(--rec-bg,#0B1220)", border: "1px solid var(--rec-border,#1A2E50)",
    borderLeft: "3px solid var(--blue)", padding: "14px 18px", marginTop: 16,
  }}>
    <div className="mono" style={{ color: "var(--blue)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
      ⬡ RECOMMENDATION
    </div>
    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--rec-text,#7EB8F7)", marginBottom: 3, fontFamily: "Plus Jakarta Sans,sans-serif" }}>
          {item}
        </li>
      ))}
    </ul>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// TOPIC MODAL (existing)
// ─────────────────────────────────────────────────────────────────────

function TopicMessagesModal({ topic, messages, onClose }) {
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState("all");
  const subset = useMemo(() => topic.messageIndexes.map((i) => messages[i]).filter(Boolean), [topic, messages]);
  const publicMessages = useMemo(() => subset.filter((m) => /everyone|public/i.test(m.recipient || "")), [subset]);
  const userMessages = useMemo(() => subset.filter((m) => !/everyone|public/i.test(m.recipient || "")), [subset]);
  const filtered = useMemo(() => {
    const base = audience === "public" ? publicMessages : audience === "user" ? userMessages : subset;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(m => m.body.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q));
  }, [audience, publicMessages, search, subset, userMessages]);

  return (
    <Modal onClose={onClose} title={`${topic.label}`} subtitle={`${fmtNum(topic.count)} messages mentioned this · click any to see context`}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            { id: "all", label: "All", count: subset.length },
            { id: "user", label: "Public", count: userMessages.length },
            { id: "public", label: "Admin", count: publicMessages.length },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={audience === item.id ? "btn btn-primary" : "btn"}
              onClick={() => setAudience(item.id)}
              style={{ padding: "7px 12px", fontSize: 10 }}
            >
              {item.label} · {fmtNum(item.count)}
            </button>
          ))}
        </div>
        <input className="input" placeholder="Search within these messages..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="mono text-faint" style={{ fontSize: 10, marginTop: 6, letterSpacing: 1 }}>{fmtNum(filtered.length)} of {fmtNum(topic.count)} matched</div>
      </div>
      <div style={{ maxHeight: 480, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>No messages match.</div>
        ) : (
          filtered.map((msg, i) => (
            <div key={i} style={{ padding: "12px 20px", borderBottom: "1px solid var(--rule)", fontSize: 13 }}>
              <div className="flex" style={{ gap: 12, marginBottom: 4, alignItems: "baseline" }}>
                <span className="mono text-faint" style={{ fontSize: 10 }}>{msg.time}</span>
                <span className="serif" style={{ fontSize: 13, color: "var(--text)" }}>{msg.sender}</span>
                <span className="mono text-faint" style={{ fontSize: 10 }}>→ {msg.recipient}</span>
              </div>
              <div style={{ color: "var(--text)", lineHeight: 1.5 }}>{msg.body}</div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PAGE 1 — OVERVIEW (KPIs + headline stats)
// ─────────────────────────────────────────────────────────────────────

const PageOverview = ({ insights }) => {
  const h = insights.headline;
  const engagedPct = insights.segments
    ? insights.segments.filter(s => ["Engaged", "Committed", "Super-fan"].includes(s.segment)).reduce((a, s) => a + s.pct, 0)
    : null;
  const chatRate = h.uniqueViewers > 0
    ? +((insights.chat.uniqueChatters / h.uniqueViewers) * 100).toFixed(1)
    : null;
  const ghostRate = h.registrants > 0
    ? +((h.ghostCount / h.registrants) * 100).toFixed(1)
    : null;
  const intentCount = insights.chat.topics.filter(t => ["pricing", "payment_link", "enrollment"].includes(t.key)).reduce((a, t) => a + t.count, 0);
  const frictionTopic = insights.chat.topics.find(t => t.key === "audio_video");

  // Funnel data
  const funnelData = useMemo(() => {
    const items = [
      { label: "Registrants", v: h.registrants, c: C.blue },
      { label: "Unique Viewers", v: h.uniqueViewers, c: C.purple },
      { label: "Peak Concurrent", v: h.peakConcurrent, c: C.accent },
      { label: "Stayed to End", v: h.stayedToEnd, c: C.green },
    ].filter(x => x.v > 0);
    return items;
  }, [h]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPI row 1 */}
      <div style={overviewKpiGrid}>
        <KPI label="Registrants" value={fmtNum(h.registrants)} sub={insights.meta.topic} color={C.blue} />
        <KPI label="Unique Viewers" value={fmtNum(h.uniqueViewers)} sub={h.showupRate != null ? `${fmtPct(h.showupRate)} show-up` : "viewers"} color={C.purple} />
        <KPI label="Peak Concurrent" value={fmtNum(h.peakConcurrent)} sub={`T+${h.peakMinute}m`} color={C.green} />
        <KPI label="Stayed to End" value={fmtNum(h.stayedToEnd)} sub={`${fmtPct(h.stayedToEndPct)} of viewers`} color={C.accent} />
        <KPI label="No-shows" value={ghostRate != null ? fmtPct(ghostRate) : "—"} sub={h.ghostCount != null ? `${fmtNum(h.ghostCount)} didn't join` : ""} color={C.red} />
        <KPI label="Chat Participants" value={chatRate != null ? fmtPct(chatRate) : "—"} sub={`${fmtNum(insights.chat.uniqueChatters)} chatters`} color={C.cyan} />
        <KPI label="Avg Concurrent" value={fmtNum(h.avgConcurrent)} sub="mean live" color={C.yellow} />
        <KPI label="Duration" value={h.durationMin ? `${h.durationMin}m` : "—"} sub="scheduled" color={C.blue} />
        <KPI label="Total Chat Msgs" value={fmtNum(insights.chat.humanMessages)} sub="human messages" color={C.purple} />
        <KPI label="Msgs / Viewer" value={h.uniqueViewers > 0 ? (insights.chat.humanMessages / h.uniqueViewers).toFixed(1) : "—"} sub="chat density" color={C.blue} />
        <KPI label="Bot Messages" value={fmtNum(insights.chat.botMessages)} sub="filtered out" color={C.muted} />
        <KPI label="Purchase Intent" value={fmtNum(intentCount)} sub="pricing + payment + enrollment msgs" color={C.green} />
        <KPI label="AV Friction" value={fmtNum(frictionTopic?.count ?? 0)} sub={`${frictionTopic ? ((frictionTopic.count / insights.chat.humanMessages) * 100).toFixed(1) : 0}% of chat`} color={frictionTopic?.count > 0 ? C.red : C.green} />
        <KPI label="Deeply Engaged" value={engagedPct != null ? fmtPct(engagedPct) : "—"} sub="stayed 30 min+" color={C.purple} />
      </div>

      {/* Funnel + Top countries side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card
          title="Registration → Retention Funnel"
          dotColor={C.red}
          info={{
            purpose: "This funnel shows how the audience narrows from registration to actual attendance and end-session retention.",
            read: "Each stage shows a count and its share compared with the previous stage. Smaller lower stages mean more people dropped before reaching the end.",
            lookFor: "Big losses from registered to joined point to reminder or access problems. Big losses before the end point to content or pacing problems.",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {funnelData.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 120, fontSize: 10, color: C.muted, textAlign: "right", flexShrink: 0 }}>{f.label}</div>
                <div style={{ flex: 1, height: 22, background: C.s3, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(f.v / (h.registrants || 1)) * 100}%`, background: f.c, borderRadius: 5 }} />
                </div>
                <div style={{ width: 55, fontSize: 11, fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: f.c, flexShrink: 0 }}>{fmtNum(f.v)}</div>
                <div style={{ width: 36, fontSize: 9, fontFamily: "JetBrains Mono,monospace", color: C.muted, flexShrink: 0 }}>{h.registrants > 0 ? `${((f.v / h.registrants) * 100).toFixed(0)}%` : ""}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Top Countries"
          dotColor={C.cyan}
          info={{
            purpose: "This compact chart shows the largest country sources for the audience.",
            read: "Each horizontal bar is a country, scaled against the top country. The number is the viewer count.",
            lookFor: "Use the leading countries to tune timezone, language, examples, and follow-up timing.",
          }}
        >
          {insights.countries.slice(0, 8).map((c, i) => {
            const total = insights.countries.reduce((a, x) => a + x.count, 0);
            const colors = [C.accent, C.yellow, C.blue, C.green, C.purple, C.cyan, C.muted, C.bdrHi];
            return <HBar key={i} label={c.name} value={c.count} max={insights.countries[0].count} color={colors[i] || C.muted} />;
          })}
        </Card>
      </div>

      <RecoPanel items={[
        h.showupRate != null && h.showupRate < 0.5 ? `Show-up rate of ${fmtPct(h.showupRate)} is below 50% — send a 15-min-before reminder on WhatsApp in addition to email.` : `Strong show-up rate of ${h.showupRate != null ? fmtPct(h.showupRate) : "N/A"} — document your reminder sequence and replicate it.`,
        `${fmtNum(h.stayedToEnd)} viewers (${fmtPct(h.stayedToEndPct)}) made it to close — these are your highest-intent leads. Export and follow up within 12 hours.`,
        insights.countries[0] ? `${insights.countries[0].name} is your #1 audience country — time your follow-up emails for their timezone and localise content accordingly.` : "Track geographic data in future webinars to localise follow-ups.",
      ]} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// PAGE 2 — ATTENDANCE CURVE (existing LiveCountVsChat + new phase table)
// ─────────────────────────────────────────────────────────────────────

const PageAttendance = ({ insights }) => {
  const rawStart = insights.meta.start;
  const start = rawStart instanceof Date ? rawStart : (rawStart ? new Date(rawStart) : null);
  const [showIssues, setShowIssues] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState("audio");
  const clockRange = (fromMin, toMin) => `${minToClock(start, fromMin)} - ${minToClock(start, toMin)}`;
  const minuteAtClock = (hour24, minute, fallback) => {
    if (!start) return fallback;
    const t = new Date(start);
    t.setHours(hour24, minute, 0, 0);
    return Math.round((t.getTime() - start.getTime()) / 60000);
  };
  const sessionMarkers = [
    { min: 15, label: "Introduction", color: "var(--green)" },
    { min: 30, label: "Teaching", color: "var(--blue)" },
    { min: 90, label: "Testimonial", color: "var(--purple)" },
    { min: 120, label: "Sales pitch", color: "var(--accent)" },
    { min: minuteAtClock(13, 38, 173), label: "Price reveal", color: "var(--amber)" },
    { min: minuteAtClock(14, 18, 213), label: "Certificate Link", color: "var(--green)" },
  ].filter((m) => m.min >= 0);

  const curveData = useMemo(() => {
    const map = new Map();
    insights.concurrentCurve.forEach((p) => { map.set(p.min, { min: p.min, computed: p.active }); });
    insights.liveCount.forEach((p) => {
      if (p.min == null) return;
      const snapped = Math.round(p.min / 2) * 2;
      const existing = map.get(snapped) || { min: snapped };
      existing.recorded = p.count;
      map.set(snapped, existing);
    });
    insights.chat.chatPer5.forEach((p) => {
      const existing = map.get(p.min) || { min: p.min };
      existing.messages = p.messages;
      map.set(p.min, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.min - b.min);
  }, [insights]);

  const issueBuckets = useMemo(() => {
    const buckets = new Map();
    if (start) {
      insights.chat.messages.forEach((msg) => {
        const body = msg.body || "";
        const matched = ISSUE_DEFS.filter((def) => def.patterns.some((re) => re.test(body)));
        if (!matched.length) return;
        const [h, mi, s] = msg.time.split(":").map(Number);
        const msgDate = new Date(start);
        msgDate.setHours(h, mi, s || 0, 0);
        const min = Math.max(0, Math.round((msgDate.getTime() - start.getTime()) / 60000));
        const bucket = Math.floor(min / 5) * 5;
        const bucketData = buckets.get(bucket) || { min: bucket, total: 0, byName: new Map() };
        bucketData.total += 1;
        matched.forEach((def) => {
          const item = bucketData.byName.get(def.key) || { key: def.key, name: def.name, count: 0, color: def.color };
          item.count += 1;
          bucketData.byName.set(def.key, item);
        });
        buckets.set(bucket, bucketData);
      });
    }
    return buckets;
  }, [insights.chat.messages, start]);

  const issueSummary = useMemo(() => {
    const counts = new Map(ISSUE_DEFS.map((def) => [def.key, 0]));
    issueBuckets.forEach((bucket) => {
      bucket.byName.forEach((item, key) => {
        counts.set(key, (counts.get(key) || 0) + item.count);
      });
    });
    return ISSUE_DEFS.map((def) => ({ ...def, count: counts.get(def.key) || 0 }));
  }, [issueBuckets]);
  const selectedIssueDef = issueSummary.find((issue) => issue.key === selectedIssue) || issueSummary[0];

  const decoratedCurveData = useMemo(() => {
    const computedPoints = curveData.filter((point) => point.computed != null);
    const nearestComputed = (min) => {
      const nearest = computedPoints.reduce((best, point) => {
        if (!best) return point;
        return Math.abs(point.min - min) < Math.abs(best.min - min) ? point : best;
      }, null);
      return nearest?.computed ?? null;
    };
    return curveData.map((point) => {
      const bucket = issueBuckets.get(point.min);
      const selected = bucket?.byName.get(selectedIssue);
      const showIssueDot = Boolean(selected);
      const issueDotY = showIssueDot ? (point.computed ?? nearestComputed(point.min)) : null;
      return {
        ...point,
        issueMessages: selected?.count || 0,
        issueDotY,
        issueCount: selected?.count || 0,
        issueName: showIssueDot ? selected.name : null,
        issueColor: selected?.color,
      };
    });
  }, [curveData, issueBuckets, selectedIssue]);

  const chartData = useMemo(() => {
    return decoratedCurveData.map((point) => ({
      ...point,
      messages: showIssues ? point.issueMessages : point.messages,
      issueDotY: showIssues ? point.issueDotY : null,
      issueName: showIssues ? point.issueName : null,
    }));
  }, [decoratedCurveData, showIssues]);

  const chartMaxMin = useMemo(() => {
    const dataMax = chartData.reduce((max, point) => Math.max(max, point.min || 0), 0);
    const markerMax = sessionMarkers.reduce((max, marker) => Math.max(max, marker.min || 0), 0);
    return Math.max(dataMax, markerMax, 220);
  }, [chartData, sessionMarkers]);

  // Phase-wise drop-off from curve data
  const phases = useMemo(() => {
    const pts = curveData.filter(d => d.computed != null);
    if (pts.length < 2) return [];
    const windows = [
      { name: "Ramp-up", minStart: 0, minEnd: 20 },
      { name: "Opening", minStart: 20, minEnd: 45 },
      { name: "Mid Teaching", minStart: 45, minEnd: 90 },
      { name: "Late Teaching", minStart: 90, minEnd: 120 },
      { name: "Closing / Pitch", minStart: 120, minEnd: 160 },
      { name: "Final", minStart: 160, minEnd: 9999 },
    ];
    return windows.map(w => {
      const wPts = pts.filter(p => p.min >= w.minStart && p.min < w.minEnd);
      if (wPts.length < 1) return null;
      const s = wPts[0].computed;
      const e = wPts[wPts.length - 1].computed;
      const drop = s - e;
      const pct = s > 0 ? (drop / s * 100).toFixed(1) : 0;
      const isGrowth = e > s;
      const sev = isGrowth ? "growth" : drop / s > 0.3 ? "critical" : drop / s > 0.15 ? "high" : drop / s > 0.05 ? "moderate" : "healthy";
      const finalMin = w.minEnd === 9999 ? pts.at(-1).min : w.minEnd;
      return { ...w, s, e, drop: isGrowth ? e - s : drop, pct, isGrowth, sev, time: clockRange(w.minStart, finalMin) };
    }).filter(Boolean);
  }, [curveData, start]);

  // Segment summary table
  const tableData = useMemo(() => {
    const maxMin = Math.max(...curveData.map((d) => d.min), 150);
    const segments = [
      { name: "Opening", minStart: 0, minEnd: 15 },
      { name: "Early", minStart: 15, minEnd: 45 },
      { name: "Mid", minStart: 45, minEnd: 90 },
      { name: "Late", minStart: 90, minEnd: 150 },
      { name: "Closing", minStart: 150, minEnd: 9999 },
    ];
    return segments.map(seg => {
      const pts = curveData.filter(d => d.min >= seg.minStart && d.min < seg.minEnd);
      const avgComputed = pts.length ? Math.round(pts.reduce((a, d) => a + (d.computed || 0), 0) / pts.length) : 0;
      const avgRecorded = pts.filter(d => d.recorded != null).length
        ? Math.round(pts.filter(d => d.recorded != null).reduce((a, d) => a + (d.recorded || 0), 0) / pts.filter(d => d.recorded != null).length)
        : null;
      const totalChat = pts.reduce((a, d) => a + (d.messages || 0), 0);
      const peakPt = pts.reduce((a, b) => (b.computed || 0) > (a.computed || 0) ? b : a, { computed: 0, min: 0 });
      const endMin = seg.minEnd === 9999 ? maxMin : seg.minEnd;
      return { ...seg, label: `${seg.name} (${clockRange(seg.minStart, endMin)})`, avgComputed, avgRecorded, totalChat, peakMin: peakPt.min, peakClock: minToClock(start, peakPt.min), peakCount: peakPt.computed };
    }).filter(s => s.avgComputed > 0 || s.avgRecorded != null);
  }, [curveData, start]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Full Curve */}
      <Panel
        title="Live attendance vs computed concurrent vs chat volume"
        accent="01 / THE FULL CURVE"
        action={
          <button
            type="button"
            className={showIssues ? "btn btn-primary" : "btn"}
            onClick={() => setShowIssues((v) => !v)}
            style={{ padding: "7px 12px", fontSize: 10 }}
          >
            Participant issues
          </button>
        }
        info={{
          purpose: "This chart combines audience size and interaction over time so you can see when people joined, left, or started talking.",
          read: "Read left to right by webinar minute. Blue shows concurrent viewers from Zoom join/leave data, red shows the host-recorded live count, and amber/red bars show chat or the selected issue volume.",
          lookFor: "Sharp line drops show retention problems. In issue mode, use the slicer below the chart to isolate audio, video, payment, certificate, recording, price, or access problems. The price reveal and certificate link lines mark fixed session events.",
        }}
        subtitle={showIssues ? `Bars and dots: ${selectedIssueDef?.name || "selected issue"} messages per 5 min · Line (blue): computed concurrent · Line (red): host-recorded live count` : "Bars: chat messages per 5 min · Line (blue): computed concurrent · Line (red): host-recorded live count"}
      >
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 58, right: 16, left: 0, bottom: 30 }}>
            <CartesianGrid stroke="var(--rule)" vertical={false} />
            <XAxis type="number" dataKey="min" domain={[0, chartMaxMin]} stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => minToClock(start, v)} ticks={[0, 30, 60, 90, 120, 150, 180, 210]} />
            <YAxis yAxisId="left" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
            <YAxis yAxisId="right" orientation="right" stroke="var(--amber)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
            <Tooltip content={<AttendanceTT labelFormatter={(v) => minToClock(start, v)} />} />
            <Legend wrapperStyle={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, paddingTop: 10 }} />
            {sessionMarkers.map((marker) => (
              <ReferenceLine
                key={marker.label}
                yAxisId="left"
                x={marker.min}
                stroke={marker.color}
                strokeDasharray="4 4"
                strokeOpacity={0.85}
                label={{
                  value: marker.label,
                  position: "top",
                  fill: marker.color,
                  fontSize: 10,
                  fontFamily: "JetBrains Mono,monospace",
                }}
              />
            ))}
            <Bar yAxisId="right" dataKey="messages" name={showIssues ? `${selectedIssueDef?.name || "Selected issue"} / 5min` : "Chat msgs / 5min"} fill={showIssues ? (selectedIssueDef?.color || C.red) : "var(--amber)"} fillOpacity={0.45} />
            {showIssues && (
              <Line
                yAxisId="left"
                type="linear"
                dataKey="issueDotY"
                name={selectedIssueDef?.name || "Selected issue"}
                stroke={selectedIssueDef?.color || C.red}
                strokeOpacity={0}
                strokeWidth={0}
                dot={<IssueDot />}
                activeDot={<IssueDot />}
                legendType="none"
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            <Line yAxisId="left" type="monotone" dataKey="computed" name="Computed concurrent" stroke="var(--blue)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            <Line yAxisId="left" type="monotone" dataKey="recorded" name="Live count (host)" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>

        {showIssues && (
          <div style={{ marginTop: 14, border: `1px solid ${C.bdr}`, background: C.s2, padding: 12 }}>
            <div className="mono" style={{ color: C.muted, fontSize: 9, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 10 }}>
              Select issue to show on chart
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {issueSummary.map((issue) => {
                const active = selectedIssue === issue.key;
                return (
                  <button
                    key={issue.key}
                    type="button"
                    onClick={() => setSelectedIssue(issue.key)}
                    style={{
                      border: `1px solid ${active ? issue.color : C.bdrHi}`,
                      background: active ? `${issue.color}22` : C.s1,
                      color: active ? issue.color : C.txt,
                      padding: "8px 10px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "JetBrains Mono,monospace",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      minHeight: 34,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: issue.color, flexShrink: 0 }} />
                    <span>{issue.name}</span>
                    <span style={{ color: active ? issue.color : C.muted, fontVariantNumeric: "tabular-nums" }}>{fmtNum(issue.count)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tableData.length > 0 && (
          <div style={{ marginTop: 20, overflowX: "auto" }}>
            <div className="mono text-faint" style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>SEGMENT SUMMARY TABLE</div>
            <table style={{ width: "100%", fontSize: 12, fontFamily: "JetBrains Mono,monospace", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", borderBottom: "1px solid var(--border-hi)" }}>
                  {["Segment", "Avg Computed", "Avg Recorded", "Chat Msgs", "Peak", "Peak @"].map(h => (
                    <th key={h} style={{ textAlign: h === "Segment" ? "left" : "right", padding: "8px 10px", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--rule)", fontVariantNumeric: "tabular-nums" }}>
                    <td style={{ padding: "10px 10px", fontFamily: "DM Serif Display,serif", fontSize: 13, color: "var(--text-dim)" }}>{row.label}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--blue)" }}>{fmtNum(row.avgComputed)}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--accent)" }}>{row.avgRecorded != null ? fmtNum(row.avgRecorded) : "—"}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--amber)" }}>{fmtNum(row.totalChat)}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--green)" }}>{fmtNum(row.peakCount)}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--text-faint)" }}>{row.peakClock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Phase-wise drop-off table */}
      {phases.length > 0 && (
        <Card
          title="Phase-wise Drop-off Analysis"
          dotColor={C.yellow}
          info={{
            purpose: "This table breaks the attendance curve into phases so you can locate where the audience dropped or grew.",
            read: "Each row compares the viewer count at the start and end of a phase. Change and drop percent show how severe the movement was.",
            lookFor: "High-severity drops identify the exact part of the session to review for pacing, pitch length, or technical issues.",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr>
                  {["Phase", "Time", "Start → End", "Change", "Drop %", "Severity"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 9, fontFamily: "JetBrains Mono,monospace", textTransform: "uppercase", letterSpacing: 0.8, color: C.muted, padding: "7px 10px", borderBottom: `1px solid ${C.bdr}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phases.map((p, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.bdr}` }}>
                    <td style={{ padding: "8px 10px", fontFamily: "DM Serif Display,serif", fontSize: 13, color: C.txt }}>{p.name}</td>
                    <td style={{ padding: "8px 10px", color: C.muted, fontSize: 10, fontFamily: "JetBrains Mono,monospace" }}>{p.time}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: C.txt }}>{fmtNum(p.s)} → {fmtNum(p.e)}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: p.isGrowth ? C.green : sevColors[p.sev] }}>{p.isGrowth ? `+${fmtNum(p.drop)}` : `-${fmtNum(p.drop)}`}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: p.isGrowth ? C.green : sevColors[p.sev] }}>{p.isGrowth ? "▲" : `${p.pct}%`}</td>
                    <td style={{ padding: "8px 10px" }}><Tag sev={p.sev} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RecoPanel items={[
        "Segments with sharp chat drops but stable viewer counts = lecture mode — plan Q&A breaks every 30 minutes.",
        "If the peak is in the first 15 minutes, your hook is working but your content arc may not sustain it — restructure the middle to re-peak at T+60–80m.",
        "A divergence >15% between recorded and computed concurrent indicates widespread rejoining (tech issues) — check platform stability.",
        "Aim for chat volume ≥ 20 messages/5-min window throughout — dips signal disengagement you can fix with polls.",
      ]} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// PAGE 3 — ENGAGEMENT (depth of viewing + arrival + join/leave timing)
// ─────────────────────────────────────────────────────────────────────

const PageEngagement = ({ insights }) => {
  const segColors = ["var(--border-hi)", "var(--amber)", "var(--text)", "var(--green)", "var(--accent)"];
  const lateColors = ["var(--green)", "var(--amber)", "var(--border-hi)", "var(--accent)", "var(--accent)"];
  const earlyBirds = insights.lateness ? insights.lateness.find(b => b.bucket === "On time") : null;
  const earlyPct = earlyBirds && insights.headline.uniqueViewers > 0
    ? ((earlyBirds.count / insights.headline.uniqueViewers) * 100).toFixed(0) : null;

  // duration distribution for summary badges
  const segBadges = useMemo(() => {
    if (!insights.segments) return [];
    return insights.segments.map((s, i) => ({ label: s.segment, n: fmtNum(s.count), p: fmtPct(s.pct), c: segColors[i] || "var(--border-hi)" }));
  }, [insights.segments]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "none" }}>
        {/* Depth of viewing */}
        <Panel
          title="Time-in-session segments"
          accent="02 / DEPTH OF VIEWING"
          subtitle="How long each unique viewer stayed."
          info={{
            purpose: "This chart groups viewers by how long they stayed in the webinar.",
            read: "Each horizontal bar is one viewing-depth segment. Longer bars mean more people landed in that segment, and the label at the end shows its share of viewers.",
            lookFor: "More Engaged, Committed, and Super-fan viewers means stronger content retention. A large Drive-by bar means many people left almost immediately.",
          }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={insights.segments} layout="vertical" margin={{ top: 10, right: 70, left: 10, bottom: 10 }}>
              <CartesianGrid stroke="var(--rule)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
              <YAxis type="category" dataKey="segment" stroke="var(--text)" tick={{ fontSize: 11, fontFamily: "DM Serif Display,serif" }} width={90} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="mono" style={{ background: "#060810", border: "1px solid var(--border-hi)", padding: 10, fontSize: 11, color: "var(--text)" }}>
                    <div className="serif" style={{ fontSize: 14, marginBottom: 4 }}>{d.segment}</div>
                    <div style={{ color: "var(--text-dim)" }}>{d.range}</div>
                    <div>{fmtNum(d.count)} people · {fmtPct(d.pct)}</div>
                  </div>
                );
              }} />
              <Bar dataKey="count" label={{ position: "right", fontSize: 10, fontFamily: "JetBrains Mono,monospace", fill: "var(--text-dim)", formatter: (v) => `${fmtPct(insights.segments.find(s => s.count === v)?.pct ?? 0)}` }}>
                {insights.segments.map((d, i) => <Cell key={i} fill={segColors[i] || "var(--border-hi)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Summary badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {segBadges.map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: s.c }}>{s.n}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{s.label} ({s.p})</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Arrival timing */}
        <Panel
          title="When did people join?"
          accent="ARRIVAL TIMING"
          subtitle="First-join time, relative to scheduled start."
          info={{
            purpose: "This chart shows when attendees first entered the webinar compared with the scheduled start time.",
            read: "Each bar is an arrival bucket, from on-time through very late. Taller bars mean more people first joined in that time window.",
            lookFor: "A strong on-time bar means reminders and access links worked. Large late bars suggest reminder timing, link delivery, or opening pacing needs attention.",
          }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={insights.lateness} margin={{ top: 10, right: 16, left: 10, bottom: 50 }}>
              <CartesianGrid stroke="var(--rule)" vertical={false} />
              <XAxis dataKey="bucket" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} angle={-25} textAnchor="end" interval={0} />
              <YAxis stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
              <Tooltip content={<TT formatter={(v) => fmtNum(v)} />} />
              <Bar dataKey="count">
                {insights.lateness.map((d, i) => <Cell key={i} fill={lateColors[i] || "var(--border-hi)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {earlyPct && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--green-soft)", border: "1px solid var(--green-dim)" }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--green)", letterSpacing: 1 }}>✓ {earlyPct}% on time</span>
              <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 10 }}>— strong pre-event communication</span>
            </div>
          )}
        </Panel>
      </div>

      {/* Join/Leave time horizontal bars */}
      {insights.lateness && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card
            title="First Join Time Distribution"
            dotColor={C.green}
            info={{
              purpose: "This compact chart repeats the arrival timing pattern as horizontal bars.",
              read: "Each bar is an arrival bucket. Longer bars mean more people first joined during that window.",
              lookFor: "A wide on-time bar is healthy. Late-heavy distribution means reminders, link delivery, or webinar opening should be improved.",
            }}
          >
            {insights.lateness.map((j, i) => {
              const colors = [C.green, C.blue, C.purple, C.yellow, C.accent, C.red];
              return <HBar key={i} label={j.bucket} value={j.count} max={Math.max(...insights.lateness.map(x => x.count))} color={colors[i] || C.muted} />;
            })}
            <div style={{ marginTop: 10, fontSize: 11, color: C.muted, background: C.s3, padding: "8px 12px" }}>
              {earlyPct ? `${earlyPct}% of attendees arrived on time — first 30 min is your highest-reach window.` : "Track join timing to optimise your opening hook."}
            </div>
          </Card>

          <Card
            title="Viewer Depth Score"
            dotColor={C.purple}
            info={{
              purpose: "This chart summarizes how many people reached each depth-of-viewing segment.",
              read: "Each bar is scaled against the largest segment. The count and percent show how much of the audience stayed that long.",
              lookFor: "Healthy webinars shift viewers toward Engaged, Committed, and Super-fan rather than Drive-by or Browser.",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {insights.segments && insights.segments.map((s, i) => {
                const cs = [C.red, C.accent, C.yellow, C.green, C.purple];
                const maxCount = Math.max(...insights.segments.map(x => x.count));
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{s.segment}</span>
                      <span style={{ fontSize: 11, fontFamily: "JetBrains Mono,monospace", color: cs[i] }}>{fmtNum(s.count)} · {fmtPct(s.pct)}</span>
                    </div>
                    <div style={{ height: 6, background: C.s3, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(s.count / maxCount) * 100}%`, background: cs[i], borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      <RecoPanel items={[
        "If >40% are in the 'Drive-by' segment (<5 min), your opening 5 minutes aren't delivering enough immediate value — lead with a surprising stat or bold claim.",
        `${earlyPct ? earlyPct + "% joined on time" : "Track early arrivals"} — send a reminder 15 minutes before start (not just 1 hour before) to boost on-time attendance.`,
        "Viewers who stay 30+ minutes are your warmest leads. Segment them in your CRM and follow up within 24 hours.",
        "Late joiners (30m+) didn't see your offer introduction — ensure your pitch is repeated at T+90m and T+120m for maximum coverage.",
      ]} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// PAGE 4 — DEMAND SIGNALS (chat topics + analyst + super-participants)
// ─────────────────────────────────────────────────────────────────────

const TOPIC_ICONS = {
  certificate: Award, recording: FileText, pricing: Hash,
  payment_link: Hash, enrollment: Users, audio_video: MessageSquare, thanks: Star,
  questions: MessageSquare, greetings: MessageSquare,
  hindi_language: MessageSquare, notes_materials: FileText, link_access: Hash,
  simlive_suspicion: AlertTriangle, overselling: TrendingDown,
  repeat_requests: MessageSquare, data_privacy: AlertTriangle,
  speed_pacing: Clock, screen_visibility: MessageSquare,
};
const TOPIC_TONES = {
  certificate: "success", enrollment: "success", pricing: "warn", payment_link: "warn",
  audio_video: "danger", recording: "default", thanks: "default",
  questions: "warn", greetings: "default",
  hindi_language: "warn", notes_materials: "warn", link_access: "danger",
  simlive_suspicion: "danger", overselling: "danger", repeat_requests: "warn",
  data_privacy: "danger", speed_pacing: "warn", screen_visibility: "danger",
};

const topicColor = (key) => {
  if (["certificate", "enrollment"].includes(key)) return "var(--green)";
  if (["pricing", "payment_link", "questions", "hindi_language", "notes_materials", "repeat_requests", "speed_pacing"].includes(key)) return "var(--amber)";
  if (["audio_video", "link_access", "simlive_suspicion", "overselling", "data_privacy", "screen_visibility"].includes(key)) return "var(--accent)";
  if (key === "thanks") return "var(--purple)";
  if (key === "greetings") return "var(--blue)";
  return "var(--border-hi)";
};

const ChatMessageExplorer = ({ messages }) => {
  const [audience, setAudience] = useState("all");
  const [search, setSearch] = useState("");
  const adminMessages = useMemo(() => messages.filter((m) => /everyone|public/i.test(m.recipient || "")), [messages]);
  const publicMessages = useMemo(() => messages.filter((m) => !/everyone|public/i.test(m.recipient || "")), [messages]);
  const filtered = useMemo(() => {
    const base = audience === "admin" ? adminMessages : audience === "public" ? publicMessages : messages;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((m) =>
      (m.body || "").toLowerCase().includes(q) ||
      (m.sender || "").toLowerCase().includes(q) ||
      (m.recipient || "").toLowerCase().includes(q)
    );
  }, [adminMessages, audience, messages, publicMessages, search]);

  return (
    <Panel
      title="All chat messages"
      accent="MESSAGE EXPLORER"
      subtitle="Search every message and filter between admin and public streams."
      info={{
        purpose: "This section lets you inspect the full chat log, not only topic-matched messages.",
        read: "Use the Admin and Public buttons to switch message streams, then type in the search box to find names, recipients, or message text.",
        lookFor: "Use this when a topic card feels too narrow and you want the raw conversation around a keyword, person, or audience segment.",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[
          { id: "all", label: "All", count: messages.length },
          { id: "admin", label: "Admin", count: adminMessages.length },
          { id: "public", label: "Public", count: publicMessages.length },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={audience === item.id ? "btn btn-primary" : "btn"}
            onClick={() => setAudience(item.id)}
            style={{ padding: "7px 12px", fontSize: 10 }}
          >
            {item.label} · {fmtNum(item.count)}
          </button>
        ))}
      </div>
      <input
        className="input"
        placeholder="Search all chat messages..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mono text-faint" style={{ fontSize: 10, marginTop: 8, marginBottom: 10, letterSpacing: 1 }}>
        {fmtNum(filtered.length)} messages matched
      </div>
      <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--border)" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)" }}>No messages match.</div>
        ) : (
          filtered.slice(0, 300).map((msg, i) => (
            <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", fontSize: 12.5 }}>
              <div className="flex" style={{ gap: 10, marginBottom: 4, alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="mono text-faint" style={{ fontSize: 10 }}>{msg.time}</span>
                <span className="serif" style={{ fontSize: 13, color: "var(--text)" }}>{msg.sender}</span>
                <span className="mono text-faint" style={{ fontSize: 10 }}>→ {msg.recipient}</span>
              </div>
              <div style={{ color: "var(--text)", lineHeight: 1.45 }}>{msg.body}</div>
            </div>
          ))
        )}
      </div>
      {filtered.length > 300 && (
        <div className="mono text-faint" style={{ fontSize: 10, marginTop: 8 }}>
          Showing first 300 matches. Use search to narrow the list.
        </div>
      )}
    </Panel>
  );
};

const PageDemandSignals = ({ insights, onSelectTopic }) => {
  const topics = insights.chat.topics;
  const total = insights.chat.humanMessages || 1;
  const sorted = [...topics].sort((a, b) => b.count - a.count);
  const top = sorted[0];
  const [selectedTopicKey, setSelectedTopicKey] = useState(top?.key || topics[0]?.key || "");
  const selectedTopic = topics.find((t) => t.key === selectedTopicKey) || top || topics[0];
  const selectedColor = topicColor(selectedTopic?.key);
  const selectedTrend = useMemo(
    () => buildTopicTrend(selectedTopic, insights.chat.messages || [], insights.meta.start, 10, insights.meta.end),
    [insights.chat.messages, insights.meta.end, insights.meta.start, selectedTopic]
  );
  const selectedExamples = useMemo(
    () => cleanExamples(topicMessages(selectedTopic, insights.chat.messages || []), 30),
    [insights.chat.messages, selectedTopic]
  );
  const intentCount = topics.filter(t => ["pricing", "payment_link", "enrollment"].includes(t.key)).reduce((a, t) => a + t.count, 0);
  const intentPct = ((intentCount / total) * 100).toFixed(1);
  const frictionTopic = topics.find(t => t.key === "audio_video");
  const frictionPct = frictionTopic ? ((frictionTopic.count / total) * 100).toFixed(1) : 0;
  const positiveCount = topics.filter(t => ["thanks", "greetings"].includes(t.key)).reduce((a, t) => a + t.count, 0);
  const radarData = topics.map(t => ({
    label: t.label,
    value: t.count,
    pct: +((t.count / total) * 100).toFixed(1),
    topic: t,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Topic cards */}
      <Panel
        title="Chat topics — click any card to drill in"
        accent="03 / DEMAND SIGNALS"
        subtitle="Each card counts how many messages mentioned that theme."
        info={{
          purpose: "This section summarizes what people talked about in chat, grouped into demand, support, and sentiment themes.",
          read: "Each card is one detected topic. The number is how many chat messages matched that theme. Click a non-zero card to see the actual messages behind it.",
          lookFor: "Pricing and enrollment point to buying intent. Certificate and recording show fulfillment demand. Audio/video spikes reveal friction during the session.",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {insights.chat.topics.map((t) => {
            const Icon = TOPIC_ICONS[t.key] || Hash;
            const tone = TOPIC_TONES[t.key] || "default";
            const toneColor = { default: "var(--text)", danger: "var(--accent)", success: "var(--green)", warn: "var(--amber)" }[tone];
            return (
              <button key={t.key} onClick={() => t.count > 0 && onSelectTopic(t)} disabled={t.count === 0}
                style={{ background: "var(--panel-hi)", border: `1px solid ${t.count > 0 ? "var(--border)" : "var(--rule)"}`, padding: 16, cursor: t.count > 0 ? "pointer" : "default", textAlign: "left", color: "var(--text)", transition: "all 0.15s" }}
                onMouseEnter={(e) => { if (t.count > 0) e.currentTarget.style.borderColor = toneColor; }}
                onMouseLeave={(e) => { if (t.count > 0) e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <div className="flex" style={{ gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Icon size={16} color={t.count > 0 ? toneColor : "var(--text-faint)"} />
                  {t.count > 0 && <ChevronRight size={12} color="var(--text-faint)" />}
                </div>
                <div className="mono" style={{ fontSize: 9.5, letterSpacing: 1.5, color: "var(--text-dim)", textTransform: "uppercase", marginTop: 10 }}>{t.label}</div>
                <div className="serif" style={{ fontSize: 30, fontWeight: 400, color: t.count > 0 ? toneColor : "var(--text-faint)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px", lineHeight: 1, marginTop: 4 }}>{fmtNum(t.count)}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{t.count === 0 ? "no mentions" : `${fmtNum(t.count)} messages`}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      <ChatMessageExplorer messages={insights.chat.messages} />

      {/* Chat analyst */}
      <Panel
        title="Chat analyst"
        accent="CHAT INTELLIGENCE"
        subtitle="What the chat numbers actually mean."
        info={{
          purpose: "This chart turns chat topics into a ranked distribution so you can quickly see the dominant audience signals.",
          read: "The horizontal bars show message counts by topic. The summary cards on the right call out the top signal, purchase intent, technical friction, and positive sentiment.",
          lookFor: "A dominant topic tells you what follow-up content should address first. High AV friction should be treated as an operational issue, not just chat noise.",
        }}
      >
        <div style={{ display: "grid", gridTemplateRows: "380px 170px auto", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.95fr)", gap: 14, minWidth: 0 }}>
            <div style={{ height: "100%", minHeight: 0, padding: "12px 14px 10px", background: "var(--panel-hi)", border: "1px solid var(--border)" }}>
              <div className="mono text-faint" style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>TOPIC DISTRIBUTION</div>
              <ResponsiveContainer width="100%" height={334}>
                <BarChart data={radarData} layout="vertical" margin={{ top: 4, right: 54, left: 10, bottom: 12 }} barCategoryGap={2}>
                  <CartesianGrid stroke="var(--rule)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-faint)" tick={{ fontSize: 8, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={v => fmtNum(v)} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    stroke="var(--text-dim)"
                    tick={{ fontSize: 10, fontFamily: "Plus Jakarta Sans,sans-serif", fill: "var(--text-dim)" }}
                    width={162}
                    interval={0}
                  />
                  <Bar
                    dataKey="value"
                    name="Messages"
                    cursor="pointer"
                    onClick={(d) => d?.topic?.key && setSelectedTopicKey(d.topic.key)}
                    label={{ position: "right", fontSize: 7, fontFamily: "JetBrains Mono,monospace", fill: "var(--text-dim)", formatter: (v) => `${((v / total) * 100).toFixed(0)}%` }}
                  >
                    {radarData.map((d, i) => {
                      const c = topicColor(topics[i]?.key);
                      return <Cell key={i} fill={c} fillOpacity={topics[i]?.key === selectedTopic?.key ? 1 : 0.72} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: "12px 14px 10px", border: "1px solid var(--border)", background: "var(--panel-hi)", minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ color: "var(--text-faint)", fontSize: 9, letterSpacing: 1.8, textTransform: "uppercase" }}>Clicked topic timeline</div>
                  <div className="serif" style={{ color: "var(--text)", fontSize: 21, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedTopic?.label || "Select a topic"}</div>
                </div>
                <div className="mono" style={{ color: selectedColor, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{fmtNum(selectedTopic?.count || 0)} msgs</div>
              </div>
              <ResponsiveContainer width="100%" height={334}>
                <LineChart data={selectedTrend} margin={{ top: 8, right: 22, left: 0, bottom: 22 }}>
                  <CartesianGrid stroke="var(--rule)" vertical={false} />
                  <XAxis dataKey="clock" stroke="var(--text-faint)" tick={{ fontSize: 9, fontFamily: "JetBrains Mono,monospace" }} minTickGap={20} tickMargin={8} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} stroke="var(--text-faint)" tick={{ fontSize: 9, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={v => fmtNum(v)} width={36} />
                  <Tooltip content={<TT formatter={(v) => `${fmtNum(v)} msgs`} />} />
                  <Line type="monotone" dataKey="count" name="Messages / 10 min" stroke={selectedColor} strokeWidth={2.5} dot={{ r: 3, fill: selectedColor }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ width: "100%", justifySelf: "stretch", padding: "13px 16px", background: "var(--panel-hi)", border: "1px solid var(--border)", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: selectedColor, textTransform: "uppercase", marginBottom: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>
              Related comments - {selectedTopic?.label || "Select a topic"}
            </div>
            <div style={{ overflowY: "auto", paddingRight: 6, flex: 1 }}>
              {selectedExamples.length > 0 ? selectedExamples.map((msg, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "start", paddingTop: i ? 8 : 0, marginTop: i ? 8 : 0, borderTop: i ? "1px solid var(--rule)" : "none" }}>
                  <div className="mono" style={{ fontSize: 9, color: "var(--text-faint)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.time} - {msg.sender}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.4 }}>"{msg.body}"</div>
                </div>
              )) : (
                <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", paddingTop: 34 }}>Click a bar with matching comments to inspect examples.</div>
              )}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, minWidth: 0 }}>
            {[
              { label: "⚡ TOP SIGNAL", color: "var(--accent)", bg: "var(--accent-soft)", val: top?.label ?? "—", sub: top ? `${fmtNum(top.count)} msgs · ${((top.count / total) * 100).toFixed(1)}% of chat` : "No data" },
              { label: "💰 PURCHASE INTENT", color: intentCount > 10 ? "var(--green)" : "var(--text-faint)", bg: intentCount > 10 ? "var(--green-soft)" : "var(--panel-hi)", val: `${fmtNum(intentCount)} msgs`, sub: `${intentPct}% of chat - pricing + payment + enrollment` },
              { label: "🔇 AV FRICTION", color: +frictionPct > 5 ? "var(--accent)" : "var(--text-faint)", bg: +frictionPct > 5 ? "var(--accent-soft)" : "var(--panel-hi)", val: `${fmtNum(frictionTopic?.count ?? 0)} msgs`, sub: `${frictionPct}% of chat ${+frictionPct > 5 ? "— HIGH · investigate" : "— acceptable"}` },
              { label: "😊 POSITIVE SENTIMENT", color: "var(--amber)", bg: "var(--panel-hi)", val: `${fmtNum(positiveCount)} msgs`, sub: "thanks + greetings combined" },
            ].map((item, i) => (
              <div key={i} style={{ padding: "14px 16px", background: item.bg, border: `1px solid ${item.color}30`, borderLeft: `3px solid ${item.color}`, minHeight: 118, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.8, color: item.color, textTransform: "uppercase", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                <div className="serif" style={{ fontSize: 22, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.val}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.45 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Super-participants */}
      <Panel
        title="Top 15 chatters"
        accent="SUPER-PARTICIPANTS"
        subtitle="Your warmest audience — treat them as VIP leads."
        info={{
          purpose: "This chart identifies the most active people in chat.",
          read: "The table ranks chatters by message count. The bar chart shows the top chatters visually, with longer bars meaning more messages.",
          lookFor: "Frequent chatters are strong candidates for follow-up, community building, testimonials, or deeper sales conversations.",
        }}
      >
        <div>
          <table style={{ width: "100%", fontSize: 12, fontFamily: "JetBrains Mono,monospace" }}>
            <thead>
              <tr style={{ color: "var(--text-dim)", fontSize: 9.5, letterSpacing: 1.5, borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "8px 4px", fontWeight: 500 }}>NAME</th>
                <th style={{ textAlign: "right", padding: "8px 4px", fontWeight: 500 }}>MSGS</th>
                <th style={{ textAlign: "right", padding: "8px 4px", fontWeight: 500 }}>SHARE</th>
              </tr>
            </thead>
            <tbody>
              {insights.chat.topChatters.slice(0, 15).map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--rule)", fontVariantNumeric: "tabular-nums" }}>
                  <td style={{ padding: "8px 4px", fontFamily: "DM Serif Display,serif", fontSize: 13 }}>
                    <span style={{ color: i === 0 ? "var(--amber)" : "var(--text-faint)", marginRight: 8, fontFamily: "JetBrains Mono,monospace", fontSize: 9.5 }}>{String(i + 1).padStart(2, "0")}</span>
                    {s.name}
                  </td>
                  <td style={{ padding: "8px 4px", textAlign: "right", color: i === 0 ? "var(--amber)" : "var(--text)" }}>{s.count}</td>
                  <td style={{ padding: "8px 4px", textAlign: "right", color: "var(--text-faint)", fontSize: 10 }}>{((s.count / insights.chat.humanMessages) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <RecoPanel items={[
        intentCount > 20 ? `${fmtNum(intentCount)} purchase-intent messages is strong demand — ensure your offer was clearly presented and follow up within 12 hours.` : "Low purchase-intent chat signals the offer wasn't front-of-mind — make pricing and enrollment easier to find with a sticky CTA.",
        +frictionPct > 5 ? `${frictionPct}% AV-issue messages is above the 5% threshold — test audio setups 30 min pre-show and have a backup plan.` : "AV friction is low — your technical setup is working. Document and replicate.",
        top ? `"${top.label}" dominated chat — build a dedicated FAQ page and follow-up content around this topic.` : "",
        insights.chat.topChatters[0] ? `${insights.chat.topChatters[0].name} sent ${insights.chat.topChatters[0].count} messages — reach out personally, they may be an ideal community ambassador.` : "",
      ].filter(Boolean)} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// PAGE 5 — GEO BREAKDOWN
// ─────────────────────────────────────────────────────────────────────

const PageGeo = ({ insights }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Panel
      title="Top countries"
      accent="04 / GEO BREAKDOWN"
      subtitle="From Zoom's country signal per attendee."
      info={{
        purpose: "This chart shows where attendees came from geographically.",
        read: "The bar chart ranks countries by viewer count. The pie chart shows the audience share for the largest countries plus Other.",
        lookFor: "A concentrated country mix helps with timezone, language, pricing, and follow-up timing. A spread across many countries may need regional webinar slots.",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <ResponsiveContainer width="100%" height={Math.max(240, 28 * insights.countries.length)}>
          <BarChart data={insights.countries} layout="vertical" margin={{ top: 10, right: 70, left: 40, bottom: 10 }}>
            <CartesianGrid stroke="var(--rule)" horizontal={false} />
            <XAxis type="number" stroke="var(--text-faint)" scale="log" domain={[1, "auto"]} tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
            <YAxis type="category" dataKey="name" stroke="var(--text)" tick={{ fontSize: 11, fontFamily: "DM Serif Display,serif" }} width={100} />
            <Tooltip content={<TT formatter={(v) => fmtNum(v) + " viewers"} />} />
            <Bar dataKey="count" label={{ position: "right", fontSize: 9, fontFamily: "JetBrains Mono,monospace", fill: "var(--text-dim)" }}>
              {insights.countries.map((d, i) => (
                <Cell key={i} fill={i === 0 ? "var(--accent)" : i < 3 ? "var(--amber)" : "var(--border-hi)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div>
          <div className="mono text-faint" style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>SHARE OF AUDIENCE</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={insights.countries.slice(0, 6).concat(insights.countries.length > 6 ? [{ name: "Other", count: insights.countries.slice(6).reduce((a, c) => a + c.count, 0) }] : [])}
                dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
              >
                {insights.countries.slice(0, 7).map((_, i) => {
                  const cs = ["var(--accent)", "var(--amber)", "var(--blue)", "var(--green)", "var(--purple)", "var(--border-hi)", "var(--text-faint)"];
                  return <Cell key={i} fill={cs[i] || "var(--border-hi)"} />;
                })}
              </Pie>
              <Tooltip content={<TT formatter={(v) => fmtNum(v) + " viewers"} />} />
            </PieChart>
          </ResponsiveContainer>
          <table style={{ width: "100%", fontSize: 11, fontFamily: "JetBrains Mono,monospace", marginTop: 8 }}>
            <tbody>
              {insights.countries.slice(0, 6).map((c, i) => {
                const totalViewers = insights.countries.reduce((a, x) => a + x.count, 0);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--rule)" }}>
                    <td style={{ padding: "6px 4px", fontFamily: "DM Serif Display,serif", fontSize: 12 }}>{c.name}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--text-dim)" }}>{fmtNum(c.count)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--text-faint)", fontSize: 10 }}>{((c.count / totalViewers) * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>

    <RecoPanel items={[
      `Your #1 country is ${insights.countries[0]?.name ?? "unknown"} — ensure follow-up emails are timed and localised for that timezone.`,
      "If you have audience from 5+ countries, consider splitting future webinars by timezone to increase show-up rates.",
      "Large audiences from emerging markets (India, Brazil, Philippines) often have high certificate demand — prioritize delivering those promptly.",
    ]} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// PAGE 5 — CHAT PAIN POINTS
// ─────────────────────────────────────────────────────────────────────

// Map chat topic keys → pain point metadata
const TOPIC_PAIN_META = {
  audio_video:  { name: "Audio / Video Issues",      sev: "high",     desc: "Echo, lag, blur, humming. Session-side audio setup problems cause frustration and rejoins.", color: C.yellow },
  payment_link: { name: "Payment Link Queries",      sev: "critical", desc: "Checkout, UPI, Paytm, and broken payment-link questions block high-intent attendees from converting.", color: C.red },
  pricing:      { name: "Paid vs Free Confusion",    sev: "critical", desc: "Attendees confused whether demoed tools need paid subscriptions. Breaks the free-tool promise.", color: C.red },
  certificate:  { name: "Certificate Anxiety",       sev: "high",     desc: "Primary motivator for attendance. Late delivery & generation errors frustrate at session end.", color: C.accent },
  recording:    { name: "Recording Requests",        sev: "medium",   desc: "Late joiners and audio-problem users need catch-up. No-recording policy frustrates.", color: C.blue },
  enrollment:   { name: "Enrollment / Course Pitch", sev: "critical", desc: "Over-selling fatigue. Audience explicitly angry when pitch runs too long.", color: C.red },
  thanks:       { name: "Positive Sentiment",        sev: "low",      desc: "Audience expressing gratitude — indicates engaged, receptive segments.", color: C.green },
  greetings:    { name: "Greetings / Interaction",   sev: "low",      desc: "Active greeting behaviour indicates live engagement and community feel.", color: C.blue },
  questions:    { name: "Unanswered Questions",      sev: "high",     desc: "Audience asking questions signals curiosity, but unanswered ones cause frustration.", color: C.accent },
  hindi_language: { name: "Hindi Language Demand", sev: "medium", desc: "Audience is asking for Hindi or Hinglish delivery. Language mismatch can reduce learning depth.", color: C.yellow },
  notes_materials: { name: "Notes & Materials", sev: "medium", desc: "Requests for notes, slides, PDFs, and resources show follow-up content demand.", color: C.yellow },
  link_access: { name: "Link Access Issues", sev: "high", desc: "People struggling with links, login, or access are blocked before they can engage.", color: C.red },
  simlive_suspicion: { name: "Simlive Suspicion", sev: "critical", desc: "Questions about whether the session is truly live can damage trust quickly.", color: C.red },
  overselling: { name: "Over-Selling Fatigue", sev: "critical", desc: "The audience is reacting to pitch length or sales pressure. This is a retention risk.", color: C.red },
  repeat_requests: { name: "Repeat Requests", sev: "medium", desc: "People asking to repeat or re-explain often signals pacing, clarity, or late-join gaps.", color: C.yellow },
  data_privacy: { name: "Data Privacy", sev: "high", desc: "Privacy and data-use concerns should be answered clearly before asking for action.", color: C.accent },
  speed_pacing: { name: "Speed / Pacing", sev: "medium", desc: "Fast explanations or unclear pacing create avoidable comprehension drop-offs.", color: C.yellow },
  screen_visibility: { name: "Screen Visibility", sev: "high", desc: "Small text, visibility, and screen-share problems reduce value even when content is good.", color: C.blue },
};

const TOPIC_QUOTE_SAMPLES = {
  pricing:     { q: "Claude actually doesn't work until u pay",              tag: "Broken Promise" },
  enrollment:  { q: "You are selling your program from last 1 hour.",        tag: "Pitch Fatigue" },
  audio_video: { q: "VOICE IS COMING WITH A HUMMING SOUND UNABLE TO UNDERSTAND", tag: "Audio" },
  certificate: { q: "Can you share the certificate link now?",               tag: "Certificate" },
  recording:   { q: "Will this session be recorded? Missed the first part.", tag: "Recording" },
  questions:   { q: "Am I the only one who feels you are talking too fast",  tag: "Pacing" },
};

const PageChatPainPoints = ({ insights }) => {
  const [selectedPainKey, setSelectedPainKey] = useState(null);
  // Derive pain points from existing chat.topics data
  const painPoints = useMemo(() => {
    const topics = insights.chat.topics || [];
    return topics
      .filter(t => t.count > 0)
      .map(t => {
        const meta = TOPIC_PAIN_META[t.key] || { name: t.label, sev: "medium", desc: "Detected in chat analysis.", color: C.muted };
        return { name: meta.name, v: t.count, sev: meta.sev, desc: meta.desc, color: meta.color, key: t.key, topic: t };
      })
      .sort((a, b) => b.v - a.v);
  }, [insights.chat.topics]);
  const activePain = painPoints.find((p) => p.key === selectedPainKey) || painPoints[0];
  const activePainExamples = useMemo(
    () => cleanExamples(topicMessages(activePain?.topic, insights.chat.messages || []), 3),
    [activePain, insights.chat.messages]
  );

  // Derive sample quotes from actual chat messages
  const quotes = useMemo(() => {
    const messages = insights.chat.messages || [];
    const topics = insights.chat.topics || [];
    const result = [];

    // Pull 1–2 real messages per topic that has messages
    topics.forEach(t => {
      if (!t.messageIndexes?.length) return;
      const sampleMsgs = t.messageIndexes.slice(0, 2).map(i => messages[i]).filter(Boolean);
      const meta = TOPIC_PAIN_META[t.key];
      const colorMap = { critical: C.red, high: C.accent, medium: C.yellow, low: C.green };
      sampleMsgs.forEach(m => {
        if (m?.body && m.body.length > 8 && m.body.length < 200) {
          result.push({
            q: m.body,
            tag: t.label,
            c: meta ? colorMap[meta.sev] || C.muted : C.muted,
          });
        }
      });
    });

    return result.slice(0, 12);
  }, [insights.chat.topics, insights.chat.messages]);

  const maxPain = painPoints.length ? Math.max(...painPoints.map(p => p.v)) : 1;
  const criticalCount = painPoints.filter(p => p.sev === "critical").length;
  const totalSignals = painPoints.reduce((a, p) => a + p.v, 0);
  const topIssue = painPoints[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <KPI label="Total Chat Msgs" value={fmtNum(insights.chat.humanMessages)} sub="lines analysed" color={C.blue} />
        <KPI label="Pain Signals" value={fmtNum(totalSignals)} sub={`${painPoints.length} categories`} color={C.red} />
        <KPI label="Top Issue" value={topIssue ? topIssue.name.split(" ")[0] : "—"} sub={topIssue ? `${fmtNum(topIssue.v)} mentions` : "0 mentions"} color={C.purple} />
        <KPI label="Trust Threats" value={fmtNum(criticalCount)} sub="critical severity items" color={C.accent} />
        <KPI label="Critical Issues" value={fmtNum(criticalCount)} sub="need immediate action" color={C.red} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card
          title="Pain Point Frequency"
          dotColor={C.accent}
          info={{
            purpose: "This chart ranks the most common audience pain signals found in chat.",
            read: "Each horizontal bar is one pain point category. The number at the end is how many matching messages were found.",
            lookFor: "The longest bars should become your next-session fixes or follow-up FAQ topics.",
          }}
        >
          {painPoints.length > 0 ? painPoints.map((p, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-pressed={activePain?.key === p.key}
              onClick={() => setSelectedPainKey(p.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPainKey(p.key);
                }
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 36px",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
                cursor: "pointer",
                outline: activePain?.key === p.key ? `1px solid ${sevColors[p.sev] || p.color}` : "none",
                outlineOffset: 2,
                borderRadius: 4,
              }}
              title={p.desc}
            >
              <div style={{ fontSize: 10.5, color: C.muted, textAlign: "right", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
              <div style={{ height: 20, background: C.s3, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(p.v / maxPain) * 100}%`, background: sevColors[p.sev] || p.color, borderRadius: 4, transition: "width 0.8s ease", opacity: activePain?.key === p.key ? 1 : 0.78 }} />
              </div>
              <div style={{ fontSize: 11, fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: C.txt }}>{p.v}</div>
            </div>
          )) : (
            <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "30px 0" }}>
              Upload a chat log to generate pain point analysis.
            </div>
          )}
          {activePain && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: C.s2, border: `1px solid ${C.bdr}` }}>
              <div className="mono" style={{ color: sevColors[activePain.sev] || activePain.color, fontSize: 9, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 5 }}>
                Click selection - {activePain.name}
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.45, marginBottom: activePainExamples.length ? 8 : 0 }}>{activePain.desc}</div>
              {activePainExamples.map((msg, i) => (
                <div key={i} style={{ borderTop: i ? `1px solid ${C.bdr}` : "none", paddingTop: i ? 7 : 0, marginTop: i ? 7 : 0 }}>
                  <div className="mono" style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{msg.time} - {msg.sender}</div>
                  <div style={{ fontSize: 11, color: C.txt, lineHeight: 1.4 }}>"{msg.body}"</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Severity × Impact Matrix"
          dotColor={C.red}
          info={{
            purpose: "This panel prioritizes pain points by severity so the team knows what to fix first.",
            read: "Critical and high items appear first, with the mention count beside the issue name and a short explanation underneath.",
            lookFor: "Critical issues are trust-breaking moments. Fix those before optimizing lower-severity engagement details.",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {painPoints.filter(p => ["critical", "high"].includes(p.sev)).length > 0
              ? painPoints.filter(p => ["critical", "high"].includes(p.sev)).map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", background: C.s2, borderLeft: `3px solid ${sevColors[p.sev]}` }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}><Tag sev={p.sev} /></div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.txt, marginBottom: 2 }}>
                      {p.name} <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: sevColors[p.sev] }}>({fmtNum(p.v)})</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45 }}>{p.desc}</div>
                  </div>
                </div>
              ))
              : painPoints.length > 0
                ? painPoints.slice(0, 4).map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", background: C.s2, borderLeft: `3px solid ${sevColors[p.sev] || p.color}` }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}><Tag sev={p.sev} /></div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.txt, marginBottom: 2 }}>
                        {p.name} <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: sevColors[p.sev] || p.color }}>({fmtNum(p.v)})</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45 }}>{p.desc}</div>
                    </div>
                  </div>
                ))
                : <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "30px 0" }}>No issues found in chat data.</div>
            }
          </div>
        </Card>
      </div>

      <Card title="Raw Customer Voice — Verbatim Quotes" dotColor={C.yellow}>
        {quotes.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
            {quotes.map((q, i) => (
              <div key={i} style={{ background: C.s2, padding: "14px 16px", borderLeft: `3px solid ${q.c || C.accent}` }}>
                <div style={{ fontSize: 12, fontStyle: "italic", color: C.txt, lineHeight: 1.5, marginBottom: 8 }}>"{q.q}"</div>
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 8, fontWeight: 700, fontFamily: "JetBrains Mono,monospace", background: `${q.c || C.accent}18`, color: q.c || C.accent, textTransform: "uppercase" }}>{q.tag}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "30px 0" }}>
            No quote samples available — chat messages not loaded.
          </div>
        )}
      </Card>

      <RecoPanel items={[
        topIssue ? `"${topIssue.name}" is your #1 pain signal with ${fmtNum(topIssue.v)} mentions — address it directly in your next session opening.` : "Upload a chat log to identify your top pain signal.",
        criticalCount > 0 ? `${criticalCount} critical-severity item${criticalCount > 1 ? "s" : ""} detected — these are trust-breaking events that need fixing before the next session.` : "No critical trust-breaking events detected — maintain your current approach.",
        "Quotes are your qualitative gold — share top 3 verbatim quotes in your team debrief to build empathy and prioritise fixes.",
      ]} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// PAGE 6 — INSIGHTS & RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────

const PageInsightsRecos = ({ insights }) => {
  const recos = insights.recommendations || [];
  const stories = insights.stories || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {stories.length > 0 && (
        <Card title="The Story: How Chat Pain Points Explain the Attendance Cliff" dotColor={C.cyan}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            {stories.map((item, i) => (
              <div key={i} style={{ background: C.s2, padding: 18, borderLeft: `3px solid ${item.color}`, position: "relative" }}>
                <div style={{ position: "absolute", top: 12, right: 14, textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: item.color }}>{item.stat}</div>
                  <div style={{ fontSize: 8, fontFamily: "JetBrains Mono,monospace", color: C.muted, textTransform: "uppercase" }}>{item.statLabel}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 6, paddingRight: 70 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {stories.length === 0 && (
        <Card title="The Story: Cross-Correlation Analysis" dotColor={C.cyan}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            {[
              { title: "Teaching Works — Selling Kills", stat: fmtNum(insights.headline.peakConcurrent - (insights.headline.stayedToEnd || 0)), statLabel: "drop-off total", color: C.red, body: "Audience retention stays healthy during teaching segments. The steepest drops correlate with extended sales sections. Cap your pitch to the final 20 minutes." },
              { title: "Registration Funnel Leaks", stat: fmtNum((insights.headline.registrants || 0) - (insights.headline.uniqueViewers || 0)), statLabel: "never joined", color: C.blue, body: `${fmtNum(insights.headline.registrants)} registered but only ${fmtNum(insights.headline.uniqueViewers)} joined. Review link delivery timing, WhatsApp reminders, and channel-specific show-up rates.` },
              { title: "Power Cohort — Highest Intent", stat: fmtNum(insights.headline.stayedToEnd || 0), statLabel: "stayed to end", color: C.green, body: "Viewers who stayed to the end are your highest-intent conversion targets. Cross-reference with payment data. If conversion < 8-10%, your closing isn't landing." },
              { title: "Certificate Is a Retention Lever", stat: fmtNum(insights.chat.topics?.find(t => t.key === "certificate")?.count || 0), statLabel: "certificate asks", color: C.accent, body: "Certificate mentions spike at the end. People stay for it. Share certificate links early — at the 2-hour mark — to reduce end-rush exits and extend session attendance." },
            ].map((item, i) => (
              <div key={i} style={{ background: C.s2, padding: 18, borderLeft: `3px solid ${item.color}`, position: "relative" }}>
                <div style={{ position: "absolute", top: 12, right: 14, textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: item.color }}>{item.stat}</div>
                  <div style={{ fontSize: 8, fontFamily: "JetBrains Mono,monospace", color: C.muted, textTransform: "uppercase" }}>{item.statLabel}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 6, paddingRight: 70 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Priority Recommendations" dotColor={C.green}>
        {recos.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {recos.map((r, i) => (
              <div key={i} style={{ background: C.s2, padding: 18, borderLeft: `3px solid ${r.color || C.accent}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 8, right: 14, fontSize: 32, fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: `${r.color || C.accent}15`, lineHeight: 1 }}>{r.n || String(i + 1).padStart(2, "0")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: "JetBrains Mono,monospace", background: `${r.color || C.accent}18`, color: r.color || C.accent }}>{r.pri || "P1"}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{r.title}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginBottom: 6 }}>{r.desc}</div>
                {r.addresses && <div style={{ fontSize: 9, fontFamily: "JetBrains Mono,monospace", color: r.color || C.accent }}>ADDRESSES: {r.addresses}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {[
              { n: "01", title: "Cap Selling to Final 20 Minutes", desc: "Move all program pitches to a marked 'What's Next' segment. Teaching time must feel ad-free.", pri: "P0", color: C.red, addresses: `Over-Selling → ${fmtNum(insights.headline.peakConcurrent - (insights.headline.stayedToEnd || 0))} drop-offs` },
              { n: "02", title: "Fix the Free Tool Promise", desc: "Pre-vet every tool demo for free tiers. When limits exist, disclose upfront. No mid-session paywall discovery.", pri: "P0", color: C.accent, addresses: "Paid vs Free confusion" },
              { n: "03", title: "Fix Registration → Join Funnel", desc: "Check link delivery timing, WhatsApp reminder sequence, and channel-specific show-up rates.", pri: "P1", color: C.blue, addresses: `${fmtNum(insights.headline.registrants)} reg → ${fmtNum(insights.headline.uniqueViewers)} joins` },
              { n: "04", title: "Certificate + Notes: Deliver Early", desc: "Share certificate link at 2-hour mark (not end). Auto-send notes within 2 hrs. Previous broken promises erode trust.", pri: "P2", color: C.purple, addresses: "Certificate anxiety + notes demand" },
            ].map((r, i) => (
              <div key={i} style={{ background: C.s2, padding: 18, borderLeft: `3px solid ${r.color}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 8, right: 14, fontSize: 32, fontFamily: "JetBrains Mono,monospace", fontWeight: 700, color: `${r.color}15`, lineHeight: 1 }}>{r.n}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: "JetBrains Mono,monospace", background: `${r.color}18`, color: r.color }}>{r.pri}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{r.title}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginBottom: 6 }}>{r.desc}</div>
                <div style={{ fontSize: 9, fontFamily: "JetBrains Mono,monospace", color: r.color }}>ADDRESSES: {r.addresses}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// SUB-PAGE TAB NAV
// ─────────────────────────────────────────────────────────────────────

const SUB_PAGES = [
  { id: "overview",    label: "Overview",       icon: BarChart2,      num: "00" },
  { id: "attendance",  label: "Attendance",     icon: Activity,       num: "01" },
  { id: "engagement",  label: "Engagement",     icon: Layers,         num: "02" },
  { id: "demand",      label: "Demand",         icon: Target,         num: "03" },
  { id: "painpoints",  label: "Chat Pain Points", icon: MessageSquare, num: "04" },
];

// ─────────────────────────────────────────────────────────────────────
// MAIN USER DASHBOARD
// ─────────────────────────────────────────────────────────────────────

export default function UserDashboard({ insights, exportMode = false }) {
  const [subPage, setSubPage] = useState("overview");
  const [topicModal, setTopicModal] = useState(null);

  const h = insights.headline;
  const renderSubPage = (pageId) => (
    <>
      {pageId === "overview"    && <PageOverview insights={insights} />}
      {pageId === "attendance"  && <PageAttendance insights={insights} />}
      {pageId === "engagement"  && <PageEngagement insights={insights} />}
      {pageId === "demand"      && <PageDemandSignals insights={insights} onSelectTopic={setTopicModal} />}
      {pageId === "painpoints"  && <PageChatPainPoints insights={insights} />}
      {pageId === "insights"    && <PageInsightsRecos insights={insights} />}
    </>
  );

  return (
    <div className="flex-col" style={{ gap: 0 }}>
      {/* User header */}
      <div style={{
        padding: "22px 28px",
        background: "linear-gradient(135deg, rgba(232,41,74,0.1) 0%, var(--panel) 60%)",
        border: "1px solid var(--border-hi)", borderLeft: "4px solid var(--accent)",
        marginBottom: 0,
      }}>
        <div className="kicker" style={{ marginBottom: 6 }}>
          {insights.userName.toUpperCase()} · {insights.meta.topic}
        </div>
        <h2 className="serif" style={{ fontSize: 30, fontWeight: 400, margin: 0, letterSpacing: "-0.5px" }}>
          {insights.userName}
        </h2>
        <p className="text-dim" style={{ fontSize: 12, marginTop: 8, marginBottom: 0, fontFamily: "Plus Jakarta Sans,sans-serif" }}>
          {fmtNum(h.registrants)} registrants · {fmtNum(h.uniqueViewers)} viewers · {fmtNum(insights.chat.humanMessages)} chat messages · webinar ID {insights.meta.webinarId}
        </p>
      </div>

      {/* Sub-page nav */}
      {!exportMode && (
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--panel-hi)", position: "sticky", top: 65, zIndex: 8 }}>
        <nav style={{ display: "flex", overflowX: "auto" }}>
          {SUB_PAGES.map((p) => {
            const Icon = p.icon;
            const active = subPage === p.id;
            return (
              <button key={p.id} onClick={() => setSubPage(p.id)} style={{
                padding: "12px 18px", background: "transparent", border: "none",
                borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                color: active ? "var(--text)" : "var(--text-dim)",
                fontFamily: "Plus Jakarta Sans,sans-serif", fontSize: 12, fontWeight: 500,
                cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 7,
              }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                <span className="mono" style={{ color: active ? "var(--accent)" : "var(--text-faint)", fontSize: 9, letterSpacing: 1 }}>{p.num}</span>
                <Icon size={13} />
                {p.label}
              </button>
            );
          })}
        </nav>
      </div>
      )}

      {/* Sub-page content */}
      {exportMode ? (
        <div style={{ marginTop: 24, display: "grid", gap: 28 }}>
          {SUB_PAGES.map((page) => (
            <section key={page.id} className="ppt-export-section">
              <div className="kicker" style={{ marginBottom: 12 }}>
                {page.num} / {page.label}
              </div>
              {renderSubPage(page.id)}
            </section>
          ))}
        </div>
      ) : (
        <div className="fadein" key={subPage} style={{ marginTop: 24 }}>
          {renderSubPage(subPage)}
        </div>
      )}

      {!exportMode && topicModal && (
        <TopicMessagesModal topic={topicModal} messages={insights.chat.messages} onClose={() => setTopicModal(null)} />
      )}
    </div>
  );
}