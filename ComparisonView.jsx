import React, { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, ReferenceLine,
  ComposedChart, Cell,
} from "recharts";
import { Panel, TT, Rec } from "./UI.jsx";
import { fmtNum, fmtPct, minToClock } from "../lib/format.js";

const COLORS = ["var(--accent)", "var(--green)", "var(--amber)", "var(--blue)", "#A78BFA", "#FF7B72"];

const ISSUE_DEFS = [
  { key: "audio", label: "Audio not clear", color: "var(--accent)", patterns: [/\baudio\b/i, /\bsound\b/i, /\bvoice\b/i, /\bmic\b/i, /\bnot audible\b/i, /\bcan't hear\b/i, /\bcannot hear\b/i, /\bcant hear\b/i, /\bnot clear\b/i] },
  { key: "payment", label: "Payment link", color: "#FF7B72", patterns: [/\bpayment\s+link\b/i, /\bpay(ment)?\b.*\blink\b/i, /\blink\b.*\bnot working\b/i, /\bnot working\b.*\blink\b/i, /\bunable\b.*\bpay\b/i, /\bcan't\b.*\bpay\b/i, /\bcannot\b.*\bpay\b/i, /\berror\b.*\bpay/i] },
  { key: "video", label: "Video issue", color: "var(--blue)", patterns: [/\bvideo\b/i, /\bscreen\b/i, /\bnot visible\b/i, /\bcan't see\b/i, /\bcannot see\b/i, /\bcant see\b/i, /\blag/i, /\bbuffer/i, /\bfreez/i, /\bstuck\b/i] },
  { key: "certificate", label: "Certificate issue", color: "var(--green)", patterns: [/\bcertificate?s?\b/i, /\bcertif/i, /\bcertificate\b.*\bnot\b/i, /\bnot\b.*\bcertificate\b/i] },
  { key: "recording", label: "Recording issue", color: "#A78BFA", patterns: [/\brecording\b/i, /\brecorded\b/i, /\breplay\b/i, /\bsend\b.*\bvideo\b/i] },
  { key: "price", label: "Price confusion", color: "var(--amber)", patterns: [/\bprice\b/i, /\bfees?\b/i, /\bcost\b/i, /\bpaid\b/i, /\bhow much\b/i, /\bdiscount\b/i, /\bcoupon\b/i] },
  { key: "access", label: "Access / joining", color: "var(--blue)", patterns: [/\bjoin\b/i, /\blogin\b/i, /\bregister\b/i, /\baccess\b/i, /\bnot able\b/i, /\bunable\b/i] },
];

const topicCount = (insight, key) => insight.chat.topics.find((t) => t.key === key)?.count || 0;
const issueCountsFor = (messages = []) => {
  const counts = Object.fromEntries(ISSUE_DEFS.map((def) => [def.key, 0]));
  messages.forEach((msg) => {
    const body = msg.body || "";
    ISSUE_DEFS.forEach((def) => {
      if (def.patterns.some((re) => re.test(body))) counts[def.key] += 1;
    });
  });
  return counts;
};
const valueAtOrBefore = (curve = [], min) => {
  const points = curve.filter((p) => p.min <= min && p.active != null);
  return points.length ? points[points.length - 1].active : null;
};
const minuteAtClock = (start, hour24, minute, fallback) => {
  if (!start) return fallback;
  const t = new Date(start);
  t.setHours(hour24, minute, 0, 0);
  return Math.round((t.getTime() - start.getTime()) / 60000);
};

// =====================================================================
// 01 / HEADLINE METRICS TABLE
// =====================================================================

function MetricsTable({ comparison }) {
  const { userNames, metricRows } = comparison;
  return (
    <div>
      <Panel
        title="Headline metrics"
        accent="01 / NUMBERS"
        info={{
          purpose: "This table compares the headline performance numbers for every uploaded webinar.",
          read: "Each row is a metric and each column is a webinar. Green marks the best value in that row, red marks the weakest, and the gap column shows the spread.",
          lookFor: "Use this to spot the biggest performance gaps before digging into the detailed charts below.",
        }}
        subtitle="The same headline numbers from each webinar, side-by-side. Green = best · Red = worst."
      >
        <table style={{ width: "100%", fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-hi)", color: "var(--text-dim)", fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase" }}>
              <th style={{ textAlign: "left", padding: "10px 8px", fontWeight: 500 }}>Metric</th>
              {userNames.map((n, i) => (
                <th key={i} style={{ textAlign: "right", padding: "10px 8px", fontWeight: 500, color: COLORS[i] }}>{n}</th>
              ))}
              <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 500 }}>Δ gap</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row, i) => {
              const max = Math.max(...row.values);
              const min = Math.min(...row.values);
              const delta = max - min;
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--rule)", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "DM Serif Display, serif", fontSize: 14 }}>{row.metric}</td>
                  {row.values.map((v, j) => {
                    const isBest = v === max && delta > 0;
                    const isWorst = v === min && delta > 0;
                    return (
                      <td key={j} style={{ padding: "12px 8px", textAlign: "right", color: isBest ? "var(--green)" : isWorst ? "var(--accent)" : "var(--text)", fontWeight: isBest || isWorst ? 600 : 400 }}>
                        {row.metric.includes("%") ? fmtPct(v) : fmtNum(v)}
                      </td>
                    );
                  })}
                  <td style={{ padding: "12px 8px", textAlign: "right", color: delta > 0 ? "var(--amber)" : "var(--text-faint)", fontSize: 11 }}>
                    {delta > 0 ? (row.metric.includes("%") ? fmtPct(delta) : fmtNum(delta)) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mono text-faint" style={{ fontSize: 9, marginTop: 10, letterSpacing: 1 }}>
          GREEN = best · RED = worst · — = tied
        </div>
      </Panel>
      <Rec items={[
        "Focus on show-up rate and stayed-to-close % as your leading indicators — these are within your control through better email sequences and content pacing.",
        "Large gaps (Δ) on 'Peak concurrent' usually trace back to email list quality and reminder cadence, not content quality.",
        "If one webinar has a much higher 'Avg concurrent' despite similar peak, it has better content retention — study its structure for replication.",
      ]} />
    </div>
  );
}

// =====================================================================
// 02 / CONCURRENT CURVE OVERLAY
// =====================================================================

function ConcurrentCurves({ comparison }) {
  const { userNames, alignedCurves } = comparison;

  // Normalised curves (% of each webinar's own peak) for fair comparison
  const peaks = userNames.map((_, i) => {
    return Math.max(...alignedCurves.map(d => d[`u${i}`] || 0));
  });
  const normalised = alignedCurves.map(d => {
    const row = { min: d.min };
    userNames.forEach((_, i) => {
      row[`n${i}`] = peaks[i] > 0 ? +((( d[`u${i}`] || 0) / peaks[i]) * 100).toFixed(1) : 0;
      row[`u${i}`] = d[`u${i}`];
    });
    return row;
  });

  return (
    <div>
      <div className="grid grid-2" style={{ gap: 20 }}>
        {/* Raw curves */}
        <Panel
          title="Live audience curves — raw counts"
          accent="02 / SHAPE"
          info={{
            purpose: "This chart compares live audience size across webinars using raw viewer counts.",
            read: "Each colored line is one webinar. The x-axis is minutes after start and the y-axis is concurrent viewers.",
            lookFor: "Early separation usually reflects list quality or reminder strength. Late separation usually reflects content retention.",
          }}
          subtitle="Absolute concurrent viewer count, aligned by minutes-since-start."
        >
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={alignedCurves} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
              <CartesianGrid stroke="var(--rule)" vertical={false} />
              <XAxis dataKey="min" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => `T+${v}m`} ticks={[0, 30, 60, 90, 120, 150, 180, 210, 240]} />
              <YAxis stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => fmtNum(v)} />
              <Tooltip content={<TT formatter={(v) => fmtNum(v)} labelFormatter={(v) => `T+${v}m`} />} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, paddingTop: 10 }} />
              {userNames.map((n, i) => (
                <Line key={i} type="monotone" dataKey={`u${i}`} name={n} stroke={COLORS[i]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Normalised curves */}
        <Panel
          title="Normalised retention (% of peak)"
          accent="RETENTION SHAPE"
          info={{
            purpose: "This chart compares retention shape fairly, even when webinars had different audience sizes.",
            read: "Each webinar peak is treated as 100%. A line at 70% means that webinar kept 70% of its own peak audience at that minute.",
            lookFor: "The best retention curve stays high and declines slowly. A steep fall after the peak points to a weak transition or content section.",
          }}
          subtitle="Each curve re-scaled to its own peak = 100%. Shows who held their room better."
        >
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={normalised} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
              <CartesianGrid stroke="var(--rule)" vertical={false} />
              <XAxis dataKey="min" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => `T+${v}m`} ticks={[0, 30, 60, 90, 120, 150, 180, 210, 240]} />
              <YAxis stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => `${v}%`} domain={[0, 105]} />
              <Tooltip content={<TT formatter={(v) => `${v}%`} labelFormatter={(v) => `T+${v}m`} />} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, paddingTop: 10 }} />
              <ReferenceLine y={50} stroke="var(--border-hi)" strokeDasharray="3 3" label={{ value: "50%", fill: "var(--text-faint)", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }} />
              {userNames.map((n, i) => (
                <Line key={i} type="monotone" dataKey={`n${i}`} name={n} stroke={COLORS[i]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Rec items={[
        "A normalised curve that stays above 70% past T+60m = strong content retention. Below 50% at T+60m = structural problem in the middle segment.",
        "The slope from peak to T+90m tells you how quickly you're losing people after the peak moment — slow decline = engaged room, steep drop = abrupt transition.",
        "If raw curves diverge early (before T+15m), the gap is audience size / list quality. If they diverge late, it's content retention.",
      ]} />
    </div>
  );
}

// =====================================================================
// 03 / CHAT TOPIC SIGNALS
// =====================================================================

function ChatTopicComparison({ comparison }) {
  const { userNames, topicCmp } = comparison;

  // Intent topics only
  const intentTopics = topicCmp.filter(t => ["pricing","enrollment","certificate"].includes(t.key));
  const intentData = intentTopics.map(t => ({ label: t.label, ...Object.fromEntries(userNames.map((n, i) => [n, t.values[i]])) }));

  return (
    <div>
      <div className="grid grid-2" style={{ gap: 20 }}>
        <Panel
          title="Chat topics — all themes"
          accent="03 / DEMAND SIGNALS"
          info={{
            purpose: "This chart compares chat demand and support themes across webinars.",
            read: "Each row is a topic and each colored bar is a webinar. Longer bars mean more messages for that topic.",
            lookFor: "Large differences show which webinar audience cared more about certificates, pricing, enrollment, questions, or technical issues.",
          }}
          subtitle="How often each theme appeared in chat, per webinar."
          takeaway="A big gap on Certificate or Pricing between webinars reveals which audience was further down the buying journey. Use this to tailor follow-up sequences."
        >
          <ResponsiveContainer width="100%" height={Math.max(280, 34 * topicCmp.length)}>
            <BarChart data={topicCmp.map(t => ({ label: t.label, ...Object.fromEntries(userNames.map((n, i) => [n, t.values[i]])) }))} layout="vertical" margin={{ top: 10, right: 60, left: 60, bottom: 10 }}>
              <CartesianGrid stroke="var(--rule)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => fmtNum(v)} />
              <YAxis type="category" dataKey="label" stroke="var(--text)" tick={{ fontSize: 11, fontFamily: "DM Serif Display, serif" }} width={130} />
              <Tooltip content={<TT formatter={(v) => fmtNum(v) + " msgs"} />} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, paddingTop: 10 }} />
              {userNames.map((n, i) => <Bar key={i} dataKey={n} fill={COLORS[i]} />)}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Intent-specific comparison */}
        <Panel
          title="Purchase-intent topics"
          accent="INTENT SIGNALS"
          info={{
            purpose: "This chart isolates the topics most closely tied to purchase or follow-up intent.",
            read: "Each topic is on the x-axis and the bars show how many messages each webinar received for that topic.",
            lookFor: "Higher pricing and enrollment bars indicate a hotter sales follow-up list. High certificate demand means fulfillment timing matters.",
          }}
          subtitle="Certificate + Pricing + Enrollment — the three buying-intent markers."
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={intentData} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
              <CartesianGrid stroke="var(--rule)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} angle={-15} textAnchor="end" />
              <YAxis stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => fmtNum(v)} />
              <Tooltip content={<TT formatter={(v) => fmtNum(v) + " msgs"} />} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, paddingTop: 10 }} />
              {userNames.map((n, i) => <Bar key={i} dataKey={n} fill={COLORS[i]} />)}
            </BarChart>
          </ResponsiveContainer>

          {/* Intent score table */}
          <div style={{ marginTop: 16 }}>
            <div className="mono text-faint" style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>TOTAL INTENT SCORE</div>
            {userNames.map((n, i) => {
              const total = intentTopics.reduce((a, t) => a + (t.values[i] || 0), 0);
              const maxTotal = Math.max(...userNames.map((_, j) => intentTopics.reduce((a, t) => a + (t.values[j] || 0), 0)));
              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontFamily: "DM Serif Display, serif", color: COLORS[i] }}>{n}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{fmtNum(total)} msgs</span>
                  </div>
                  <div style={{ height: 4, background: "var(--rule)", borderRadius: 2 }}>
                    <div style={{ height: 4, background: COLORS[i], borderRadius: 2, width: maxTotal > 0 ? `${(total / maxTotal) * 100}%` : "0%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
      <Rec items={[
        "The webinar with more 'Certificate' mentions has an audience expecting credentials — deliver certificates within 24 hours to maximise satisfaction.",
        "Higher 'Pricing/Fees' chat vs another webinar = hotter buying intent. Prioritise that list for direct sales follow-up.",
        "If 'Questions' count varies dramatically, the lower-questions webinar may have had a better-structured Q&A or clearer content — replicate that format.",
      ]} />
    </div>
  );
}

// =====================================================================
// 04 / ENGAGEMENT DEPTH COMPARISON
// =====================================================================

function EngagementComparison({ comparison, insights }) {
  const { userNames } = comparison;

  // Segment data per user
  const allSegments = ["Drive-by", "Browser", "Engaged", "Committed", "Super-fan"];
  const segData = allSegments.map(seg => {
    const row = { segment: seg };
    insights.forEach((u, i) => {
      const s = u.segments?.find(x => x.segment === seg);
      row[userNames[i]] = s ? s.pct : 0;
    });
    return row;
  });

  // Lateness comparison
  const latenessBuckets = ["On time", "Slightly late", "Late", "Very late", "Final hr"];
  const latenessData = latenessBuckets.map(b => {
    const row = { bucket: b };
    insights.forEach((u, i) => {
      const found = u.lateness?.find(x => x.bucket === b);
      row[userNames[i]] = found?.count || 0;
    });
    return row;
  });

  return (
    <div>
      <div className="grid grid-2" style={{ gap: 20 }}>
        <Panel
          title="Engagement depth — % in each segment"
          accent="04 / ENGAGEMENT"
          info={{
            purpose: "This chart compares how deeply audiences watched across webinars.",
            read: "Each row is a viewing-depth segment. Bars show the percent of each webinar's audience in that segment.",
            lookFor: "More Committed and Super-fan share means stronger retention. More Drive-by share means the opening or audience match needs work.",
          }}
          subtitle="What share of each webinar's audience fell into each time-in-session segment."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={segData} layout="vertical" margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
              <CartesianGrid stroke="var(--rule)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="segment" stroke="var(--text)" tick={{ fontSize: 11, fontFamily: "DM Serif Display, serif" }} width={90} />
              <Tooltip content={<TT formatter={(v) => `${v}%`} />} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, paddingTop: 10 }} />
              {userNames.map((n, i) => <Bar key={i} dataKey={n} fill={COLORS[i]} fillOpacity={0.85} />)}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Arrival timing comparison"
          accent="ARRIVAL TIMING"
          info={{
            purpose: "This chart compares how punctual attendees were across webinars.",
            read: "Each bucket shows first-join timing. Bars show how many people in each webinar first joined during that window.",
            lookFor: "Higher on-time arrivals suggest better reminders and access delivery. More late arrivals mean the opening may not reach much of the audience.",
          }}
          subtitle="When attendees first joined, relative to scheduled start — all webinars aligned."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={latenessData} margin={{ top: 10, right: 16, left: 0, bottom: 50 }}>
              <CartesianGrid stroke="var(--rule)" vertical={false} />
              <XAxis dataKey="bucket" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} angle={-20} textAnchor="end" interval={0} />
              <YAxis stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => fmtNum(v)} />
              <Tooltip content={<TT formatter={(v) => fmtNum(v) + " viewers"} />} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, paddingTop: 10 }} />
              {userNames.map((n, i) => <Bar key={i} dataKey={n} fill={COLORS[i]} fillOpacity={0.85} />)}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Rec items={[
        "The webinar with more 'Committed' + 'Super-fan' viewers has better content depth — study its format and replicate the pacing.",
        "If one webinar has much higher 'On time' arrivals, its reminder sequence is more effective — adopt that email timing across all future webinars.",
        "Higher 'Drive-by' share means the hook isn't working. Test a stronger opening statement, provocative question, or surprising statistic in the first 3 minutes.",
      ]} />
    </div>
  );
}

