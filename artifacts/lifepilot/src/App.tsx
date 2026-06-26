import { useState } from "react";

// ─── Course parser types & helpers ───────────────────────────────────────────

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  keepInLifePilot: boolean;
  addToCalendar: boolean;
}

// ─── Apple Reminders data structure ──────────────────────────────────────────

interface ReminderItem {
  sourceEventId: number;
  title: string;
  notes: string;
  dueDate: Date | null;       // event date + start time
  reminderDate: Date | null;  // 1 h before dueDate; or 09:00 when no time given
  isCompleted: boolean;
}

// Date pattern: 7/30  |  7/21  |  7/20-7/24  |  7/20-24
const DATE_RE = /\d{1,2}\/\d{1,2}(?:[-–~～]\d{1,2}(?:\/\d{1,2})?)?/;

function isEventHeader(line: string): boolean {
  // Must contain a date pattern
  const m = line.match(DATE_RE);
  if (!m) return false;
  // The text BEFORE the date must contain at least one Chinese character or letter
  // This ensures "美術班 7/30" qualifies but a bare "7/30" line does not
  const beforeDate = line.slice(0, m.index).trim();
  return /[\u4e00-\u9fff\w]/.test(beforeDate);
}

function extractDate(line: string): string {
  const m = line.match(DATE_RE);
  return m ? m[0] : "";
}

function extractTitle(line: string, date: string): string {
  return line.replace(date, "").replace(/\s+/g, " ").trim();
}

function extractTime(line: string): string {
  // （時間09點-12點）  |  時間14點-17點  |  09:00-12:00
  const patterns = [
    /時間\s*(\d{1,2}[點点]\s*[-–~～]\s*\d{1,2}[點点])/,
    /時間\s*(\d{1,2}[點点])/,
    /時間\s*(\d{1,2}:\d{2}\s*[-–~～]\s*\d{1,2}:\d{2})/,
    /時間\s*(\d{1,2}:\d{2})/,
    /(\d{1,2}:\d{2}\s*[-–~～]\s*\d{1,2}:\d{2})/,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) return m[1];
  }
  return "";
}

function extractLocation(line: string): string {
  return line.replace(/[（()）【】]/g, "").trim();
}

function isTimeLine(line: string): boolean {
  return /時間/.test(line) || /\d{1,2}:\d{2}/.test(line);
}

