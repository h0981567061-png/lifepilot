// ─── Hour / Minute scroll-select time picker ──────────────────────────────────

interface Props {
  value: string;        // "HH:MM" or ""
  onChange: (v: string) => void;
  disabled?: boolean;
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const SEL_CLS =
  "bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white " +
  "focus:outline-none focus:border-blue-500/50 cursor-pointer disabled:opacity-40";

export function TimePicker({ value, onChange, disabled }: Props) {
  const m  = value.match(/^(\d{1,2}):(\d{2})$/);
  const hh = m ? m[1].padStart(2, "0") : "";
  const mm = m ? (MINUTES.includes(m[2]) ? m[2] : m[2]) : "";

  function setHour(h: string) {
    onChange(h ? `${h}:${mm || "00"}` : "");
  }

  function setMinute(m2: string) {
    if (!hh) return;
    onChange(`${hh}:${m2}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={hh}
        onChange={(e) => setHour(e.target.value)}
        disabled={disabled}
        className={SEL_CLS}
        style={{ colorScheme: "dark" }}
      >
        <option value="">時</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <span className="text-gray-600 font-bold select-none">:</span>

      <select
        value={mm}
        onChange={(e) => setMinute(e.target.value)}
        disabled={disabled || !hh}
        className={SEL_CLS}
        style={{ colorScheme: "dark" }}
      >
        <option value="">分</option>
        {MINUTES.map((min) => (
          <option key={min} value={min}>{min}</option>
        ))}
      </select>
    </div>
  );
}
