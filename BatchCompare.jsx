import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, Play, Users, TrendingUp, TrendingDown } from "lucide-react";
import { listBatches, compareBatches } from "../lib/api.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n) =>
  n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("en-IN");
const fmtPct = (n, d = 1) =>
  n == null || isNaN(n) ? "—" : `${(+n).toFixed(d)}%`;

// Pretty date range like "May 10 to 16"
function formatBatchRange(startDate, endDate) {
  if (!startDate) return "";
  // Parse as local date to avoid UTC timezone shift
  // startDate can be a string "2026-05-03" or a Date object from MySQL
  const parseLocal = (val) => {
    if (!val) return null;
    const str = String(val).substring(0, 10); // "YYYY-MM-DD"
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d); // local timezone, no shift
  };
  const s = parseLocal(startDate);
  const e = parseLocal(endDate);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sM = months[s.getMonth()];
  const sD = s.getDate();
  if (!e) return `${sM} ${sD}`;
  const eM = months[e.getMonth()];
  const eD = e.getDate();
  return s.getMonth() === e.getMonth() ? `${sM} ${sD} to ${eD}` : `${sM} ${sD} to ${eM} ${eD}`;
}

// Compute % delta of B vs A
function deltaPct(a, b) {
  if (a == null || isNaN(a) || a === 0) return null;
  return ((b - a) / a) * 100;
}

