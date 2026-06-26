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

// ─── Course card ──────────────────────────────────────────────────────────────

function EventCard({
  event,
  onChange,
}: {
  event: Event;
  onChange: (id: number, field: "keepInLifePilot" | "addToCalendar", value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 flex flex-col gap-4 hover:border-blue-500/40 transition-all duration-200">
      <h3 className="text-xl font-semibold text-white">{event.title}</h3>

      <div className="grid grid-cols-1 gap-2 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{event.date || <span className="italic text-gray-600">未偵測到日期</span>}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{event.time || <span className="italic text-gray-600">未偵測到時間</span>}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{event.location || <span className="italic text-gray-600">未偵測到地點</span>}</span>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={event.keepInLifePilot}
            onChange={(e) => onChange(event.id, "keepInLifePilot", e.target.checked)}
            className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
          />
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
            保存在 LifePilot
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={event.addToCalendar}
            onChange={(e) => onChange(event.id, "addToCalendar", e.target.checked)}
            className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
          />
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
            加入行事曆
          </span>
        </label>
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

function AirportTransferCard({ transfer }: { transfer: AirportTransfer }) {
  const typeColor =
    transfer.type === "接機"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : transfer.type === "送機"
      ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
      : "bg-white/5 text-gray-400 border-white/10";

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-white/5 backdrop-blur-sm p-6 flex flex-col gap-4 hover:border-amber-500/40 transition-all duration-200">
      {/* Header row: time + type badge + flight */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-2xl font-bold text-amber-300 tracking-widest">
          {transfer.time.slice(0, 2)}:{transfer.time.slice(2)}
        </span>
        {transfer.type && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${typeColor}`}>
            {transfer.type}
          </span>
        )}
        {transfer.flight && (
          <span className="text-sm font-mono text-gray-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            ✈ {transfer.flight}
          </span>
        )}
      </div>

      {/* Detail fields */}
      <div className="flex flex-col gap-1.5">
        <Field label="地區" value={transfer.district} />
        <Field label="車型" value={transfer.vehicle} />
        <Field label="費用" value={transfer.price ? `NT$ ${transfer.price}` : ""} />
        <Field label="備註" value={transfer.notes} />
      </div>

      {/* Fallback when no fields parsed */}
      {!transfer.district && !transfer.vehicle && !transfer.price && !transfer.notes && (
        <p className="text-xs text-gray-600 italic">無詳細資料</p>
      )}
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
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState("");

  function handleAnalyze() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("請先貼上 LINE 訊息內容。");
      return;
    }
    setError("");
    setDetectionResult(detectMessageType(trimmed));
    const type = detectParserType(trimmed);
    setParserType(type);
    if (type === "airport") {
      setTransfers(parseAirportTransfers(trimmed));
      setEvents([]);
    } else {
      setEvents(parseEvents(trimmed));
      setTransfers([]);
    }
    setAnalyzed(true);
  }

  function handleChange(id: number, field: "keepInLifePilot" | "addToCalendar", value: boolean) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  function handleCreate() {
    if (parserType === "airport") {
      alert(`已建立 ${transfers.length} 筆接送機行程到 LifePilot。`);
    } else {
      const kept = events.filter((e) => e.keepInLifePilot);
      const calendarItems = events.filter((e) => e.addToCalendar);
      alert(
        `已建立 ${kept.length} 個活動到 LifePilot${calendarItems.length > 0 ? `，並將 ${calendarItems.length} 個活動加入行事曆` : ""}。`
      );
    }
  }

  const resultCount =
    parserType === "airport" ? transfers.length : events.length;

  const resultLabel =
    parserType === "airport"
      ? resultCount > 0
        ? `共找到 ${resultCount} 筆接送機行程`
        : "未找到接送機行程，請確認每筆資料以四位數時間開頭（如：2100）"
      : resultCount > 0
      ? `共找到 ${resultCount} 個活動`
      : "未找到任何活動，請確認訊息不為空白";

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

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-200 mb-1">分析結果</h2>
              <p className="text-sm text-gray-500">{resultLabel}</p>
            </div>

            {resultCount > 0 && (
              <>
                <div className="flex flex-col gap-4 mb-8">
                  {parserType === "airport"
                    ? transfers.map((t) => (
                        <AirportTransferCard key={t.id} transfer={t} />
                      ))
                    : events.map((event) => (
                        <EventCard key={event.id} event={event} onChange={handleChange} />
                      ))}
                </div>

                <button
                  onClick={handleCreate}
                  className="w-full py-3.5 rounded-xl bg-white text-gray-950 font-semibold text-base hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 shadow-lg"
                >
                  建立
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