function parseEvents(text: string): Event[] {
  // Preserve blank lines as boundary signals — do NOT filter them yet
  const rawLines = text.split("\n").map((l) => l.trim());

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of rawLines) {
    if (line === "") {
      // Rule 1: blank line → flush current block and start fresh
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else if (isEventHeader(line) && current.length > 0) {
      // Rule 2: date-header line while a block is already open → also split
      // (handles no-blank-line inputs where events run together)
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks
    .filter((b) => b.length > 0)
    .map((block, idx) => {
      const firstLine = block[0];
      const bodyLines = block.slice(1);

      // Date: check first line, then scan body lines as fallback
      let date = extractDate(firstLine);
      if (!date) {
        for (const line of bodyLines) {
          const d = extractDate(line);
          if (d) { date = d; break; }
        }
      }

      // Title: first line with date stripped out
      const title = extractTitle(firstLine, date) || "（無標題）";

      let time = "";
      let location = "";

      for (const line of bodyLines) {
        const t = extractTime(line);
        if (t && !time) {
          time = t;
        } else if (!isTimeLine(line) && !location) {
          location = extractLocation(line);
        }
      }

      return {
        id: idx + 1,
        title,
        date,
        time,
        location,
        keepInLifePilot: true,
        addToCalendar: false,
      };
    });
}

// ─── Airport Transfer parser types & helpers ──────────────────────────────────

interface AirportTransfer {
  id: number;
  time: string;
  flight: string;
  type: string;    // 接機 | 送機 | ""
  district: string;
  vehicle: string;
  price: string;
  notes: string;
  selected: boolean;
}

// A line "starts with a four-digit time" e.g. 2100, 2115, 0830
const TRANSFER_HEADER_RE = /^\d{4}(\s|$)/;
// Flight number: 1–2 uppercase letters + 2–5 digits, e.g. BR212, CI101, CX456
const FLIGHT_RE = /^[A-Za-z]{1,2}\d{2,5}$/;
// Price: a standalone 3–6 digit number
const PRICE_RE = /^\d{3,6}$/;
// Vehicle keywords
const VEHICLE_RE = /轎車|廂型|sedan|van|巴士|bus/i;
// Pickup / Dropoff keywords
const TRANSFER_TYPE_RE = /接機|送機/;

function isTransferHeader(line: string): boolean {
  return TRANSFER_HEADER_RE.test(line);
}

function parseAirportTransfers(text: string): AirportTransfer[] {
  const rawLines = text.split("\n").map((l) => l.trim());

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of rawLines) {
    if (line === "") {
      if (current.length > 0) { blocks.push(current); current = []; }
    } else if (isTransferHeader(line) && current.length > 0) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks
    .filter((b) => b.length > 0 && isTransferHeader(b[0]))
    .map((block, idx) => {
      const firstLine = block[0];
      // Everything after the 4-digit time on the header line
      const headerRest = firstLine.slice(4).trim();
      const bodyLines = block.slice(1);
      // All content lines (header remainder + body)
      const allExtra = [...(headerRest ? [headerRest] : []), ...bodyLines];

      const time = firstLine.slice(0, 4);
      let flight = "";
      let type = "";
      let district = "";
      let vehicle = "";
      let price = "";
      const noteParts: string[] = [];

      for (const line of allExtra) {
        if (!flight && FLIGHT_RE.test(line)) {
          flight = line.toUpperCase();
        } else if (!type && TRANSFER_TYPE_RE.test(line)) {
          const m = line.match(TRANSFER_TYPE_RE);
          type = m ? m[0] : line;
        } else if (!vehicle && VEHICLE_RE.test(line)) {
          vehicle = line;
        } else if (!price && PRICE_RE.test(line)) {
          price = line;
        } else if (/備註/.test(line)) {
          noteParts.push(line.replace(/備註\s*[：:]\s*/, "").trim());
        } else if (!district && /[\u4e00-\u9fff]/.test(line)) {
          // First Chinese-character line not matched above → district
          district = line;
        } else {
          noteParts.push(line);
        }
      }

      return {
        id: idx + 1,
        time,
        flight,
        type,
        district,
        vehicle,
        price,
        notes: noteParts.filter(Boolean).join("　").trim(),
      };
    });
}

// ─── Parser auto-detection ────────────────────────────────────────────────────

function detectParserType(text: string): "airport" | "course" {
  const lines = text.split("\n").map((l) => l.trim());
  if (lines.some((l) => TRANSFER_HEADER_RE.test(l))) return "airport";
  return "course";
}

// ─── Message type detection ───────────────────────────────────────────────────

type MessageTypeName =
  | "Course"
  | "Airport Transfer"
  | "Shopping"
  | "Payment"
  | "Medical"
  | "Pending";

interface DetectionResult {
  type: MessageTypeName;
  label: string;       // Traditional Chinese label
  confidence: number;  // 0–99
  color: string;       // Tailwind accent class
}

function detectMessageType(text: string): DetectionResult {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const full = lines.join("\n");

  const scores: Record<string, number> = {
    "Airport Transfer": 0,
    "Course": 0,
    "Shopping": 0,
    "Payment": 0,
    "Medical": 0,
  };

  // ── Airport Transfer ──
  // Strong signal: any line starts with 4-digit time
  scores["Airport Transfer"] += lines.filter((l) => TRANSFER_HEADER_RE.test(l)).length * 60;
  // Supporting keywords
  scores["Airport Transfer"] +=
    (full.match(/接機|送機|班機|轎車|廂型|接送|機場|航班/g) ?? []).length * 15;

  // ── Course ──
  // Strong signal: title + date pattern on same line
  scores["Course"] += lines.filter((l) => isEventHeader(l)).length * 30;
  // Supporting keywords
  scores["Course"] +=
    (full.match(/時間.*?點|上課|課程|補習|教室|國小|國中|高中/g) ?? []).length * 10;

  // ── Shopping ──
  scores["Shopping"] +=
    (full.match(/購買|訂單|商品|結帳|收據|發票|折扣|優惠|免運|出貨|宅配|購物|下單/g) ?? []).length * 20;
  if (/NT\$|NTD/.test(full)) scores["Shopping"] += 15;

  // ── Payment ──
  scores["Payment"] +=
    (full.match(/轉帳|匯款|帳號|收款|付款|ATM|繳費|銀行|戶名|存款|匯入|繳納/g) ?? []).length * 20;

  // ── Medical ──
  scores["Medical"] +=
    (full.match(/掛號|診所|醫院|看診|門診|醫師|醫生|回診|複診|藥局|處方|掛診/g) ?? []).length * 20;

  // ── Find winner ──
  const entries = Object.entries(scores);
  const [winner, winScore] = entries.reduce<[string, number]>(
    (best, [k, v]) => (v > best[1] ? [k, v] : best),
    ["", 0]
  );

  if (winScore === 0) {
    return { type: "Pending", label: "待分類", confidence: 0, color: "gray" };
  }

  // Confidence: winner vs. rest (soft-max style, capped at 99)
  const restSum = entries.reduce((s, [, v]) => s + v, 0) - winScore;
  const confidence = Math.min(99, Math.round((winScore / (winScore + restSum + 20)) * 100));

  const META: Record<string, { type: MessageTypeName; label: string; color: string }> = {
    "Airport Transfer": { type: "Airport Transfer", label: "接送機",  color: "amber"  },
    "Course":           { type: "Course",           label: "課程",    color: "blue"   },
    "Shopping":         { type: "Shopping",         label: "購物",    color: "purple" },
    "Payment":          { type: "Payment",          label: "付款",    color: "green"  },
    "Medical":          { type: "Medical",          label: "醫療",    color: "rose"   },
  };

  return { ...META[winner], confidence };
}

// ─── Apple Reminders builder ─────────────────────────────────────────────────

/** Parse "7/30" or "7/20-7/24" → Date using the current year. */
function parseEventDate(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  const datePart = dateStr.split(/[-–~～]/)[0].trim();
  const [monthStr, dayStr] = datePart.split("/");
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);
  if (!month || !day) return null;

  const year = new Date().getFullYear();
  let hour = 0;
  let minute = 0;

  if (timeStr) {
    // HH:MM format
    const colonMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (colonMatch) {
      hour = parseInt(colonMatch[1]);
      minute = parseInt(colonMatch[2]);
    } else {
      // Chinese 點 format: take first number before 點
      const dotMatch = timeStr.match(/(\d{1,2})[點点]/);
      if (dotMatch) hour = parseInt(dotMatch[1]);
    }
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/** Convert selected course events into Apple Reminders-ready data objects. */
function buildReminderItems(events: Event[]): ReminderItem[] {
  return events
    .filter((e) => e.keepInLifePilot)
    .map((e) => {
      const dueDate = parseEventDate(e.date, e.time);

      let reminderDate: Date | null = null;
      if (dueDate) {
        if (e.time) {
          // Remind 1 hour before the event start
          reminderDate = new Date(dueDate.getTime() - 60 * 60 * 1000);
        } else {
          // No time given → remind at 09:00 on that day
          reminderDate = new Date(dueDate);
          reminderDate.setHours(9, 0, 0, 0);
        }
      }

      const noteLines: string[] = [];
      if (e.location) noteLines.push(`地點：${e.location}`);
      if (e.time)     noteLines.push(`時間：${e.time}`);
      if (e.date)     noteLines.push(`日期：${e.date}`);

      return {
        sourceEventId: e.id,
        title: e.title,
        notes: noteLines.join("\n"),
        dueDate,
        reminderDate,
        isCompleted: false,
      };
    });
}

/** Format a Date for compact display, e.g. "7/30 09:00". */
function formatReminderDate(d: Date | null): string {
  if (!d) return "—";
  const mo = d.getMonth() + 1;
  const da = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? `${mo}/${da} ${h}:${m}` : `${mo}/${da}`;
}

// ─── Course card ──────────────────────────────────────────────────────────────

function EventCard({
  event,
  onToggle,
}: {
  event: Event;
  onToggle: (id: number) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 select-none ${
        event.keepInLifePilot
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-white/10 bg-white/5 opacity-50"
      }`}
      onClick={() => onToggle(event.id)}
    >
      <input
        type="checkbox"
        checked={event.keepInLifePilot}
        onChange={() => onToggle(event.id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white leading-snug">{event.title}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
          <span className={event.date ? "text-gray-400" : "italic text-gray-600"}>
            {event.date || "無日期"}
          </span>
          <span className={event.time ? "text-gray-400" : "italic text-gray-600"}>
            {event.time || "無時間"}
          </span>
          <span className={event.location ? "text-gray-400" : "italic text-gray-600"}>
            {event.location || "無地點"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Airport Transfer card ────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-amber-400/70 shrink-0 w-14 text-right">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}

function AirportTransferCard({
  transfer,
  onToggle,
}: {
  transfer: AirportTransfer;
  onToggle: (id: number) => void;
}) {
  const typeColor =
    transfer.type === "接機"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : transfer.type === "送機"
      ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
      : "bg-white/5 text-gray-400 border-white/10";

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 select-none ${
        transfer.selected
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-white/10 bg-white/5 opacity-50"
      }`}
      onClick={() => onToggle(transfer.id)}
    >
      <input
        type="checkbox"
        checked={transfer.selected}
        onChange={() => onToggle(transfer.id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        {/* Header row: time + type badge + flight */}
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <span className="text-xl font-bold text-amber-300 tracking-widest">
            {transfer.time.slice(0, 2)}:{transfer.time.slice(2)}
          </span>
          {transfer.type && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${typeColor}`}>
              {transfer.type}
            </span>
          )}
          {transfer.flight && (
            <span className="text-sm font-mono text-gray-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
              {transfer.flight}
            </span>
          )}
        </div>
        {/* Detail fields */}
        <div className="flex flex-col gap-1">
          <Field label="地區" value={transfer.district} />
          <Field label="車型" value={transfer.vehicle} />
          <Field label="費用" value={transfer.price ? `NT$ ${transfer.price}` : ""} />
          <Field label="備註" value={transfer.notes} />
        </div>
        {!transfer.district && !transfer.vehicle && !transfer.price && !transfer.notes && (
          <p className="text-xs text-gray-600 italic">無詳細資料</p>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [transfers, setTransfers] = useState<AirportTransfer[]>([]);
  const [parserType, setParserType] = useState<"course" | "airport">("course");
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [reminderItems, setReminderItems] = useState<ReminderItem[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState("");

  function handleAnalyze() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("請先貼上 LINE 訊息內容。");
      return;
    }
    setError("");
    setReminderItems([]);
    setDetectionResult(detectMessageType(trimmed));
    const type = detectParserType(trimmed);
    setParserType(type);
    if (type === "airport") {
      setTransfers(parseAirportTransfers(trimmed).map((t) => ({ ...t, selected: true })));
      setEvents([]);
    } else {
      setEvents(parseEvents(trimmed));
      setTransfers([]);
    }
    setAnalyzed(true);
  }

  function handleToggleEvent(id: number) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, keepInLifePilot: !e.keepInLifePilot } : e))
    );
  }

  function handleToggleTransfer(id: number) {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  }

  function handleSelectAll() {
    if (parserType === "airport") {
      setTransfers((prev) => prev.map((t) => ({ ...t, selected: true })));
    } else {
      setEvents((prev) => prev.map((e) => ({ ...e, keepInLifePilot: true })));
    }
  }

  function handleClearAll() {
    if (parserType === "airport") {
      setTransfers((prev) => prev.map((t) => ({ ...t, selected: false })));
    } else {
      setEvents((prev) => prev.map((e) => ({ ...e, keepInLifePilot: false })));
    }
  }

  function handleCreate() {
    if (parserType === "airport") {
      const selected = transfers.filter((t) => t.selected);
      alert(`已建立 ${selected.length} 筆接送機行程到 LifePilot。`);
    } else {
      // Build Apple Reminders-ready data for selected events
      const items = buildReminderItems(events);
      setReminderItems(items);
    }
  }

  const totalCount = parserType === "airport" ? transfers.length : events.length;
  const selectedCount =
    parserType === "airport"
      ? transfers.filter((t) => t.selected).length
      : events.filter((e) => e.keepInLifePilot).length;

  const PLACEHOLDER = `美術班 7/30
復旦國小
（時間09點-12點）

福爾 7/21
平鎮分局
（時間09點-12點）

桌球7/20-7/24
平興國小
（時間14點-17點）`;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-14">
        <div className="mb-10">
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
            LifePilot
          </h1>
          <p className="text-gray-400 text-base">貼上 LINE 訊息，自動分析行程活動</p>
        </div>

        <div className="mb-2">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setAnalyzed(false);
              setError("");
            }}
            placeholder={PLACEHOLDER}
            rows={8}
            className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 px-5 py-4 text-base resize-none focus:outline-none focus:border-blue-500/60 transition-all duration-200"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

        <button
          onClick={handleAnalyze}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-base transition-all duration-150 shadow-lg shadow-blue-600/20 mt-4 mb-10"
        >
          Analyze
        </button>

        {analyzed && (
          <>
            {/* ── Detection result card ── */}
            {detectionResult && (
              <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">偵測類型</p>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${
                    detectionResult.color === "amber"  ? "text-amber-300"  :
                    detectionResult.color === "blue"   ? "text-blue-400"   :
                    detectionResult.color === "purple" ? "text-purple-400" :
                    detectionResult.color === "green"  ? "text-emerald-400":
                    detectionResult.color === "rose"   ? "text-rose-400"   :
                    "text-gray-400"
                  }`}>
                    {detectionResult.label}
                  </span>
                  <span className="text-sm text-gray-500">({detectionResult.type})</span>
                </div>
                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mt-1">信心度</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        detectionResult.color === "amber"  ? "bg-amber-400"  :
                        detectionResult.color === "blue"   ? "bg-blue-400"   :
                        detectionResult.color === "purple" ? "bg-purple-400" :
                        detectionResult.color === "green"  ? "bg-emerald-400":
                        detectionResult.color === "rose"   ? "bg-rose-400"   :
                        "bg-gray-500"
                      }`}
                      style={{ width: `${detectionResult.confidence}%` }}
                    />
                  </div>
                  <span className={`text-lg font-bold tabular-nums ${
                    detectionResult.color === "amber"  ? "text-amber-300"  :
                    detectionResult.color === "blue"   ? "text-blue-400"   :
                    detectionResult.color === "purple" ? "text-purple-400" :
                    detectionResult.color === "green"  ? "text-emerald-400":
                    detectionResult.color === "rose"   ? "text-rose-400"   :
                    "text-gray-400"
                  }`}>
                    {detectionResult.confidence}%
                  </span>
                </div>
              </div>
            )}

            {/* ── Preview section ── */}
            {totalCount > 0 ? (
              <>
                {/* Heading + Select All / Clear All */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      AI 找到{" "}
                      <span className={parserType === "airport" ? "text-amber-300" : "text-blue-400"}>
                        {totalCount}
                      </span>{" "}
                      {parserType === "airport" ? "筆接送機行程" : "個活動"}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      已選取 {selectedCount} / {totalCount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1.5 rounded-lg text-sm text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-all duration-150"
                    >
                      全選
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:bg-white/5 transition-all duration-150"
                    >
                      清除
                    </button>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3 mb-8">
                  {parserType === "airport"
                    ? transfers.map((t) => (
                        <AirportTransferCard key={t.id} transfer={t} onToggle={handleToggleTransfer} />
                      ))
                    : events.map((event) => (
                        <EventCard key={event.id} event={event} onToggle={handleToggleEvent} />
                      ))}
                </div>

                {/* Create Selected button */}
                <button
                  onClick={handleCreate}
                  disabled={selectedCount === 0}
                  className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-150 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed bg-white text-gray-950 hover:bg-gray-100 active:bg-gray-200"
                >
                  建立所選（{selectedCount}）
                </button>

                {/* ── Apple Reminders preview ── */}
                {reminderItems.length > 0 && (
                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-4">
                      已準備 {reminderItems.length} 筆提醒資料
                    </p>
                    <div className="flex flex-col gap-3">
                      {reminderItems.map((item) => (
                        <div
                          key={item.sourceEventId}
                          className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-1"
                        >
                          <p className="font-semibold text-white text-sm">{item.title}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400">
                            <span className="text-gray-600">到期</span>
                            <span>{formatReminderDate(item.dueDate)}</span>
                            <span className="text-gray-600">提醒</span>
                            <span>{formatReminderDate(item.reminderDate)}</span>
                          </div>
                          {item.notes && (
                            <p className="mt-1 text-xs text-gray-500 whitespace-pre-line leading-relaxed">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-4 italic">
                      資料已準備完成，尚未同步至 Apple 提醒事項。
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                {parserType === "airport"
                  ? "未找到接送機行程，請確認每筆資料以四位數時間開頭（如：2100）"
                  : "未找到任何活動，請確認訊息不為空白"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
