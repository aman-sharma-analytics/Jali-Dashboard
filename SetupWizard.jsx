import React, { useState } from "react";
import { Upload, Check, AlertCircle, ArrowLeft, ArrowRight, Trash2, Calendar, Users, Tag } from "lucide-react";
import { compareSessionsByDate, computeBatch } from "../lib/api.js";

// ── File slot ─────────────────────────────────────────────────────────────────
const FileSlot = ({ label, hint, file, onChange, accept }) => {
  const inputRef = React.useRef();
  return (
    <div
      style={{
        border: `1px solid ${file ? "var(--green)" : "var(--border)"}`,
        background: file ? "rgba(63,185,80,0.05)" : "var(--panel-hi)",
        padding: 14,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }}
      />
      <div className="flex" style={{ gap: 10, alignItems: "center" }}>
        {file ? <Check size={18} color="var(--green)" /> : <Upload size={18} color="var(--text-dim)" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--text-dim)", textTransform: "uppercase" }}>
            {label}
          </div>
          <div style={{ fontSize: 13, color: file ? "var(--text)" : "var(--text-dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file ? file.name : hint}
          </div>
        </div>
        {file && (
          <button onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--text-faint)" }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// ── User card — now includes a date picker ────────────────────────────────────
const UserCard = ({ index, user, onUpdate, error }) => {
  return (
    <div className="panel" style={{ padding: 24 }}>
      <div className="flex" style={{ gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div className="serif" style={{ background: "var(--accent)", color: "#fff", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600 }}>
          {index + 1}
        </div>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 2, color: "var(--text-dim)" }}>USER {index + 1}</div>
          <input
            className="input"
            placeholder={`Webinar name (e.g. "W1" or "April Webinar")`}
            value={user.name}
            onChange={(e) => onUpdate({ ...user, name: e.target.value })}
            style={{ marginTop: 4 }}
          />
        </div>

        {/* ── Date slicer ─────────────────────────────────── */}
        <div style={{ flexShrink: 0 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
            <Calendar size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Webinar date
          </div>
          <input
            type="date"
            className="input"
            style={{ width: 160 }}
            value={user.webinarDate || ""}
            onChange={(e) => onUpdate({ ...user, webinarDate: e.target.value })}
          />
        </div>
      </div>

      {/* ── Batch label preview + lead type slicer ───────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        {/* Auto-detected batch */}
        <div style={{ flex: 1, minWidth: 200, padding: "8px 12px", background: "var(--panel-hi)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 2 }}>
            <Tag size={9} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Auto-detected batch
          </div>
          {(() => {
            const b = computeBatch(user.webinarDate);
            return b ? (
              <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                {b.label} <span className="text-dim" style={{ fontSize: 11, fontWeight: 400, marginLeft: 8 }}>({b.startDate} → {b.endDate})</span>
              </div>
            ) : (
              <div className="text-dim" style={{ fontSize: 12 }}>Pick a date above to detect batch</div>
            );
          })()}
        </div>

        {/* Lead type slicer */}
        <div style={{ flexShrink: 0 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
            <Users size={9} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Lead type
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { value: "free",    label: "Free"    },
              { value: "paid",    label: "Paid"    },
              { value: "unknown", label: "Unknown" },
            ].map((opt) => {
              const active = (user.leadType || "unknown") === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdate({ ...user, leadType: opt.value })}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 500,
                    background: active ? "var(--accent)" : "var(--panel-hi)",
                    color: active ? "#fff" : "var(--text-dim)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ gap: 12 }}>
        <FileSlot label="Attendee CSV" hint="Zoom attendee report" file={user.attendeeFile} onChange={(f) => onUpdate({ ...user, attendeeFile: f })} accept=".csv" />
        <FileSlot label="Chat log"     hint="Saved meeting chat .txt" file={user.chatFile}     onChange={(f) => onUpdate({ ...user, chatFile: f })}     accept=".txt" />
        <FileSlot label="Live count"   hint="Attendance count .xlsx"  file={user.countFile}    onChange={(f) => onUpdate({ ...user, countFile: f })}    accept=".xlsx,.xls" />
      </div>

      {error && (
        <div className="flex" style={{ gap: 8, alignItems: "center", color: "var(--accent)", fontSize: 12, marginTop: 12 }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};

const WEBINAR_OPTIONS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

// ── Main SetupWizard ──────────────────────────────────────────────────────────
export default function SetupWizard({ onSubmit, view = "count", onViewChange }) {
  const [step, setStep]                     = useState(view);
  const [count, setCount]                   = useState(2);
  const [selectedWebinars, setSelectedWebinars] = useState([]);
  const [compareWebinars, setCompareWebinars]   = useState([]);
  const [compareDates, setCompareDates]         = useState([]);
  const [dateInput, setDateInput]               = useState("");
  const [sameWebinarDates, setSameWebinarDates] = useState(false);
  const [users, setUsers]                   = useState([]);
  const [errors, setErrors]                 = useState({});
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError]     = useState("");

  const activeStep = view === "webinars" ? "webinars" : step;

  const changeStep = (next) => {
    setStep(next);
    onViewChange?.(next);
  };

  // ── Webinar selection (upload flow) ───────────────────────────────
  const toggleWebinar = (option) => {
    setSelectedWebinars((cur) =>
      cur.some((i) => i.id === option.id)
        ? cur.filter((i) => i.id !== option.id)
        : [...cur, option]
    );
  };

  const startSelectedUpload = () => {
    const fresh = selectedWebinars.map(({ label }) => ({
      name: label, webinarDate: "", leadType: "unknown", attendeeFile: null, chatFile: null, countFile: null,
    }));
    setUsers(fresh);
    changeStep("upload");
  };

  // ── Compare flow ─────────────────────────────────────────────────
  const toggleCompareWebinar = (option) => {
    setCompareWebinars((cur) => {
      const exists = cur.some((i) => i.id === option.id);
      if (exists) return cur.filter((i) => i.id !== option.id);
      const limit = sameWebinarDates ? 1 : count;
      if (cur.length >= limit) return cur;
      return [...cur, option];
    });
  };

  const toggleCompareDate = (date) => {
    setCompareDates((cur) => cur.includes(date) ? cur.filter((d) => d !== date) : [...cur, date]);
  };

  const addCompareDate = () => {
    if (!dateInput) return;
    setCompareDates((cur) => cur.includes(dateInput) ? cur : [...cur, dateInput].sort());
    setDateInput("");
  };

  const toggleSameWebinarDates = () => {
    setSameWebinarDates((cur) => {
      const next = !cur;
      if (next) setCompareWebinars((items) => items.slice(0, 1));
      return next;
    });
  };

  // ── Generate Dashboard from database ─────────────────────────────
  // This is the key new feature: instead of re-uploading files,
  // it fetches the saved sessions matching the selected webinars + dates.
  const handleGenerateDashboard = async () => {
    setCompareError("");
    setCompareLoading(true);

    try {
      // Build the webinar list and date list for the API call
      let webinarNames, datesList;

      if (sameWebinarDates && compareWebinars.length === 1) {
        // Same webinar, multiple dates → W1 on date1, W1 on date2, etc.
        webinarNames = compareDates.map(() => compareWebinars[0].label);
        datesList    = compareDates;
      } else {
        // Different webinars — each needs one date
        // If fewer dates than webinars, use first date for all
        webinarNames = compareWebinars.map((w) => w.label);
        datesList    = compareWebinars.map((_, i) => compareDates[i] || compareDates[0] || "");
      }

      if (datesList.some((d) => !d)) {
        setCompareError("Please select a date for each webinar.");
        setCompareLoading(false);
        return;
      }

      // Call the backend compare endpoint
      const insightsList = await compareSessionsByDate({
        webinars: webinarNames,
        dates:    datesList,
      });

      if (!insightsList.length) {
        setCompareError("No saved sessions found for the selected webinars and dates. Upload those files first.");
        setCompareLoading(false);
        return;
      }

      // Pass the loaded insights to App.jsx — same as after a manual upload
      onSubmit(insightsList, true /* fromDatabase */);

    } catch (e) {
      setCompareError(e.message || "Failed to load sessions from database.");
    } finally {
      setCompareLoading(false);
    }
  };

  // ── Manual upload fallback from compare ───────────────────────────
  const startManualUploadFromCompare = () => {
    const base = compareWebinars.length > 0
      ? compareWebinars
      : Array.from({ length: count }, (_, i) => ({ label: `User ${i + 1}` }));
    const uploadNames = sameWebinarDates && base[0] && compareDates.length > 0
      ? compareDates.map((date) => `${base[0].label} ${date}`)
      : base.map((i) => i.label);
    setUsers(uploadNames.map((name) => ({
      name, webinarDate: "", leadType: "unknown", attendeeFile: null, chatFile: null, countFile: null,
    })));
    changeStep("upload");
  };

  // ── Upload form submit ─────────────────────────────────────────────
  const updateUser = (idx, u) => {
    setUsers((prev) => prev.map((p, i) => (i === idx ? u : p)));
    setErrors((prev) => ({ ...prev, [idx]: null }));
  };

  const submit = () => {
    const newErrors = {};
    users.forEach((u, i) => {
      if (!u.name.trim())       newErrors[i] = "Please enter a name.";
      else if (!u.webinarDate)  newErrors[i] = "Please select the webinar date.";
      else if (!u.attendeeFile) newErrors[i] = "Attendee CSV is required.";
      else if (!u.chatFile)     newErrors[i] = "Chat log is required.";
      else if (!u.countFile)    newErrors[i] = "Live count xlsx is required.";
    });
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    onSubmit(users);
  };

  const formatDateLabel = (date) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: webinars (upload selection)
  // ══════════════════════════════════════════════════════════════════
  if (activeStep === "webinars") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ maxWidth: 1100, width: "100%" }} className="fadein">
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>◆ WEBINAR INSIGHTS · LOCAL ANALYZER</div>
            <h1 className="serif" style={{ fontSize: 42, fontWeight: 500, margin: 0, lineHeight: 1.12 }}>
              How many webinars do you want to <em style={{ color: "var(--accent)" }}>Upload</em>?
            </h1>
            <p className="text-dim" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 14 }}>
              Select one or more webinar slots, then continue to upload their files and select the date.
            </p>
          </div>

          <div className="panel" style={{ padding: 24 }}>
            <div className="webinar-select-grid">
              {WEBINAR_OPTIONS.map((label, index) => {
                const option = { id: `${label}-${index}`, label };
                const active = selectedWebinars.some((i) => i.id === option.id);
                return (
                  <button key={option.id} type="button" onClick={() => toggleWebinar(option)} className="webinar-select-card"
                    style={{ background: active ? "rgba(46,204,113,0.28)" : "var(--panel-hi)", borderColor: active ? "var(--green)" : "var(--border)" }}>
                    {label}
                  </button>
                );
              })}
            </div>

            <p className="mono" style={{ textAlign: "center", marginTop: 18, color: "var(--text-dim)", fontSize: 11, letterSpacing: 1 }}>
              {selectedWebinars.length} selected · {selectedWebinars.length * 3} files total
            </p>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={startSelectedUpload} disabled={!selectedWebinars.length} style={{ minWidth: 220 }}>
                Continue <ArrowRight size={14} style={{ verticalAlign: "middle", marginLeft: 8 }} />
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <button className="btn" onClick={() => changeStep("count")}>
              <ArrowLeft size={14} style={{ verticalAlign: "middle", marginRight: 8 }} /> Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: compare
  // ══════════════════════════════════════════════════════════════════
  if (activeStep === "compare") {
    const requiredWebinars = sameWebinarDates ? 1 : count;
    const canGenerate = compareWebinars.length === requiredWebinars && compareDates.length > 0;

    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ maxWidth: 1100, width: "100%" }} className="fadein">
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>WEBINAR INSIGHTS · COMPARE</div>
            <h1 className="serif" style={{ fontSize: 38, fontWeight: 500, margin: 0, lineHeight: 1.12 }}>
              Select webinars + dates to <em style={{ color: "var(--accent)" }}>Compare</em>
            </h1>
            <p className="text-dim" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 12 }}>
              Pick webinar slots and add the date(s). Click <strong>Generate Dashboard</strong> to load from the database —
              the sessions must have been uploaded already with those dates.
            </p>
          </div>

          <div className="compare-layout">
            {/* Webinar selector */}
            <div className="panel" style={{ padding: 16 }}>
              <div className="kicker" style={{ marginBottom: 12 }}>Select webinars</div>
              <div className="webinar-select-grid compare-webinar-grid">
                {WEBINAR_OPTIONS.map((label, index) => {
                  const option = { id: `${label}-${index}`, label };
                  const active = compareWebinars.some((i) => i.id === option.id);
                  return (
                    <button key={option.id} type="button" onClick={() => toggleCompareWebinar(option)} className="webinar-select-card"
                      style={{ background: active ? "rgba(46,204,113,0.28)" : "var(--panel-hi)", borderColor: active ? "var(--green)" : "var(--border)" }}>
                      {label}
                    </button>
                  );
                })}
              </div>

              {count === 1 && (
                <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                  <button type="button" className={sameWebinarDates ? "btn btn-primary" : "btn"} onClick={toggleSameWebinarDates} style={{ padding: "8px 12px", fontSize: 10 }}>
                    Same webinar, different dates
                  </button>
                </div>
              )}
            </div>

            {/* Date slicer */}
            <div className="date-panel">
              <div className="date-card date-card-primary">
                <div className="kicker" style={{ marginBottom: 8 }}>
                  <Calendar size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Date slicer
                </div>
                <input type="date" className="date-input" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
                <button type="button" className="btn btn-primary" onClick={addCompareDate} disabled={!dateInput}
                  style={{ width: "100%", marginTop: 8, padding: "8px 10px", fontSize: 10 }}>
                  Add date
                </button>

                <div className="selected-date-list">
                  {compareDates.length === 0 ? (
                    <div className="mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>No dates selected</div>
                  ) : (
                    compareDates.map((date) => (
                      <button key={date} type="button" className="selected-date-chip" onClick={() => toggleCompareDate(date)} title="Click to remove">
                        {formatDateLabel(date)}
                      </button>
                    ))
                  )}
                </div>

                {/* Show what will be fetched */}
                {compareWebinars.length > 0 && compareDates.length > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--panel-hi)", borderRadius: 4 }}>
                    <div className="kicker" style={{ fontSize: 9, marginBottom: 6 }}>Will fetch from database</div>
                    {compareWebinars.map((w, i) => (
                      <div key={w.id} className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 3 }}>
                        {w.label} · {formatDateLabel(compareDates[i] || compareDates[0] || "?")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error message */}
          {compareError && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--accent-soft)", border: "1px solid var(--accent)", color: "var(--accent)", fontSize: 13, borderRadius: 4 }}>
              ⚠ {compareError}
            </div>
          )}

          <p className="mono text-faint" style={{ textAlign: "center", marginTop: 18, fontSize: 10, letterSpacing: 1 }}>
            {compareWebinars.length} webinar selected · {compareDates.length} date selected
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <button className="btn" onClick={() => changeStep("count")}>
              <ArrowLeft size={14} style={{ verticalAlign: "middle", marginRight: 8 }} /> Back
            </button>
            <button className="btn" onClick={startManualUploadFromCompare}>
              Upload manually instead
            </button>
            <button
              className="btn btn-primary"
              disabled={!canGenerate || compareLoading}
              onClick={handleGenerateDashboard}
              style={{ minWidth: 200 }}
            >
              {compareLoading ? "Loading from database…" : "Generate Dashboard"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: count
  // ══════════════════════════════════════════════════════════════════
  if (activeStep === "count") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ maxWidth: 1100, width: "100%" }} className="fadein">
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>◆ WEBINAR INSIGHTS · LOCAL ANALYZER</div>
            <h1 className="serif" style={{ fontSize: 46, fontWeight: 500, margin: 0, lineHeight: 1.12, whiteSpace: "nowrap" }}>
              How many webinars do you want to <em style={{ color: "var(--accent)" }}>compare</em>?
            </h1>
            <p className="text-dim" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 16 }}>
              Pick 1 for a single brief, or 2+ to get a comparison panel.
            </p>
          </div>

          <div className="panel" style={{ padding: 32 }}>
            <div className="flex" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button key={n} onClick={() => setCount(n)} className="serif"
                  style={{ width: 80, height: 80, fontSize: 30, fontWeight: 500, border: `2px solid ${count === n ? "var(--accent)" : "var(--border)"}`, background: count === n ? "rgba(242,48,48,0.1)" : "var(--panel-hi)", color: count === n ? "var(--accent)" : "var(--text)", cursor: "pointer", transition: "all 0.15s" }}>
                  {n}
                </button>
              ))}
            </div>
            <p className="mono" style={{ textAlign: "center", marginTop: 20, color: "var(--text-dim)", fontSize: 11, letterSpacing: 1 }}>
              {count === 1 ? "One webinar — single dashboard" : `${count} webinars · ${count * 3} files total · plus comparison panel`}
            </p>
            <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => changeStep("compare")} style={{ minWidth: 240 }}>
                Continue <ArrowRight size={14} style={{ verticalAlign: "middle", marginLeft: 8 }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: upload
  // ══════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", padding: 32 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }} className="fadein">
        <div style={{ marginBottom: 32 }}>
          <div className="kicker" style={{ marginBottom: 4 }}>STEP 02 · UPLOAD FILES</div>
          <h2 className="serif" style={{ fontSize: 30, fontWeight: 500, margin: 0, lineHeight: 1.15 }}>
            {users.length === 1
              ? <>Upload three files for <span style={{ color: "var(--text)", margin: "0 10px" }}>{users[0].name}</span> webinar</>
              : <>Upload three files for <em style={{ color: "var(--accent)" }}>each</em> webinar</>
            }
          </h2>
          <p className="text-dim" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Select the webinar date for each session — this is used to retrieve sessions for the comparison dashboard.
          </p>
        </div>

        <div className="flex flex-col" style={{ gap: 24 }}>
          {users.map((u, i) => (
            <UserCard key={i} index={i} user={u} onUpdate={(nu) => updateUser(i, nu)} error={errors[i]} />
          ))}
        </div>

        <div className="flex" style={{ gap: 12, marginTop: 32, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button className="btn" onClick={() => changeStep(selectedWebinars.length ? "webinars" : "count")}>
            <ArrowLeft size={14} style={{ verticalAlign: "middle", marginRight: 8 }} /> Back
          </button>
          <button className="btn btn-primary" onClick={submit} style={{ minWidth: 240 }}>
            Upload & Generate Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
