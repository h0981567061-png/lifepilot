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

function parseEvents(text: string): Event[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return blocks.map((block, idx) => {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    const title = extractTitle(lines);
    const date = extractDate(block);
    const time = extractTime(block);
    const location = extractLocation(block);

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

function extractTitle(lines: string[]): string {
  if (lines.length === 0) return "（無標題）";
  const labelPrefixes = /^(日期|時間|地點|地址|位置|時段|venue|date|time|location)[:：\s]/i;
  for (const line of lines) {
    if (!labelPrefixes.test(line)) return line.replace(/^[#＃\-–—•·]+\s*/, "").trim();
  }
  return lines[0];
}

function extractDate(block: string): string {
  const patterns = [
    /日期[:：\s]*([0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2})/,
    /([0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2})/,
    /日期[:：\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2})/,
    /([0-9]{1,2}月[0-9]{1,2}日)/,
    /([0-9]{1,2}[\/][0-9]{1,2})\s*[\(（]/,
    /([0-9]{1,2}[\/][0-9]{1,2})/,
    /((?:一|二|三|四|五|六|日|週一|週二|週三|週四|週五|週六|週日|星期一|星期二|星期三|星期四|星期五|星期六|星期日))/,
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m) return m[1];
  }
  return "";
}

function extractTime(block: string): string {
  const patterns = [
    /時間[:：\s]*([0-9]{1,2}[:：][0-9]{2}(?:\s*[APap][Mm])?)/,
    /時段[:：\s]*([0-9]{1,2}[:：][0-9]{2})/,
    /([0-9]{1,2}[:：][0-9]{2})\s*[-–~～]\s*[0-9]{1,2}[:：][0-9]{2}/,
    /([0-9]{1,2}[:：][0-9]{2})/,
    /(上午|下午|早上|晚上)[0-9]{1,2}[點点時时]/,
    /([0-9]{1,2}[點点時时](?:[0-9]{1,2}[分]?)?)/,
    /(\d{1,2}:\d{2}\s*[APap][Mm])/,
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m) return m[1];
  }
  return "";
}

function extractLocation(block: string): string {
  const patterns = [
    /地點[:：\s]*(.+)/,
    /地址[:：\s]*(.+)/,
    /位置[:：\s]*(.+)/,
    /venue[:：\s]*(.+)/i,
    /location[:：\s]*(.+)/i,
    /場地[:：\s]*(.+)/,
    /(?:在|於|at)\s+(.+)/,
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m) return m[1].trim();
  }
  return "";
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
            onChange={(e) => { setMessage(e.target.value); setAnalyzed(false); setError(""); }}
            placeholder={"貼上 LINE 訊息內容...\n\n每個活動請用空白行分隔，例如：\n\n美術班\n日期：7/5\n時間：14:00\n地點：藝術教室 3F\n\n桌球練習\n日期：7/12\n時間：16:00\n地點：體育館 1F"}
            rows={8}
            className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 px-5 py-4 text-base resize-none focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all duration-200"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

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
                  : "未找到任何活動，請確認訊息格式"}
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
