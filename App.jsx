import React, { useEffect, useRef, useState } from "react";
import SetupWizard from "./components/SetupWizard.jsx";
import UserDashboard from "./components/UserDashboard.jsx";
import ComparisonView from "./components/ComparisonView.jsx";
import CombinedDataView from "./components/CombinedDataView.jsx";
import { parseAttendeeCSV, parseChatLog, parseAttendanceCount } from "./lib/parsers.js";
import { buildInsights, buildComparison, sanitizeInsights } from "./lib/insights.js";
import { exportChartNodesToPpt } from "./lib/pptExport.js";
import { saveSession, listSessions, loadSession, deleteSession } from "./lib/api.js";
import BatchCompare from "./components/BatchCompare.jsx";

// ─── Past Sessions Page ───────────────────────────────────────────────────────
function PastSessions({ onLoad, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this session permanently?")) return;
    setDeleting(id);
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      alert("Delete failed: " + e.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: 32 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn" onClick={onBack}>← Back</button>
          <div>
            <div className="kicker" style={{ marginBottom: 2 }}>SAVED SESSIONS</div>
            <h2 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 500 }}>Past webinar uploads</h2>
          </div>
        </div>

        {loading && <p className="mono text-dim" style={{ fontSize: 12 }}>Loading from database…</p>}
        {error && (
          <div className="panel" style={{ padding: 20, borderLeft: "3px solid var(--accent)" }}>
            <p style={{ color: "var(--accent)", margin: 0, fontSize: 13 }}>⚠ Could not reach server: {error}</p>
            <p className="text-dim" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
              Make sure the backend is running: <code>npm run server</code>
            </p>
          </div>
        )}
        {!loading && !error && sessions.length === 0 && (
          <div className="panel" style={{ padding: 32, textAlign: "center" }}>
            <p className="text-dim" style={{ margin: 0 }}>No sessions saved yet. Upload files to save your first session.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sessions.map((s) => (
            <div key={s.id} className="panel" style={{ padding: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="mono text-faint" style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 4 }}>
                  #{s.id} · {new Date(s.uploaded_at).toLocaleString()}
                  {s.webinar_date && <span style={{ marginLeft: 10, color: "var(--blue)" }}>📅 {s.webinar_date}</span>}
                  {s.batch_label && <span style={{ marginLeft: 10, color: "var(--purple)" }}>⚖ {s.batch_label}</span>}
                  {s.lead_type && s.lead_type !== "unknown" && (
                    <span style={{ marginLeft: 10, color: s.lead_type === "paid" ? "var(--green)" : "var(--amber)", textTransform: "uppercase" }}>
                      ● {s.lead_type}
                    </span>
                  )}
                </div>
                <div className="serif" style={{ fontSize: 18, fontWeight: 500 }}>{s.user_name}</div>
                <div className="text-dim" style={{ fontSize: 12, marginTop: 2 }}>{s.topic}</div>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <div style={{ textAlign: "center" }}>
                  <div className="mono text-faint" style={{ fontSize: 9, letterSpacing: 1.5 }}>REGISTERED</div>
                  <div className="serif" style={{ fontSize: 20, fontWeight: 500 }}>{s.registrants?.toLocaleString("en-IN") ?? "—"}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div className="mono text-faint" style={{ fontSize: 9, letterSpacing: 1.5 }}>PEAK LIVE</div>
                  <div className="serif" style={{ fontSize: 20, fontWeight: 500 }}>{s.peak_live?.toLocaleString("en-IN") ?? "—"}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div className="mono text-faint" style={{ fontSize: 9, letterSpacing: 1.5 }}>SHOW-UP</div>
                  <div className="serif" style={{ fontSize: 20, fontWeight: 500, color: "var(--green)" }}>
                    {s.show_up_rate != null ? `${parseFloat(s.show_up_rate).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 11 }} onClick={() => onLoad(s.id)}>
                  Load dashboard
                </button>
                <button
                  className="btn"
                  style={{ padding: "8px 12px", fontSize: 11, color: "var(--accent)", borderColor: "var(--accent)" }}
                  disabled={deleting === s.id}
                  onClick={() => handleDelete(s.id)}
                >
                  {deleting === s.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [stage, setStage]                   = useState("setup");
  const [progress, setProgress]             = useState("");
  const [allInsights, setAllInsights]       = useState([]);
  const [comparison, setComparison]         = useState(null);
  const [errorMsg, setErrorMsg]             = useState("");
  const [tab, setTab]                       = useState(0);
  const [theme, setTheme]                   = useState("dark");
  const [exportingPpt, setExportingPpt]     = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [chartOptions, setChartOptions]     = useState([]);
  const [selectedChartIds, setSelectedChartIds] = useState([]);
  const [exportError, setExportError]       = useState("");
  const [setupView, setSetupView]           = useState("count");
  const [saveStatus, setSaveStatus]         = useState("");
  const exportRefs = useRef({});

  const themeToggle = (
    <div className="top-actions">
      {stage === "setup" && setupView === "count" && (
        <button type="button" className="top-action-btn" onClick={() => setSetupView("webinars")}>
          Upload
        </button>
      )}
      {stage === "setup" && (
        <button type="button" className="top-action-btn" onClick={() => setStage("past")}>
          📂 Past Sessions
        </button>
      )}
      {stage === "setup" && (
        <button type="button" className="top-action-btn" onClick={() => setStage("batchCompare")}>
          ⚖ Batch Compare
        </button>
      )}
      <button
        type="button"
        className="top-action-btn theme-toggle"
        onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
      >
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
    </div>
  );

  // ── handleSubmit ─────────────────────────────────────────────────
  // Called in two ways:
  // 1. users = upload form entries → parse files + save to DB
  // 2. users = ins objects from DB (fromDatabase=true) → skip parsing
  const handleSubmit = async (users, fromDatabase = false) => {
    if (fromDatabase) {
      // Already ins objects — just sanitize and show
      const insightsList = users.map((ins) => sanitizeInsights(ins));
      setAllInsights(insightsList);
      setComparison(insightsList.length > 1 ? buildComparison(insightsList) : null);
      setTab(0);
      setStage("dashboard");
      return;
    }

    setStage("processing");
    try {
      const insightsList = [];
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        setProgress(`Parsing ${u.name} — attendee CSV...`);
        const att = await parseAttendeeCSV(u.attendeeFile);
        setProgress(`Parsing ${u.name} — chat log...`);
        const chat = await parseChatLog(u.chatFile);
        setProgress(`Parsing ${u.name} — live count...`);
        const cnt = await parseAttendanceCount(u.countFile);
        setProgress(`Building insights for ${u.name}...`);
        const ins = buildInsights({
          userName: u.name,
          attendee: att,
          chat,
          attendanceCount: cnt,
        });
        // Attach webinar date + lead type and sanitize (ensures meta.start is a Date)
        ins.webinarDate = u.webinarDate || null;
        ins.leadType    = u.leadType || "unknown";
        insightsList.push(sanitizeInsights(ins));
      }

      setAllInsights(insightsList);
      if (insightsList.length > 1) {
        setProgress("Building comparison...");
        setComparison(buildComparison(insightsList));
      }
      setTab(0);
      setStage("dashboard");

      // Save to MySQL in the background
      setSaveStatus("saving");
      try {
        for (const ins of insightsList) {
          await saveSession(ins);
        }
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 4000);
      } catch (saveErr) {
        console.warn("Could not save to database:", saveErr.message);
        setSaveStatus("failed");
        setTimeout(() => setSaveStatus(""), 6000);
      }

    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || "Something went wrong while parsing your files.");
      setStage("error");
    }
  };

  const handleLoadSession = async (id) => {
    setStage("processing");
    setProgress("Loading from database…");
    try {
      const ins = await loadSession(id);
      setAllInsights([sanitizeInsights(ins)]);
      setComparison(null);
      setTab(0);
      setStage("dashboard");
    } catch (e) {
      setErrorMsg(e.message || "Failed to load session.");
      setStage("error");
    }
  };

  const reset = () => {
    setAllInsights([]);
    setComparison(null);
    setStage("setup");
    setErrorMsg("");
    setExportError("");
    setExportMenuOpen(false);
    setChartOptions([]);
    setSelectedChartIds([]);
    setSetupView("count");
    setSaveStatus("");
  };

  const exportTargets = [
    ...allInsights.map((ins, i) => ({
      key: `user-${i}`,
      label: ins.userName,
      num: String(i + 1).padStart(2, "0"),
      type: "user",
      insights: ins,
    })),
    ...(allInsights.length > 1 ? [{ key: "combined", label: "Combined Data", num: "ALL", type: "combined" }] : []),
    ...(comparison ? [{ key: "comparison", label: "Comparison", num: "CMP", type: "comparison" }] : []),
  ];
  const shouldRenderExportDock = exportMenuOpen || exportingPpt;

  useEffect(() => {
    if (!exportMenuOpen) return undefined;
    const timer = window.setTimeout(() => {
      const options = [];
      exportTargets.forEach((target) => {
        const root = exportRefs.current[target.key];
        if (!root) return;
        root.querySelectorAll(".ppt-chart").forEach((node, chartIndex) => {
          const title = node.getAttribute("data-ppt-title") || `Chart ${chartIndex + 1}`;
          options.push({
            id: `${target.key}::${chartIndex}`,
            targetKey: target.key,
            chartIndex,
            group: `${target.num} ${target.label}`,
            title,
          });
        });
      });
      setChartOptions(options);
      setSelectedChartIds((current) => (current.length ? current : options.map((o) => o.id)));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [exportMenuOpen, allInsights.length, comparison]);

  // ── Render: setup ────────────────────────────────────────────────
  if (stage === "setup") {
    return (
      <div data-theme={theme} style={{ minHeight: "100vh" }}>
        {themeToggle}
        <SetupWizard onSubmit={handleSubmit} view={setupView} onViewChange={setSetupView} />
      </div>
    );
  }

  // ── Render: past sessions ────────────────────────────────────────
  if (stage === "past") {
    return (
      <div data-theme={theme} style={{ minHeight: "100vh" }}>
        <div className="top-actions">
          <button type="button" className="top-action-btn theme-toggle"
            onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
        <PastSessions onLoad={handleLoadSession} onBack={() => setStage("setup")} />
      </div>
    );
  }

  // ── Render: batch compare panel ──────────────────────────────────
  if (stage === "batchCompare") {
    return (
      <div data-theme={theme} style={{ minHeight: "100vh" }}>
        <div className="top-actions">
          <button type="button" className="top-action-btn theme-toggle"
            onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
        <BatchCompare onBack={() => setStage("setup")} />
      </div>
    );
  }

  // ── Render: processing ───────────────────────────────────────────
  if (stage === "processing") {
    return (
      <div data-theme={theme} style={{ minHeight: "100vh" }}>
        {themeToggle}
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div className="fadein" style={{ textAlign: "center", maxWidth: 480 }}>
            <div className="mono" style={{ color: "var(--accent)", fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
              ◆ PROCESSING
            </div>
            <h2 className="serif" style={{ fontSize: 32, fontWeight: 500, margin: 0, letterSpacing: "-0.5px" }}>
              Crunching your <em style={{ color: "var(--accent)" }}>numbers</em>...
            </h2>
            <p className="text-dim mono" style={{ fontSize: 12, marginTop: 24, letterSpacing: 1 }}>{progress}</p>
            <div style={{ width: 200, height: 2, background: "var(--rule)", margin: "32px auto 0", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "var(--accent)", animation: "indet 1.4s ease-in-out infinite", transformOrigin: "left" }} />
            </div>
            <style>{`@keyframes indet{0%{transform:translateX(-100%) scaleX(.4)}50%{transform:translateX(40%) scaleX(.6)}100%{transform:translateX(120%) scaleX(.4)}}`}</style>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: error ────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div data-theme={theme} style={{ minHeight: "100vh" }}>
        {themeToggle}
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div className="panel" style={{ maxWidth: 540, padding: 28 }}>
            <div className="kicker" style={{ marginBottom: 4 }}>SOMETHING BROKE</div>
            <h2 className="serif" style={{ fontSize: 24, margin: "8px 0 12px", fontWeight: 500 }}>
              Couldn't process those files
            </h2>
            <p className="text-dim" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{errorMsg}</p>
            <button className="btn btn-primary" onClick={reset}>Start over</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: dashboard ────────────────────────────────────────────
  const tabs = allInsights.map((ins, i) => ({ id: i, label: ins.userName, num: String(i + 1).padStart(2, "0") }));
  if (allInsights.length > 1) tabs.push({ id: "combined", label: "Combined Data", num: "ALL" });
  if (comparison) tabs.push({ id: "cmp", label: "Comparison", num: "◆" });

  const handleExportPpt = async () => {
    const selected = chartOptions.filter((o) => selectedChartIds.includes(o.id));
    if (!selected.length) { setExportError("Select at least one chart to export."); return; }
    setExportError("");
    setExportingPpt(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const charts = selected
        .map((o) => ({ ...o, node: exportRefs.current[o.targetKey]?.querySelectorAll(".ppt-chart")?.[o.chartIndex] }))
        .filter((o) => o.node);
      await exportChartNodesToPpt({ charts, fileName: `${allInsights.length}-webinar-insights-selected-charts` });
      setExportMenuOpen(false);
    } catch (e) {
      console.error(e);
      setExportError(e.message || "Could not create the PowerPoint export.");
    } finally {
      setExportingPpt(false);
    }
  };

  return (
    <div data-theme={theme} style={{ minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--panel)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "12px 32px 10px" }}>
          <div className="flex" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ minWidth: 260, flex: "1 1 520px" }}>
              <div className="kicker" style={{ marginBottom: 2, fontSize: 9, letterSpacing: 3 }}>◆ WEBINAR INSIGHTS · LOCAL ANALYZER</div>
              <h1 className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.4px", margin: 0, lineHeight: 1.05 }}>
                {allInsights.length === 1 ? allInsights[0].meta.topic : `${allInsights.length} webinars analyzed`}
                {" "}<em style={{ color: "var(--accent)" }}>·</em>
              </h1>
              <p className="text-dim" style={{ fontSize: 11, marginTop: 3, marginBottom: 0 }}>
                {allInsights.length === 1 ? allInsights[0].userName : `${tabs.length} tabs · click any tab to switch view`}
                {saveStatus === "saving" && <span className="mono" style={{ marginLeft: 12, color: "var(--amber)", fontSize: 10 }}>● Saving…</span>}
                {saveStatus === "saved"  && <span className="mono" style={{ marginLeft: 12, color: "var(--green)", fontSize: 10 }}>✓ Saved to database</span>}
                {saveStatus === "failed" && <span className="mono" style={{ marginLeft: 12, color: "var(--accent)", fontSize: 10 }}>⚠ Save failed — check backend</span>}
              </p>
            </div>
            <button type="button" className="btn" style={{ padding: "8px 12px", fontSize: 11 }} onClick={() => setStage("past")}>📂 Past Sessions</button>
            <button type="button" className="btn" style={{ padding: "8px 12px", fontSize: 11 }} onClick={() => setStage("batchCompare")}>⚖ Batch Compare</button>
            <button type="button" className="btn" onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))} style={{ padding: "8px 12px", fontSize: 11 }}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button className="btn" onClick={reset} style={{ padding: "8px 12px", fontSize: 11 }}>↺ Start over</button>
          </div>
          {exportError && <div className="mono" style={{ color: "var(--accent)", fontSize: 10, marginTop: 8 }}>{exportError}</div>}
        </div>

        <div style={{ background: "var(--panel)" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px 8px", overflowX: "auto" }}>
            <nav style={{ display: "flex" }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ padding: "7px 12px", background: tab === t.id ? "var(--panel-hi)" : "transparent", border: `1px solid ${tab === t.id ? "var(--border-hi)" : "transparent"}`, borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`, color: tab === t.id ? "var(--text)" : "var(--text-dim)", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}
                  onMouseEnter={(e) => { if (tab !== t.id) e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { if (tab !== t.id) e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  <span className="mono" style={{ color: tab === t.id ? "var(--accent)" : "var(--text-faint)", fontSize: 10, letterSpacing: 1 }}>{t.num}</span>
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 32px 32px" }}>
        <div className="fadein" key={tab}>
          {tab === "combined" ? (
            <CombinedDataView insights={allInsights} />
          ) : tab === "cmp" ? (
            <ComparisonView comparison={comparison} insights={allInsights} />
          ) : (
            <UserDashboard insights={allInsights[tab]} />
          )}
        </div>
      </main>

      {exportMenuOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 760 }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <div className="kicker" style={{ marginBottom: 6 }}>PPT EXPORT</div>
                <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 400 }}>Select charts</h2>
                <p className="text-dim" style={{ margin: "4px 0 0", fontSize: 12 }}>{selectedChartIds.length} of {chartOptions.length} selected</p>
              </div>
              <button type="button" className="chart-info-btn" aria-label="Close export picker" onClick={() => setExportMenuOpen(false)}>×</button>
            </div>
            <div style={{ padding: 20, display: "flex", gap: 10, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => setSelectedChartIds(chartOptions.map((o) => o.id))}>Select all</button>
              <button type="button" className="btn" onClick={() => setSelectedChartIds([])}>Clear</button>
              <button type="button" className="btn btn-primary" onClick={handleExportPpt} disabled={exportingPpt || !chartOptions.length} style={{ marginLeft: "auto" }}>
                {exportingPpt ? "Preparing PPT..." : "Download selected"}
              </button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", maxHeight: "58vh" }}>
              {!chartOptions.length ? (
                <div className="text-dim mono" style={{ fontSize: 11 }}>Loading chart list...</div>
              ) : exportTargets.map((target) => {
                const groupOptions = chartOptions.filter((o) => o.targetKey === target.key);
                if (!groupOptions.length) return null;
                return (
                  <section key={target.key} style={{ marginBottom: 18 }}>
                    <div className="kicker" style={{ marginBottom: 8 }}>{target.num} {target.label}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                      {groupOptions.map((option) => {
                        const checked = selectedChartIds.includes(option.id);
                        return (
                          <label key={option.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`, background: checked ? "var(--accent-soft)" : "var(--panel-hi)", cursor: "pointer", minHeight: 44 }}>
                            <input type="checkbox" checked={checked} onChange={() => {
                              setSelectedChartIds((current) => checked ? current.filter((id) => id !== option.id) : [...current, option.id]);
                            }} />
                            <span style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.3 }}>{option.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {shouldRenderExportDock && (
        <div aria-hidden="true" className="ppt-export-dock" style={{ position: "fixed", left: -20000, top: 0, width: 1400, background: "var(--bg)", color: "var(--text)", pointerEvents: "none", zIndex: -1 }}>
          {exportTargets.map((target) => (
            <div key={target.key} ref={(node) => { if (node) exportRefs.current[target.key] = node; }} className="ppt-export-page" style={{ width: 1400, padding: "24px 32px 32px", background: "var(--bg)" }}>
              {target.type === "combined" ? (
                <CombinedDataView insights={allInsights} />
              ) : target.type === "comparison" ? (
                <ComparisonView comparison={comparison} insights={allInsights} />
              ) : (
                <UserDashboard insights={target.insights} exportMode />
              )}
            </div>
          ))}
        </div>
      )}

      <footer className="mono" style={{ borderTop: "1px solid var(--border)", padding: "24px 32px", marginTop: 40, color: "var(--text-faint)", fontSize: 11, textAlign: "center", letterSpacing: 1 }}>
        Processed in your browser · saved to your local MySQL database
      </footer>
    </div>
  );
}