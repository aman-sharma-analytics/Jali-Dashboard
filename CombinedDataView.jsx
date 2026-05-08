import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ComposedChart, Line, Legend,
} from "recharts";
import { Panel, Stat, TT, Rec } from "./UI.jsx";
import { fmtNum, fmtPct, minToClock } from "../lib/format.js";

const COLORS = ["var(--accent)", "var(--green)", "var(--amber)", "var(--blue)", "var(--purple)", "#06b6d4"];
const IMPORTANT_TOPIC_KEYS = [
  "questions",
  "pricing",
  "payment_link",
  "enrollment",
  "certificate",
  "recording",
  "notes_materials",
  "link_access",
  "audio_video",
  "hindi_language",
  "repeat_requests",
  "screen_visibility",
  "speed_pacing",
];

const sumBy = (items, fn) => items.reduce((total, item) => total + (Number(fn(item)) || 0), 0);

const mergeNamedCounts = (groups, key = "name") => {
  const map = new Map();
  groups.flat().forEach((item) => {
    const label = item?.[key] || item?.label || "Unknown";
    map.set(label, (map.get(label) || 0) + (Number(item?.count) || 0));
  });
  return Array.from(map, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

const buildCombinedCurve = (insights) => {
  const map = new Map();
  insights.forEach((ins) => {
    (ins.concurrentCurve || []).forEach((point) => {
      const min = Number(point.min) || 0;
      const row = map.get(min) || { min, active: 0 };
      row.active += Number(point.active) || 0;
      map.set(min, row);
    });
  });
  return Array.from(map.values()).sort((a, b) => a.min - b.min);
};

const topTopics = (insights) => {
  const map = new Map();
  insights.forEach((ins) => {
    (ins.chat?.topics || []).forEach((topic) => {
      const key = topic.key || topic.label;
      const current = map.get(key) || { key, name: topic.label || key, count: 0 };
      current.count += Number(topic.count) || 0;
      map.set(key, current);
    });
  });
  const ranked = Array.from(map.values()).sort((a, b) => b.count - a.count);
  const important = IMPORTANT_TOPIC_KEYS.map((key) => map.get(key)).filter(Boolean);
  return Array.from(new Map([...ranked.slice(0, 12), ...important].map((topic) => [topic.key, topic])).values())
    .sort((a, b) => b.count - a.count);
};

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

const buildCombinedChatCurve = (insights) => {
  const map = new Map();
  insights.forEach((ins) => {
    (ins.chat?.chatPer5 || []).forEach((point) => {
      const min = Number(point.min) || 0;
      const row = map.get(min) || { min, messages: 0 };
      row.messages += Number(point.messages) || 0;
      map.set(min, row);
    });
  });
  return map;
};

const buildCombinedLiveCountCurve = (insights) => {
  const map = new Map();
  insights.forEach((ins) => {
    (ins.liveCount || []).forEach((point) => {
      if (point.min == null) return;
      const min = Math.round(Number(point.min) / 2) * 2;
      const row = map.get(min) || { min, recorded: 0 };
      row.recorded += Number(point.count) || 0;
      map.set(min, row);
    });
  });
  return map;
};

const buildCombinedAttendanceTimeline = (insights) => {
  const map = new Map();
  buildCombinedCurve(insights).forEach((point) => {
    map.set(point.min, { min: point.min, computed: point.active });
  });
  buildCombinedChatCurve(insights).forEach((point, min) => {
    const row = map.get(min) || { min };
    row.messages = point.messages;
    map.set(min, row);
  });
  buildCombinedLiveCountCurve(insights).forEach((point, min) => {
    const row = map.get(min) || { min };
    row.recorded = point.recorded;
    map.set(min, row);
  });
  return Array.from(map.values()).sort((a, b) => a.min - b.min);
};

const buildTopicTrend = (insights, topicKey, step = 5) => {
  const buckets = new Map();
  insights.forEach((ins) => {
    const topic = (ins.chat?.topics || []).find((item) => item.key === topicKey);
    if (!topic) return;
    (topic.messageIndexes || []).forEach((messageIndex) => {
      const msg = ins.chat?.messages?.[messageIndex];
      const min = messageMinute(ins.meta?.start, msg, ins.meta?.end);
      if (min == null) return;
      const bucket = Math.floor(min / step) * step;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });
  });
  const maxMin = Math.max(0, ...Array.from(buckets.keys()));
  const rows = [];
  for (let min = 0; min <= maxMin; min += step) {
    rows.push({ min, demand: buckets.get(min) || 0 });
  }
  return rows.length ? rows : [{ min: 0, demand: 0 }];
};

const buildTopicStats = (insights, topicKey, trend = []) => {
  const senders = new Set();
  let totalMessages = 0;
  let workshops = 0;

  insights.forEach((ins) => {
    const topic = (ins.chat?.topics || []).find((item) => item.key === topicKey);
    if (!topic?.messageIndexes?.length) return;
    workshops += 1;
    totalMessages += topic.messageIndexes.length;
    topic.messageIndexes.forEach((messageIndex) => {
      const msg = ins.chat?.messages?.[messageIndex];
      const sender = (msg?.sender || "").trim().toLowerCase();
      if (sender) senders.add(sender);
    });
  });

  const peakPoint = trend.reduce(
    (best, point) => (Number(point.demand) || 0) > (Number(best.demand) || 0) ? point : best,
    { min: 0, demand: 0 }
  );

  return {
    totalMessages,
    uniqueCustomers: senders.size,
    workshops,
    peakDemand: peakPoint.demand || 0,
    peakMinute: peakPoint.min || 0,
  };
};

export default function CombinedDataView({ insights }) {
  const [selectedTopicKey, setSelectedTopicKey] = useState(null);

  const combined = useMemo(() => {
    const registrants = sumBy(insights, (ins) => ins.headline?.registrants);
    const uniqueViewers = sumBy(insights, (ins) => ins.headline?.uniqueViewers);
    const stayedToEnd = sumBy(insights, (ins) => ins.headline?.stayedToEnd);
    const humanMessages = sumBy(insights, (ins) => ins.chat?.humanMessages);
    const uniqueChatters = sumBy(insights, (ins) => ins.chat?.uniqueChatters);
    const botMessages = sumBy(insights, (ins) => ins.chat?.botMessages);
    const peakConcurrent = Math.max(...insights.map((ins) => Number(ins.headline?.peakConcurrent) || 0), 0);
    const durationMin = Math.max(...insights.map((ins) => Number(ins.meta?.durationMin) || 0), 0);
    const combinedCurve = buildCombinedCurve(insights);
    const avgConcurrent = combinedCurve.length
      ? Math.round(combinedCurve.reduce((total, point) => total + (Number(point.active) || 0), 0) / combinedCurve.length)
      : 0;
    const peakPoint = combinedCurve.reduce(
      (best, point) => (Number(point.active) || 0) > (Number(best.active) || 0) ? point : best,
      { min: 0, active: 0 }
    );

    return {
      registrants,
      uniqueViewers,
      stayedToEnd,
      humanMessages,
      uniqueChatters,
      botMessages,
      peakConcurrent,
      durationMin,
      showUpRate: registrants ? (uniqueViewers / registrants) * 100 : null,
      stayedRate: uniqueViewers ? (stayedToEnd / uniqueViewers) * 100 : null,
      chatRate: uniqueViewers ? (uniqueChatters / uniqueViewers) * 100 : null,
      messagesPerViewer: uniqueViewers ? humanMessages / uniqueViewers : null,
      noShows: Math.max(0, registrants - uniqueViewers),
      avgConcurrent,
      peakMinute: peakPoint.min,
      curve: combinedCurve,
      timeline: buildCombinedAttendanceTimeline(insights),
      countries: mergeNamedCounts(insights.map((ins) => ins.countries || [])).slice(0, 8),
      topics: topTopics(insights),
      rows: insights.map((ins) => ({
        name: ins.userName,
        topic: ins.meta?.topic || "Workshop",
        registrants: ins.headline?.registrants || 0,
        viewers: ins.headline?.uniqueViewers || 0,
        peak: ins.headline?.peakConcurrent || 0,
        avg: ins.headline?.avgConcurrent || 0,
        stayed: ins.headline?.stayedToEnd || 0,
        chatters: ins.chat?.uniqueChatters || 0,
        chat: ins.chat?.humanMessages || 0,
        messagesPerViewer: ins.headline?.uniqueViewers ? (ins.chat?.humanMessages || 0) / ins.headline.uniqueViewers : null,
        showUp: ins.headline?.registrants ? ((ins.headline.uniqueViewers / ins.headline.registrants) * 100) : null,
      })),
    };
  }, [insights]);

  if (!insights?.length) return null;

  const chartStart = insights.find((ins) => ins.meta?.start)?.meta?.start || null;
  const selectedTopic = combined.topics.find((topic) => topic.key === selectedTopicKey) || combined.topics[0];
  const selectedTopicTrend = selectedTopic ? buildTopicTrend(insights, selectedTopic.key) : [];
  const selectedTopicStats = selectedTopic ? buildTopicStats(insights, selectedTopic.key, selectedTopicTrend) : null;
  const topicCount = (key) => combined.topics.find((topic) => topic.key === key)?.count || 0;
  const mainDemandPoints = [
    { label: "Certificate demand", value: topicCount("certificate"), color: "var(--green)" },
    { label: "Buying intent", value: topicCount("pricing") + topicCount("payment_link") + topicCount("enrollment"), color: "var(--amber)" },
    { label: "Access friction", value: topicCount("link_access") + topicCount("audio_video") + topicCount("screen_visibility"), color: "var(--blue)" },
    { label: "Learning support", value: topicCount("notes_materials") + topicCount("repeat_requests") + topicCount("speed_pacing"), color: "var(--purple)" },
  ];
  const maxMin = Math.max(0, ...combined.timeline.map((point) => point.min || 0));
  const xTicks = Array.from({ length: Math.floor(maxMin / 20) + 1 }, (_, i) => i * 20);

  return (
    <div className="flex-col" style={{ gap: 24 }}>
      <div
        style={{
          padding: "22px 28px",
          background: "linear-gradient(135deg, rgba(77,159,255,0.10) 0%, var(--panel) 62%)",
          border: "1px solid var(--border-hi)",
          borderLeft: "4px solid var(--blue)",
        }}
      >
        <div className="kicker" style={{ marginBottom: 6 }}>
          COMBINED DATA · {insights.length} WORKSHOPS
        </div>
        <h2 className="serif" style={{ fontSize: 30, fontWeight: 400, margin: 0 }}>
          Combined workshop analysis
        </h2>
        <p className="text-dim" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Aggregated totals and merged signals across all uploaded workshops. This is not a side-by-side comparison.
        </p>
      </div>

      <div className="grid grid-4" style={{ gap: 14 }}>
        <Stat label="Total registrants" value={fmtNum(combined.registrants)} sub={`${insights.length} workshops`} tone="blue" />
        <Stat label="Total viewers" value={fmtNum(combined.uniqueViewers)} sub={`${fmtPct(combined.showUpRate)} show-up`} tone="success" />
        <Stat label="Stayed to end" value={fmtNum(combined.stayedToEnd)} sub={`${fmtPct(combined.stayedRate)} of viewers`} tone="purple" />
        <Stat label="Chat messages" value={fmtNum(combined.humanMessages)} sub={`${combined.messagesPerViewer?.toFixed(1) || "0.0"} / viewer`} tone="warn" />
        <Stat label="Peak concurrent" value={fmtNum(combined.peakConcurrent)} sub={minToClock(chartStart, combined.peakMinute)} tone="success" />
        <Stat label="Avg concurrent" value={fmtNum(combined.avgConcurrent)} sub="mean live audience" tone="blue" />
        <Stat label="Chat participants" value={fmtNum(combined.uniqueChatters)} sub={`${fmtPct(combined.chatRate)} of viewers`} tone="purple" />
        <Stat label="No-shows" value={fmtNum(combined.noShows)} sub={`${fmtNum(combined.botMessages)} bot messages filtered`} tone="danger" />
      </div>

      <Panel title="Workshop rollup" accent="04 / SOURCE DATA" subtitle="Each workshop contributes to the combined totals below.">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr className="mono" style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", borderBottom: "1px solid var(--border-hi)" }}>
                {["Workshop", "Registrants", "Viewers", "Show-up", "Peak", "Avg", "Stayed", "Chatters", "Chat", "Msg/viewer"].map((heading) => (
                  <th key={heading} style={{ textAlign: heading === "Workshop" ? "left" : "right", padding: "8px 6px" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {combined.rows.map((row) => (
                <tr key={row.name} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={{ padding: "10px 6px", color: "var(--text)" }}>{row.name}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.registrants)}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.viewers)}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtPct(row.showUp)}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.peak)}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.avg)}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.stayed)}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.chatters)}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.chat)}</td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>{row.messagesPerViewer == null ? "—" : row.messagesPerViewer.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-2" style={{ gap: 20 }}>
        <Panel
          title="Combined live audience curve"
          accent="01 / AUDIENCE"
          subtitle="Bars: combined chat messages per 5 min · Blue: computed concurrent · Red: host-recorded live count"
          style={{ gridColumn: "1 / -1" }}
        >
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={combined.timeline} margin={{ top: 32, right: 22, left: 0, bottom: 34 }}>
              <CartesianGrid stroke="var(--rule)" vertical={false} />
              <XAxis
                type="number"
                dataKey="min"
                domain={[0, maxMin]}
                ticks={xTicks}
                stroke="var(--text-faint)"
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }}
                tickFormatter={(v) => minToClock(chartStart, v)}
              />
              <YAxis yAxisId="left" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--amber)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
              <Tooltip content={<TT formatter={(v) => fmtNum(v)} labelFormatter={(v) => minToClock(chartStart, v)} />} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, paddingTop: 10 }} />
              <Bar yAxisId="right" dataKey="messages" name="Chat msgs / 5min" fill="var(--amber)" fillOpacity={0.45} />
              <Line yAxisId="left" type="monotone" dataKey="computed" name="Computed concurrent" stroke="var(--blue)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              <Line yAxisId="left" type="monotone" dataKey="recorded" name="Live count (host)" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid grid-2" style={{ gap: 20 }}>
        <Panel
          title="Combined topic demand"
          accent="03 / CHAT"
          subtitle="Top chat themes merged across every workshop."
          style={{ gridColumn: "1 / -1" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "stretch" }}>
            <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {combined.topics.map((topic, i) => {
              const active = topic.key === selectedTopic?.key;
              const color = COLORS[i % COLORS.length];
              return (
                <button
                  key={topic.key}
                  type="button"
                  onClick={() => setSelectedTopicKey(topic.key)}
                  style={{
                    textAlign: "left",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background: active ? "var(--accent-soft)" : "var(--panel-hi)",
                    color: "var(--text)",
                    padding: "11px 12px",
                    minHeight: 76,
                    cursor: "pointer",
                    boxShadow: active ? "inset 3px 0 0 var(--accent)" : `inset 3px 0 0 ${color}`,
                  }}
                >
                  <div className="mono" style={{ color: active ? "var(--accent)" : color, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase" }}>
                    {topic.name}
                  </div>
                  <div className="serif" style={{ fontSize: 24, lineHeight: 1.1, marginTop: 5 }}>
                    {fmtNum(topic.count)}
                  </div>
                  <div className="mono" style={{ color: "var(--text-faint)", fontSize: 8.5, letterSpacing: 0.8, marginTop: 3 }}>
                    messages
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
            {mainDemandPoints.map((point) => (
              <button
                key={point.label}
                type="button"
                onClick={() => {
                  if (point.label === "Certificate demand") setSelectedTopicKey("certificate");
                  if (point.label === "Buying intent") setSelectedTopicKey("pricing");
                  if (point.label === "Access friction") setSelectedTopicKey("link_access");
                  if (point.label === "Learning support") setSelectedTopicKey("notes_materials");
                }}
                style={{
                  textAlign: "left",
                  border: "1px solid var(--border)",
                  background: "var(--panel-hi)",
                  color: "var(--text)",
                  padding: "9px 10px",
                  cursor: "pointer",
                }}
              >
                <div className="mono" style={{ color: point.color, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase" }}>
                  {point.label}
                </div>
                <div className="serif" style={{ fontSize: 20, lineHeight: 1.1, marginTop: 3 }}>
                  {fmtNum(point.value)}
                </div>
              </button>
            ))}
          </div>
            </div>
            <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 18 }}>
          {selectedTopic && (
            <div>
              <div className="mono" style={{ color: "var(--accent)", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 }}>
                Demand line · {selectedTopic.name}
              </div>
              <div style={{ position: "relative" }}>
                {selectedTopicStats && (
                  <div
                    style={{
                      marginLeft: "auto",
                      marginBottom: 10,
                      width: 176,
                      background: "rgba(8, 9, 12, 0.82)",
                      border: "1px solid var(--border-hi)",
                      padding: "10px 12px",
                      boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
                    }}
                  >
                    <div className="mono" style={{ color: "var(--accent)", fontSize: 8.5, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
                      Selected topic
                    </div>
                    <div className="serif" style={{ color: "var(--text)", fontSize: 24, lineHeight: 1 }}>
                      {fmtNum(selectedTopicStats.uniqueCustomers)}
                    </div>
                    <div className="mono" style={{ color: "var(--text-dim)", fontSize: 9, marginTop: 3, letterSpacing: 0.8 }}>
                      unique customers
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      <div>
                        <div className="mono" style={{ color: "var(--text-faint)", fontSize: 8, textTransform: "uppercase" }}>Messages</div>
                        <div className="mono" style={{ color: "var(--text)", fontSize: 12, fontWeight: 700 }}>{fmtNum(selectedTopicStats.totalMessages)}</div>
                      </div>
                      <div>
                        <div className="mono" style={{ color: "var(--text-faint)", fontSize: 8, textTransform: "uppercase" }}>Peak / 5m</div>
                        <div className="mono" style={{ color: "var(--text)", fontSize: 12, fontWeight: 700 }}>{fmtNum(selectedTopicStats.peakDemand)}</div>
                      </div>
                      <div>
                        <div className="mono" style={{ color: "var(--text-faint)", fontSize: 8, textTransform: "uppercase" }}>Peak time</div>
                        <div className="mono" style={{ color: "var(--text)", fontSize: 12, fontWeight: 700 }}>{minToClock(chartStart, selectedTopicStats.peakMinute)}</div>
                      </div>
                      <div>
                        <div className="mono" style={{ color: "var(--text-faint)", fontSize: 8, textTransform: "uppercase" }}>Workshops</div>
                        <div className="mono" style={{ color: "var(--text)", fontSize: 12, fontWeight: 700 }}>{fmtNum(selectedTopicStats.workshops)}</div>
                      </div>
                    </div>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={420}>
                  <ComposedChart data={selectedTopicTrend} margin={{ top: 8, right: 18, left: 0, bottom: 28 }}>
                    <CartesianGrid stroke="var(--rule)" vertical={false} />
                    <XAxis
                      type="number"
                      dataKey="min"
                      domain={[0, Math.max(0, ...selectedTopicTrend.map((point) => point.min || 0))]}
                      stroke="var(--text-faint)"
                      tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }}
                      tickFormatter={(v) => minToClock(chartStart, v)}
                    />
                    <YAxis stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} allowDecimals={false} tickFormatter={(v) => fmtNum(v)} />
                    <Tooltip content={<TT formatter={(v) => `${fmtNum(v)} msgs`} labelFormatter={(v) => minToClock(chartStart, v)} />} />
                    <Bar dataKey="demand" name="Topic msgs / 5min" fill="var(--amber)" fillOpacity={0.35} />
                    <Line type="monotone" dataKey="demand" name={`${selectedTopic.name} demand`} stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
            </div>
          </div>
        </Panel>

        {false && <Panel title="Workshop rollup" accent="04 / SOURCE DATA" subtitle="Each workshop contributes to the combined totals below." style={{ gridColumn: "1 / -1" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr className="mono" style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", borderBottom: "1px solid var(--border-hi)" }}>
                  {["Workshop", "Registrants", "Viewers", "Show-up", "Peak", "Avg", "Stayed", "Chatters", "Chat", "Msg/viewer"].map((heading) => (
                    <th key={heading} style={{ textAlign: heading === "Workshop" ? "left" : "right", padding: "8px 6px" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {combined.rows.map((row) => (
                  <tr key={row.name} style={{ borderBottom: "1px solid var(--rule)" }}>
                    <td style={{ padding: "10px 6px", color: "var(--text)" }}>{row.name}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.registrants)}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.viewers)}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtPct(row.showUp)}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.peak)}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.avg)}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.stayed)}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.chatters)}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{fmtNum(row.chat)}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>{row.messagesPerViewer == null ? "—" : row.messagesPerViewer.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>}
      </div>

      <Rec items={[
        "Use combined totals for business reporting: total reach, total viewers, and total chat demand across the workshop series.",
        "Use the comparison tab only when you want to understand which workshop performed better. This tab is for the full-series picture.",
        "The combined topic chart is the best place to prioritize follow-up content and support messaging across all attendees.",
      ]} />
    </div>
  );
}