// ─── Group selection card (Group A or Group B) ───────────────────────────────
function GroupSelector({ title, groupColor, batches, selected, onToggle }) {
  const sessionCount = selected.reduce((sum, label) => {
    const b = batches.find((x) => x.batch_label === label);
    return sum + (b?.session_count || 0);
  }, 0);

  return (
    <div className="panel" style={{ padding: 18 }}>
      <div className="flex" style={{ alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: groupColor }} />
        <div className="serif" style={{ fontSize: 18, fontWeight: 500 }}>{title}</div>
        <div className="text-dim mono" style={{ marginLeft: "auto", fontSize: 10, letterSpacing: 1 }}>
          {selected.length} weeks · {sessionCount} sessions
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="text-dim" style={{ fontSize: 12, padding: 12, textAlign: "center" }}>
          No batches available yet. Upload sessions first.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {batches.map((b) => {
            const active = selected.includes(b.batch_label);
            return (
              <button
                key={b.batch_label}
                type="button"
                onClick={() => onToggle(b.batch_label)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  background: active ? "var(--panel-hi)" : "transparent",
                  border: `1px solid ${active ? groupColor : "var(--border)"}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <input type="checkbox" checked={active} readOnly style={{ accentColor: groupColor, marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  {/* Workshop names — W1, W2 etc */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: active ? groupColor : "var(--text)", marginBottom: 3 }}>
                    {b.workshop_names || "—"}
                  </div>
                  {/* Batch label + date range */}
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {b.batch_label}
                    <span style={{ marginLeft: 8, color: "var(--text-faint)" }}>
                      — {formatBatchRange(b.start_date, b.end_date)}
                    </span>
                  </div>
                  {/* Session counts */}
                  <div className="mono" style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3 }}>
                    {b.session_count} sessions · {b.free_count} free, {b.paid_count} paid
                    {b.unknown_count > 0 && `, ${b.unknown_count} unknown`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── KPI delta tile ──────────────────────────────────────────────────────────
function DeltaKPI({ label, valueA, valueB, formatter = fmtNum, suffix = "", invertGood = false }) {
  const delta = deltaPct(valueA, valueB);
  const isGood = delta == null
    ? null
    : (invertGood ? delta < 0 : delta > 0);
  const deltaColor = delta == null ? "var(--text-faint)" : (isGood ? "var(--green)" : "var(--accent)");

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div className="text-dim mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div className="flex" style={{ alignItems: "baseline", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span className="serif" style={{ fontSize: 28, fontWeight: 500, color: "var(--blue)" }}>{formatter(valueA)}</span>
          <span className="text-dim mono" style={{ fontSize: 10 }}>A{suffix}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span className="serif" style={{ fontSize: 28, fontWeight: 500, color: "var(--purple)" }}>{formatter(valueB)}</span>
          <span className="text-dim mono" style={{ fontSize: 10 }}>B{suffix}</span>
        </div>
        {delta != null && (
          <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: deltaColor, display: "flex", alignItems: "center", gap: 4 }}>
            {isGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            B {delta > 0 ? "+" : ""}{delta.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BatchCompare({ onBack, onLoadComparison }) {
  const [batches, setBatches]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState("");
  const [groupA, setGroupA]         = useState([]);
  const [groupB, setGroupB]         = useState([]);
  const [audience, setAudience]     = useState("all");
  const [results, setResults]       = useState(null);
  const [running, setRunning]       = useState(false);
  const [runError, setRunError]     = useState("");

  // Load batches on mount
  useEffect(() => {
    listBatches()
      .then(setBatches)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleA = (label) => {
    setGroupA((cur) => cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]);
    // Remove from B if user selects in A
    setGroupB((cur) => cur.filter((x) => x !== label));
  };
  const toggleB = (label) => {
    setGroupB((cur) => cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]);
    setGroupA((cur) => cur.filter((x) => x !== label));
  };

  const canRun = groupA.length > 0 && groupB.length > 0 && !running;

  const runCompare = async () => {
    setRunError("");
    setRunning(true);
    try {
      const data = await compareBatches({ groupA, groupB, audience });
      setResults(data);
    } catch (e) {
      setRunError(e.message || "Failed to compare batches.");
      setResults(null);
    } finally {
      setRunning(false);
    }
  };

  // Audience filter buttons
  const audienceButtons = [
    { value: "all",  label: "All" },
    { value: "free", label: "Free leads" },
    { value: "paid", label: "Paid leads" },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: 32 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }} className="fadein">
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex" style={{ alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
          <button className="btn" onClick={onBack}>
            <ArrowLeft size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Back
          </button>
          <div>
            <div className="kicker" style={{ marginBottom: 4 }}>BATCH COMPARISON</div>
            <h2 className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 500 }}>
              Compare sessions
            </h2>
            <p className="text-dim" style={{ fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Pick weeks on each side. Combined metrics for each group are compared below.
            </p>
          </div>
        </div>

        {loading && <p className="mono text-dim" style={{ fontSize: 12 }}>Loading batches…</p>}

        {loadError && (
          <div className="panel" style={{ padding: 18, borderLeft: "3px solid var(--accent)", marginBottom: 18 }}>
            <p style={{ color: "var(--accent)", margin: 0, fontSize: 13 }}>⚠ Could not load batches: {loadError}</p>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {/* ── Group A vs Group B selectors ─────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
              <GroupSelector
                title="Group A"
                groupColor="var(--blue)"
                batches={batches}
                selected={groupA}
                onToggle={toggleA}
              />
              <GroupSelector
                title="Group B"
                groupColor="var(--purple)"
                batches={batches}
                selected={groupB}
                onToggle={toggleB}
              />
            </div>

            {/* ── Audience filter + Run button ─────────────────────── */}
            <div className="panel" style={{ padding: 16, marginBottom: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div className="flex" style={{ gap: 10, alignItems: "center" }}>
                <Users size={14} color="var(--text-dim)" />
                <span className="mono" style={{ fontSize: 11, letterSpacing: 1, color: "var(--text-dim)" }}>AUDIENCE:</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {audienceButtons.map((opt) => {
                    const active = audience === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAudience(opt.value)}
                        style={{
                          padding: "6px 14px",
                          fontSize: 11,
                          fontWeight: 500,
                          background: active ? "var(--accent)" : "var(--panel-hi)",
                          color: active ? "#fff" : "var(--text-dim)",
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={runCompare}
                disabled={!canRun}
                style={{ marginLeft: "auto", padding: "10px 20px", fontSize: 12 }}
              >
                <Play size={12} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {running ? "Running…" : "Run comparison"}
              </button>
            </div>

            {runError && (
              <div className="panel" style={{ padding: 14, borderLeft: "3px solid var(--accent)", marginBottom: 18 }}>
                <p style={{ color: "var(--accent)", margin: 0, fontSize: 13 }}>⚠ {runError}</p>
              </div>
            )}

            {/* ── Comparison results ───────────────────────────────── */}
            {results && (
              <div className="panel" style={{ padding: 24 }}>
                <div className="flex" style={{ alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                  <h3 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>
                    Comparison results
                  </h3>
                  <div className="text-dim mono" style={{ fontSize: 10, letterSpacing: 1.5 }}>
                    {results.groupA.weekCount} weeks vs {results.groupB.weekCount} weeks · {results.audience === "all" ? "all audiences" : `${results.audience} leads`}
                  </div>
                </div>

                {/* KPI grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 18 }}>
                  <DeltaKPI label="Total attendees"        valueA={results.groupA.totalAttendees}        valueB={results.groupB.totalAttendees} />
                  <DeltaKPI label="Avg attendance / session" valueA={results.groupA.avgAttendancePerSession} valueB={results.groupB.avgAttendancePerSession} />
                  <DeltaKPI label="Avg engagement score"   valueA={results.groupA.engagementScore}       valueB={results.groupB.engagementScore} />
                  <DeltaKPI label="Drop-off rate"          valueA={results.groupA.dropOffRate}           valueB={results.groupB.dropOffRate} formatter={(n) => `${(+n).toFixed(0)}%`} invertGood />
                  <DeltaKPI label="Total registrants"      valueA={results.groupA.totalRegistrants}      valueB={results.groupB.totalRegistrants} />
                  <DeltaKPI label="Avg show-up rate"       valueA={results.groupA.avgShowupRate}         valueB={results.groupB.avgShowupRate} formatter={(n) => `${(+n).toFixed(1)}%`} />
                  <DeltaKPI label="Total chat participants" valueA={results.groupA.totalChatters}        valueB={results.groupB.totalChatters} />
                  <DeltaKPI label="Total chat messages"    valueA={results.groupA.totalChat}             valueB={results.groupB.totalChat} />
                </div>

                {/* Audience breakdown */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
                  <div className="kicker" style={{ marginBottom: 10 }}>AUDIENCE BREAKDOWN — ATTENDANCE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div className="panel" style={{ padding: 12, background: "var(--panel-hi)" }}>
                      <div className="text-dim mono" style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 6 }}>FREE LEADS</div>
                      <div className="flex" style={{ alignItems: "baseline", gap: 12 }}>
                        <span className="serif" style={{ fontSize: 22, fontWeight: 500, color: "var(--blue)" }}>{fmtNum(results.groupA.freeAttendees)}</span>
                        <span className="text-dim mono" style={{ fontSize: 10 }}>vs</span>
                        <span className="serif" style={{ fontSize: 22, fontWeight: 500, color: "var(--purple)" }}>{fmtNum(results.groupB.freeAttendees)}</span>
                        {(() => {
                          const d = deltaPct(results.groupA.freeAttendees, results.groupB.freeAttendees);
                          return d != null && (
                            <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: d >= 0 ? "var(--green)" : "var(--accent)" }}>
                              B {d > 0 ? "+" : ""}{d.toFixed(0)}%
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="panel" style={{ padding: 12, background: "var(--panel-hi)" }}>
                      <div className="text-dim mono" style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 6 }}>PAID LEADS</div>
                      <div className="flex" style={{ alignItems: "baseline", gap: 12 }}>
                        <span className="serif" style={{ fontSize: 22, fontWeight: 500, color: "var(--blue)" }}>{fmtNum(results.groupA.paidAttendees)}</span>
                        <span className="text-dim mono" style={{ fontSize: 10 }}>vs</span>
                        <span className="serif" style={{ fontSize: 22, fontWeight: 500, color: "var(--purple)" }}>{fmtNum(results.groupB.paidAttendees)}</span>
                        {(() => {
                          const d = deltaPct(results.groupA.paidAttendees, results.groupB.paidAttendees);
                          return d != null && (
                            <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: d >= 0 ? "var(--green)" : "var(--accent)" }}>
                              B {d > 0 ? "+" : ""}{d.toFixed(0)}%
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session counts breakdown */}
                <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--panel-hi)", border: "1px solid var(--border)", borderRadius: 4 }}>
                  <div className="text-dim mono" style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 6 }}>SESSION COUNT BY LEAD TYPE</div>
                  <div className="flex" style={{ gap: 24, fontSize: 12, flexWrap: "wrap" }}>
                    <span><span style={{ color: "var(--blue)" }}>Group A:</span> {results.groupA.freeSessionCount} free, {results.groupA.paidSessionCount} paid ({results.groupA.sessionCount} total)</span>
                    <span><span style={{ color: "var(--purple)" }}>Group B:</span> {results.groupB.freeSessionCount} free, {results.groupB.paidSessionCount} paid ({results.groupB.sessionCount} total)</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}