// =====================================================================
// 05 / RADAR — multi-metric performance fingerprint
// =====================================================================

function SessionQualityScorecards({ comparison, insights }) {
  const { userNames } = comparison;
  const rows = insights.map((u, i) => {
    const chatRate = u.headline.uniqueViewers ? +(u.chat.humanMessages / u.headline.uniqueViewers).toFixed(1) : 0;
    const intent = topicCount(u, "pricing") + topicCount(u, "enrollment");
    const intentRate = u.chat.humanMessages ? +((intent / u.chat.humanMessages) * 100).toFixed(1) : 0;
    const engagedPct = +(u.segments
      .filter((s) => ["Engaged", "Committed", "Super-fan"].includes(s.segment))
      .reduce((sum, s) => sum + (s.pct || 0), 0)).toFixed(1);
    return { name: userNames[i], color: COLORS[i], showup: u.headline.showupRate || 0, retained: u.headline.stayedToEndPct || 0, chatRate, intentRate, engagedPct };
  });
  const best = (key) => Math.max(...rows.map((r) => r[key]));
  const score = (r) => Math.round((r.showup + r.retained + r.engagedPct + Math.min(r.chatRate * 8, 100) + Math.min(r.intentRate * 10, 100)) / 5);

  return (
    <Panel
      title="Session quality scorecards"
      accent="05 / QUALITY"
      subtitle="Audience quality, engagement density, and buying intent compared in one view."
      info={{
        purpose: "This panel compares session quality beyond raw attendance.",
        read: "Each card uses show-up, retention, engagement depth, chat density, and purchase-intent density.",
        lookFor: "A smaller webinar can still be stronger if retention, chat density, and intent are higher.",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(rows.length, 3)}, minmax(240px, 1fr))`, gap: 14 }}>
        {rows.map((r) => (
          <div key={r.name} style={{ border: `1px solid ${r.color}`, background: "var(--panel-hi)", padding: 16 }}>
            <div className="mono" style={{ color: r.color, fontSize: 9, letterSpacing: 1.6, textTransform: "uppercase" }}>{r.name}</div>
            <div className="serif" style={{ fontSize: 30, color: "var(--text)", marginTop: 6 }}>{score(r)}<span style={{ fontSize: 13, color: "var(--text-dim)" }}>/100</span></div>
            <div className="mono" style={{ color: "var(--text-faint)", fontSize: 9, marginBottom: 12 }}>quality score</div>
            {[
              ["Show-up", "showup", fmtPct(r.showup)],
              ["Stayed to close", "retained", fmtPct(r.retained)],
              ["Engaged depth", "engagedPct", fmtPct(r.engagedPct)],
              ["Msgs / viewer", "chatRate", r.chatRate.toFixed(1)],
              ["Intent density", "intentRate", fmtPct(r.intentRate)],
            ].map(([label, key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: "1px solid var(--rule)" }}>
                <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{label}</span>
                <span className="mono" style={{ color: r[key] === best(key) && r[key] > 0 ? r.color : "var(--text)", fontSize: 11 }}>{value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function IssueHeatmap({ comparison, insights }) {
  const { userNames } = comparison;
  const perSession = insights.map((u) => issueCountsFor(u.chat.messages));
  const maxCount = Math.max(1, ...perSession.flatMap((counts) => Object.values(counts)));
  const rows = ISSUE_DEFS.map((issue) => ({ ...issue, values: perSession.map((counts) => counts[issue.key] || 0) }));

  return (
    <Panel
      title="Participant issue heatmap"
      accent="06 / FRICTION"
      subtitle="Audio, video, payment, certificate, recording, price, and access problems by session."
      info={{
        purpose: "This heatmap shows which session had the most participant friction by problem type.",
        read: "Rows are issue types. Columns are sessions. Stronger color means more chat messages matched that problem.",
        lookFor: "Fix the darkest cells first: they are the most repeated operational problems.",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-dim)", fontFamily: "JetBrains Mono,monospace", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" }}>Problem</th>
              {userNames.map((name, i) => (
                <th key={name} style={{ textAlign: "center", padding: "8px 10px", color: COLORS[i], fontFamily: "JetBrains Mono,monospace", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" }}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((issue) => (
              <tr key={issue.key} style={{ borderTop: "1px solid var(--rule)" }}>
                <td style={{ padding: "10px", color: "var(--text)", fontWeight: 600 }}>
                  <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: issue.color, marginRight: 8 }} />
                  {issue.label}
                </td>
                {issue.values.map((value, i) => {
                  const intensity = value > 0 ? Math.max(0.16, value / maxCount) : 0.04;
                  return (
                    <td key={i} style={{ padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ background: value > 0 ? COLORS[i] : "var(--panel)", opacity: value > 0 ? intensity : 1, border: `1px solid ${value > 0 ? COLORS[i] : "var(--border)"}`, color: "var(--text)", padding: "8px 10px", fontFamily: "JetBrains Mono,monospace", fontWeight: 700 }}>
                        {fmtNum(value)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ConversionSignals({ comparison, insights }) {
  const { userNames } = comparison;
  const data = insights.map((u, i) => {
    const pricing = topicCount(u, "pricing");
    const enrollment = topicCount(u, "enrollment");
    const certificate = topicCount(u, "certificate");
    const recording = topicCount(u, "recording");
    return { name: userNames[i], pricing, enrollment, certificate, recording, intent: pricing + enrollment, fulfillment: certificate + recording };
  });

  return (
    <div className="grid grid-2" style={{ gap: 20 }}>
      <Panel title="Conversion intent vs fulfillment demand" accent="07 / INTENT" subtitle="Pricing + enrollment are buying intent; certificate + recording are fulfillment demand.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 25 }}>
            <CartesianGrid stroke="var(--rule)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} />
            <YAxis stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
            <Tooltip content={<TT formatter={(v) => fmtNum(v) + " msgs"} />} />
            <Legend wrapperStyle={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, paddingTop: 10 }} />
            <Bar dataKey="intent" name="Buying intent" fill="var(--green)" />
            <Bar dataKey="fulfillment" name="Fulfillment demand" fill="var(--amber)" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Topic detail by session" accent="DETAIL" subtitle="Breakdown of the four topics that affect conversion follow-up.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 25 }}>
            <CartesianGrid stroke="var(--rule)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} />
            <YAxis stroke="var(--text-faint)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono,monospace" }} tickFormatter={(v) => fmtNum(v)} />
            <Tooltip content={<TT formatter={(v) => fmtNum(v) + " msgs"} />} />
            <Legend wrapperStyle={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, paddingTop: 10 }} />
            <Bar dataKey="pricing" name="Pricing" fill="var(--amber)" />
            <Bar dataKey="enrollment" name="Enrollment" fill="var(--green)" />
            <Bar dataKey="certificate" name="Certificate" fill="var(--blue)" />
            <Bar dataKey="recording" name="Recording" fill="#A78BFA" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function MomentImpact({ comparison, insights }) {
  const { userNames } = comparison;
  const moments = [
    { label: "Price reveal", hour: 13, minute: 38, fallback: 173 },
    { label: "Certificate link", hour: 14, minute: 18, fallback: 213 },
  ];
  const rows = moments.flatMap((moment) => insights.map((u, i) => {
    const min = minuteAtClock(u.meta.start, moment.hour, moment.minute, moment.fallback);
    const before = valueAtOrBefore(u.concurrentCurve, min - 5);
    const after = valueAtOrBefore(u.concurrentCurve, min + 15);
    const drop = before != null && after != null ? before - after : null;
    const dropPct = before ? +((drop / before) * 100).toFixed(1) : null;
    const chatPressure = u.chat.messages.filter((msg) => {
      const [h, mi, s] = msg.time.split(":").map(Number);
      if (Number.isNaN(h) || !u.meta.start) return false;
      const d = new Date(u.meta.start);
      d.setHours(h, mi, s || 0, 0);
      const msgMin = Math.round((d.getTime() - u.meta.start.getTime()) / 60000);
      return Math.abs(msgMin - min) <= 10;
    }).length;
    return { moment: moment.label, session: userNames[i], color: COLORS[i], before, after, drop, dropPct, chatPressure };
  }));

  return (
    <Panel
      title="Moment impact table"
      accent="08 / TIMELINE"
      subtitle="Audience movement and chat pressure around price reveal and certificate link."
      info={{
        purpose: "This table compares what happened around two important session moments.",
        read: "Before is concurrent viewers five minutes before the moment. After is fifteen minutes after. Chat pressure counts messages within ten minutes.",
        lookFor: "High drop after price reveal means the offer transition needs work. High chat pressure around certificate link means fulfillment instructions need to be clearer.",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "JetBrains Mono,monospace", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", borderBottom: "1px solid var(--border-hi)" }}>
              {["Moment", "Session", "Before", "After", "Drop", "Drop %", "Chat pressure"].map((h) => <th key={h} style={{ textAlign: h === "Moment" || h === "Session" ? "left" : "right", padding: "9px 8px" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--rule)" }}>
                <td style={{ padding: "10px 8px", color: "var(--text)" }}>{row.moment}</td>
                <td style={{ padding: "10px 8px", color: row.color }}>{row.session}</td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>{fmtNum(row.before)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>{fmtNum(row.after)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: row.drop > 0 ? "var(--accent)" : "var(--green)" }}>{row.drop == null ? "—" : fmtNum(row.drop)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: row.dropPct > 10 ? "var(--accent)" : "var(--text)" }}>{row.dropPct == null ? "—" : fmtPct(row.dropPct)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: "var(--amber)" }}>{fmtNum(row.chatPressure)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SmartInsights({ comparison, insights }) {
  const { userNames } = comparison;
  const bestBy = (fn) => {
    const values = insights.map(fn);
    const max = Math.max(...values);
    const idx = values.indexOf(max);
    return { name: userNames[idx], value: max, color: COLORS[idx] };
  };
  const issueTotals = insights.map((u) => Object.values(issueCountsFor(u.chat.messages)).reduce((a, b) => a + b, 0));
  const mostProblematicIdx = issueTotals.indexOf(Math.max(...issueTotals));
  const bestRetention = bestBy((u) => u.headline.stayedToEndPct || 0);
  const bestIntent = bestBy((u) => topicCount(u, "pricing") + topicCount(u, "enrollment"));
  const bestChatDensity = bestBy((u) => u.headline.uniqueViewers ? u.chat.humanMessages / u.headline.uniqueViewers : 0);
  const cards = [
    { title: "Best retention", value: `${bestRetention.name} · ${fmtPct(bestRetention.value)}`, color: bestRetention.color, body: "Use this session as the structure benchmark for pacing and content flow." },
    { title: "Highest buying intent", value: `${bestIntent.name} · ${fmtNum(bestIntent.value)} msgs`, color: bestIntent.color, body: "Prioritize this attendee list for sales follow-up and payment support." },
    { title: "Most active chat", value: `${bestChatDensity.name} · ${bestChatDensity.value.toFixed(1)} msgs/viewer`, color: bestChatDensity.color, body: "Study the prompts and interaction rhythm from this session." },
    { title: "Most friction", value: `${userNames[mostProblematicIdx]} · ${fmtNum(issueTotals[mostProblematicIdx])} issues`, color: COLORS[mostProblematicIdx], body: "Review tech, payment, certificate, and access support before repeating this format." },
  ];

  return (
    <Panel title="Smart comparison insights" accent="09 / AUTO READ" subtitle="Auto-generated takeaways from the uploaded session documents.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {cards.map((card) => (
          <div key={card.title} style={{ background: "var(--panel-hi)", borderLeft: `3px solid ${card.color}`, padding: 16 }}>
            <div className="mono" style={{ color: card.color, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" }}>{card.title}</div>
            <div className="serif" style={{ color: "var(--text)", fontSize: 20, marginTop: 6 }}>{card.value}</div>
            <p style={{ color: "var(--text-dim)", fontSize: 12, lineHeight: 1.5, margin: "8px 0 0" }}>{card.body}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PerformanceRadar({ comparison }) {
  const { userNames, metricRows } = comparison;

  // Normalize each metric 0–100 relative to its max
  const radarData = metricRows.filter(r => !r.metric.toLowerCase().includes("duration")).map(row => {
    const max = Math.max(...row.values, 1);
    const entry = { metric: row.metric.replace(" (%)", "").replace("Unique ", "").replace("Peak ", "Pk ").replace("Avg ", "Avg ").replace("Stayed to close", "Retention").replace("Show-up rate", "Show-up").replace("Registrants", "Regs") };
    userNames.forEach((n, i) => { entry[n] = +((row.values[i] / max) * 100).toFixed(0); });
    return entry;
  });

  return (
    <div>
      <Panel
        title="Performance fingerprint"
        accent="05 / RADAR"
        info={{
          purpose: "This radar chart gives each webinar a multi-metric performance shape.",
          read: "Each spoke is a metric normalized from 0 to 100. A webinar reaches the outer edge on metrics where it leads the comparison.",
          lookFor: "A larger, more balanced shape is stronger overall. A pointy shape means the webinar excelled in one area but lagged elsewhere.",
        }}
        subtitle="Each metric normalised to 0–100 (100 = best performer on that metric). Larger area = stronger webinar overall."
      >
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="var(--rule)" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: "var(--text-dim)" }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", fill: "var(--text-faint)" }} tickCount={4} />
            <Tooltip content={<TT formatter={(v) => `${v}/100`} />} />
            <Legend wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, paddingTop: 10 }} />
            {userNames.map((n, i) => (
              <Radar key={i} name={n} dataKey={n} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.12} strokeWidth={2} />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </Panel>
      <Rec items={[
        "The webinar whose radar area is largest overall is your benchmark — it executed better across all dimensions simultaneously.",
        "A pointy radar shape (strong on 1–2 metrics, weak on others) indicates an imbalanced webinar — great content but poor marketing, or vice versa.",
        "If two webinars overlap heavily, the differentiating metric determines which list converts better — focus follow-up resources on the webinar with higher retention.",
      ]} />
    </div>
  );
}

// =====================================================================
// 06 / WINNER CALLOUT
// =====================================================================

function WinnerCallout({ comparison }) {
  const { userNames, metricRows } = comparison;
  return (
    <div>
      <Panel
        title="Where each webinar wins"
        accent="06 / QUICK READ"
        info={{
          purpose: "This panel summarizes the clearest wins for each webinar.",
          read: "Each box lists the metrics where that webinar beat the others and shows a normalized overall score.",
          lookFor: "Use this as the quick executive read: which webinar won, where it won, and what should be copied next time.",
        }}
        subtitle="The metrics where each webinar leads all others."
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(userNames.length, 3)}, 1fr)`, gap: 16 }}>
          {userNames.map((name, i) => {
            const wins = metricRows
              .filter((row) => {
                const max = Math.max(...row.values);
                return row.values[i] === max && new Set(row.values).size > 1;
              })
              .map((row) => ({ metric: row.metric, value: row.values[i] }));

            // Score = sum of normalised wins
            const score = metricRows.reduce((acc, row) => {
              const max = Math.max(...row.values, 1);
              return acc + (row.values[i] / max) * 100;
            }, 0);
            const avgScore = (score / metricRows.length).toFixed(0);

            return (
              <div key={i} style={{ border: `2px solid ${COLORS[i]}`, background: "var(--panel-hi)", padding: 18 }}>
                <div className="mono" style={{ fontSize: 9.5, letterSpacing: 1.5, color: COLORS[i], textTransform: "uppercase" }}>
                  {name}
                </div>
                <div className="serif" style={{ fontSize: 28, marginTop: 8, fontWeight: 400, color: "var(--text)" }}>
                  {avgScore}<span style={{ fontSize: 14, color: "var(--text-dim)" }}>/100</span>
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2, marginBottom: 12 }}>
                  overall score
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, marginBottom: 6 }}>
                  WINS ON:
                </div>
                {wins.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No outright wins</div>
                ) : (
                  wins.map((w, k) => (
                    <div key={k} style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                      <span>{w.metric}</span>
                      <span style={{ color: COLORS[i], fontFamily: "JetBrains Mono, monospace" }}>
                        {w.metric.includes("%") ? fmtPct(w.value) : fmtNum(w.value)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </Panel>
      <Rec items={[
        "The webinar with the highest overall score is your template — document what made it work: topic, day/time, email sequence, presenter style.",
        "Use winner analysis to split follow-up: audience from the high show-up webinar gets a 'hot lead' sequence; audience from the high-retention webinar gets a 'deep interest' nurture.",
        "If scores are close (within 10 points), the differentiating factor is likely execution quality, not content — standardize your production checklist.",
      ]} />
    </div>
  );
}

// =====================================================================
// MAIN
// =====================================================================

export default function ComparisonView({ comparison, insights }) {
  if (!comparison) return null;
  const { userNames } = comparison;

  return (
    <div className="flex-col" style={{ gap: 28 }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 28px",
          background: "var(--panel)",
          border: "1px solid var(--border-hi)",
          borderLeft: "4px solid var(--accent)",
        }}
      >
        <div className="kicker" style={{ marginBottom: 6 }}>◆ COMPARISON · {userNames.length} WEBINARS</div>
        <h2 className="serif" style={{ fontSize: 30, fontWeight: 400, margin: 0, letterSpacing: "-0.5px" }}>
          Side-by-side: <em style={{ color: "var(--accent)" }}>{userNames.join(" vs ")}</em>
        </h2>
        <p className="text-dim" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          11 panels · metrics · curves · chat signals · engagement depth · issues · conversion · timeline · smart insights
        </p>
      </div>

      <MetricsTable comparison={comparison} />
      <ConcurrentCurves comparison={comparison} />
      <ChatTopicComparison comparison={comparison} />
      <EngagementComparison comparison={comparison} insights={insights} />
      <SessionQualityScorecards comparison={comparison} insights={insights} />
      <IssueHeatmap comparison={comparison} insights={insights} />
      <ConversionSignals comparison={comparison} insights={insights} />
      <MomentImpact comparison={comparison} insights={insights} />
      <SmartInsights comparison={comparison} insights={insights} />
      <PerformanceRadar comparison={comparison} />
      <WinnerCallout comparison={comparison} />
    </div>
  );
}
