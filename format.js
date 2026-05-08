export const fmtNum = (n) =>
  n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("en-IN");

export const fmtPct = (n, d = 1) =>
  n == null || isNaN(n) ? "—" : `${(+n).toFixed(d)}%`;

export const fmtMin = (m) => {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const mm = Math.round(m - h * 60);
  return `${h}h ${mm}m`;
};

// minutes since startDate -> "h:mm AM/PM"
export const minToClock = (startDate, m) => {
  if (!startDate) return `T+${m}m`;
  const t = new Date(startDate.getTime() + m * 60000);
  let h = t.getHours();
  const mi = String(t.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mi} ${ap}`;
};
