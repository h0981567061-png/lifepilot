import { useState } from "react";

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
  return DATE_RE.test(line);
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

export default function App() {
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState("");

  function handleAnalyze() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("請先貼上 LINE 訊息內容。");
      return;
    }
    setError("");
    const parsed = parseEvents(trimmed);
    setEvents(parsed);
    setAnalyzed(true);
  }

  function handleChange(id: number, field: "keepInLifePilot" | "addToCalendar", value: boolean) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  function handleCreate() {
    const kept = events.filter((e) => e.keepInLifePilot);
    const calendarItems = events.filter((e) => e.addToCalendar);
    alert(
      `已建立 ${kept.length} 個活動到 LifePilot${calendarItems.length > 0 ? `，並將 ${calendarItems.length} 個活動加入行事曆` : ""}。`
    );
  }

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
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-200 mb-1">分析結果</h2>
              <p className="text-sm text-gray-500">
                {events.length > 0
                  ? `共找到 ${events.length} 個活動`
                  : "未找到任何活動，請確認訊息不為空白"}
              </p>
            </div>

            {events.length > 0 && (
              <>
                <div className="flex flex-col gap-4 mb-8">
                  {events.map((event) => (
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
