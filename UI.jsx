import React, { useState } from "react";

const InfoBody = ({ info }) => {
  if (!info) return null;
  if (typeof info === "string") {
    return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "var(--text-dim)" }}>{info}</p>;
  }

  const sections = [
    ["What this chart is for", info.purpose || info.what],
    ["How to read it", info.read || info.how],
    ["What to look for", info.lookFor || info.watch],
  ].filter(([, body]) => body);

  return (
    <div style={{ padding: 20 }}>
      {sections.map(([heading, body]) => (
        <section key={heading} style={{ marginBottom: 18 }}>
          <div className="mono" style={{ color: "var(--accent)", fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6 }}>
            {heading}
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "var(--text-dim)" }}>
            {body}
          </p>
        </section>
      ))}
    </div>
  );
};

export const Panel = ({ children, title, subtitle, accent, takeaway, action, info, style }) => {
  const [showInfo, setShowInfo] = useState(false);
  const infoTitle = typeof info === "object" && info?.title ? info.title : title;

  return (
  <div className="panel ppt-chart" data-ppt-title={title || accent || "Chart"} style={style}>
    {(title || subtitle || action || info) && (
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            {accent && <span className="kicker">{accent}</span>}
            {title && (
              <h3
                className="serif"
                style={{
                  fontSize: 17,
                  fontWeight: 400,
                  letterSpacing: "-0.2px",
                  margin: 0,
                  color: "var(--text)",
                }}
              >
                {title}
              </h3>
            )}
          </div>
          {subtitle && (
            <p
              className="text-dim"
              style={{ fontSize: 11.5, marginTop: 4, marginBottom: 0, lineHeight: 1.5 }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {(action || info) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {action}
            {info && (
              <button
                type="button"
                className="chart-info-btn"
                aria-label={`About ${title || "this chart"}`}
                title="What is this chart?"
                onClick={() => setShowInfo(true)}
              >
                i
              </button>
            )}
          </div>
        )}
      </div>
    )}
    <div style={{ padding: 20 }}>{children}</div>
    {takeaway && (
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          background: "var(--rec-bg, #0B1220)",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          borderLeft: "3px solid var(--blue)",
        }}
      >
        <span
          className="mono"
          style={{
            color: "var(--blue)",
            fontSize: 9,
            letterSpacing: 2,
            paddingTop: 3,
            flexShrink: 0,
            textTransform: "uppercase",
          }}
        >
          ⬡ REC
        </span>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0, flex: 1, color: "var(--rec-text, #7EB8F7)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          {takeaway}
        </p>
      </div>
    )}
    {showInfo && (
      <Modal
        onClose={() => setShowInfo(false)}
        title={infoTitle || "About this chart"}
        subtitle="What it shows and how to read it"
      >
        <InfoBody info={info} />
      </Modal>
    )}
  </div>
  );
};

export const Rec = ({ children, items }) => (
  <div
    style={{
      background: "var(--rec-bg, #0B1220)",
      border: "1px solid var(--rec-border, #1A2E50)",
      borderLeft: "3px solid var(--blue)",
      padding: "14px 18px",
      marginTop: 16,
    }}
  >
    <div
      className="mono"
      style={{
        color: "var(--blue)",
        fontSize: 9,
        letterSpacing: 2,
        textTransform: "uppercase",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      ⬡ RECOMMENDATION
    </div>
    {children && (
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: "var(--rec-text, #7EB8F7)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
        {children}
      </p>
    )}
    {items && (
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--rec-text, #7EB8F7)", marginBottom: 3, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            {item}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const Stat = ({ label, value, sub, tone = "default", monoSize = 28 }) => {
  const colors = {
    default: "var(--text)",
    danger: "var(--accent)",
    success: "var(--green)",
    warn: "var(--amber)",
    blue: "var(--blue)",
    purple: "var(--purple)",
  };
  const borderColor =
    tone === "danger" ? "var(--accent)" :
    tone === "success" ? "var(--green)" :
    tone === "warn" ? "var(--amber)" :
    tone === "blue" ? "var(--blue)" :
    tone === "purple" ? "var(--purple)" :
    "var(--border)";
  const bgColor =
    tone === "danger" ? "var(--accent-soft)" :
    tone === "success" ? "var(--green-soft)" :
    tone === "warn" ? "var(--amber-soft)" :
    tone === "blue" ? "var(--blue-soft)" :
    tone === "purple" ? "var(--purple-soft)" :
    "transparent";
  return (
    <div style={{
      borderLeft: `2px solid ${borderColor}`,
      paddingLeft: 14,
      paddingTop: 10,
      paddingBottom: 10,
      background: bgColor,
      paddingRight: 12,
    }}>
      <div
        className="mono"
        style={{
          color: "var(--text-faint)",
          fontSize: 9.5,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        className="serif"
        style={{
          color: colors[tone],
          fontSize: monoSize,
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.5px",
          marginTop: 2,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="mono"
          style={{ color: "var(--text-faint)", fontSize: 10, marginTop: 5, lineHeight: 1.4 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};

export const TT = ({ active, payload, label, formatter, labelFormatter }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="mono"
      style={{
        background: "#060810",
        border: "1px solid var(--border-hi)",
        padding: "10px 12px",
        fontSize: 11,
        minWidth: 180,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          color: "var(--text-dim)",
          marginBottom: 6,
          letterSpacing: 1,
          textTransform: "uppercase",
          fontSize: 10,
        }}
      >
        {labelFormatter ? labelFormatter(label) : label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: p.color || "var(--text)",
            gap: 16,
            padding: "2px 0",
          }}
        >
          <span>{p.name}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const Modal = ({ children, onClose, title, subtitle }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h3 className="serif" style={{ margin: 0, fontSize: 20, fontWeight: 400 }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 4, marginBottom: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        <button
          className="btn"
          onClick={onClose}
          style={{ padding: "6px 12px", fontSize: 11 }}
        >
          Close
        </button>
      </div>
      <div style={{ padding: 0, overflow: "auto", flex: 1 }}>{children}</div>
    </div>
  </div>
);
