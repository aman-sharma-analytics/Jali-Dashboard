// =====================================================================
// FILE PARSERS — turn raw uploaded files into structured JS objects.
// All processing happens in the browser (no server).
// =====================================================================

import Papa from "papaparse";
import * as XLSX from "xlsx";

// ---------- helpers ----------

const readAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });

const readAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

const parseZoomDate = (str) => {
  // e.g. "04/26/2026 10:45:17 AM"
  if (!str) return null;
  const cleaned = str.replace(/^"|"$/g, "").trim();
  const m = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)/);
  if (!m) return null;
  let [, mo, d, y, h, mi, s, ap] = m;
  h = parseInt(h, 10);
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return new Date(+y, +mo - 1, +d, h, +mi, +s);
};

// ---------- Attendee CSV parser ----------

export async function parseAttendeeCSV(file) {
  const raw = await readAsText(file);

  // Strip BOM
  const text = raw.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);

  // Find webinar metadata line — headers are line 2, values line 3
  const metaHeaders = Papa.parse(lines[2] || "").data[0] ?? [];
  const metaValues = Papa.parse(lines[3] || "").data[0] ?? [];
  const meta = {};
  metaHeaders.forEach((h, i) => {
    meta[h.trim()] = (metaValues[i] || "").replace(/"/g, "").trim();
  });

  // Find "Attendee Details" section
  const attIdx = lines.findIndex((ln) => ln.trim() === "Attendee Details");
  if (attIdx < 0) throw new Error("Could not find Attendee Details section in CSV");

  // Header is the next line; data follows
  const headerLine = lines[attIdx + 1];
  const dataLines = lines.slice(attIdx + 2).filter((l) => l.trim()).join("\n");
  const csv = headerLine + "\n" + dataLines;

  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

  // normalize rows
  const rows = parsed.data
    .map((r) => {
      const email = (r["Email"] || "").trim().toLowerCase();
      if (!email && !r["User Name (Original Name)"]) return null;
      return {
        attended: r["Attended"] === "Yes",
        name: r["User Name (Original Name)"] || "",
        email,
        join: parseZoomDate(r["Join Time"]),
        leave: parseZoomDate(r["Leave Time"]),
        timeMin: parseFloat(r["Time in Session (minutes)"]) || 0,
        isGuest: r["Is Guest"] === "Yes",
        country: r["Country/Region Name"] || "Unknown",
        registrationTime: parseZoomDate(r["Registration Time"]),
      };
    })
    .filter(Boolean);

  // Webinar window — figure out start time from metadata "Actual Start Time"
  const startTimeStr = meta["Actual Start Time"];
  const webinarStart = parseZoomDate(startTimeStr);
  const durationMin = parseInt(meta["Actual Duration (minutes)"] || "0", 10);
  const webinarEnd = webinarStart
    ? new Date(webinarStart.getTime() + durationMin * 60 * 1000)
    : null;

  return {
    meta: {
      topic: meta["Topic"] || "Webinar",
      webinarId: meta["Webinar ID"] || "",
      start: webinarStart,
      end: webinarEnd,
      durationMin,
      registrants: parseInt(meta["# Registrants"] || "0", 10),
      uniqueViewers: parseInt(meta["Unique Viewers"] || "0", 10),
      totalUsers: parseInt(meta["Total Users"] || "0", 10),
    },
    rows,
  };
}

// ---------- Chat log parser ----------

export async function parseChatLog(file) {
  const text = await readAsText(file);
  const re =
    /(\d{2}:\d{2}:\d{2})\s+From\s+(.+?)\s+to\s+(.+?):\s*\n((?:\t.*\n?)+)/g;

  const messages = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, ts, sender, recipient, body] = m;
    messages.push({
      time: ts,
      sender: sender.trim(),
      recipient: recipient.trim(),
      body: body.replace(/\t/g, "").trim(),
    });
  }
  return messages;
}

// ---------- Attendance Count XLSX parser ----------

export async function parseAttendanceCount(file) {
  const buf = await readAsArrayBuffer(file);
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  // Expected columns: "Time" (string or Excel time) and "Public" (count)
  // Be flexible about column names
  const findKey = (row, candidates) =>
    Object.keys(row).find((k) =>
      candidates.some((c) => k.toLowerCase().trim() === c.toLowerCase())
    );

  if (!rows.length) return [];
  const tKey = findKey(rows[0], ["Time", "Timestamp", "time"]) || "Time";
  const cKey =
    findKey(rows[0], ["Public", "Count", "Viewers", "Unique"]) || "Public";

  return rows
    .map((r) => {
      const tRaw = r[tKey];
      let timeStr = "";
      if (typeof tRaw === "string") {
        timeStr = tRaw;
      } else if (tRaw instanceof Date) {
        timeStr = tRaw.toTimeString().slice(0, 8);
      } else if (typeof tRaw === "number") {
        // Excel time fraction
        const totalSec = Math.round(tRaw * 86400);
        const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
        const mi = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
        const s = String(totalSec % 60).padStart(2, "0");
        timeStr = `${h}:${mi}:${s}`;
      }
      return {
        time: timeStr,
        count: parseInt(r[cKey], 10) || 0,
      };
    })
    .filter((r) => r.time && r.count > 0);
}
