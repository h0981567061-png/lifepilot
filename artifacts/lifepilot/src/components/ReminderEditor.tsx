import { useState } from "react";
import type {
  ReminderNotification,
  ReminderNotificationKind,
} from "../store";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage =
  | "idle"
  | "select-kind"
  | "day-before-time"
  | "custom";

interface Props {
  reminders: ReminderNotification[];
  onChange: (updated: ReminderNotification[]) => void;
  hasDate: boolean;
  hasTime: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NEEDS_TIME = new Set<ReminderNotificationKind>([
  "at-time",
  "before-10m",
  "before-30m",
  "before-1h",
  "before-2h",
]);

const KIND_OPTIONS: { kind: ReminderNotificationKind; label: string }[] = [
  { kind: "at-time",    label: "事件開始時" },
  { kind: "before-10m", label: "提前 10 分鐘" },
  { kind: "before-30m", label: "提前 30 分鐘" },
  { kind: "before-1h",  label: "提前 1 小時" },
  { kind: "before-2h",  label: "提前 2 小時" },
  { kind: "day-before", label: "前一天" },
  { kind: "custom",     label: "自訂" },
];

const DAY_BEFORE_PRESETS = ["09:00", "12:00", "18:00", "20:00"];

export function notificationLabel(n: ReminderNotification): string {
  switch (n.kind) {
    case "at-time":    return "事件開始時";
    case "before-10m": return "提前 10 分鐘";
    case "before-30m": return "提前 30 分鐘";
    case "before-1h":  return "提前 1 小時";
    case "before-2h":  return "提前 2 小時";
    case "day-before":
      return n.dayBeforeTime ? `前一天 ${n.dayBeforeTime}` : "前一天";
    case "custom": {
      const parts: string[] = [];
      if (n.customDays)    parts.push(`${n.customDays} 天`);
      if (n.customHours)   parts.push(`${n.customHours} 小時`);
      if (n.customMinutes) parts.push(`${n.customMinutes} 分鐘`);
      return parts.length > 0 ? `提前 ${parts.join(" ")}` : "自訂提醒";
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReminderEditor({ reminders, onChange, hasDate, hasTime }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [needsTimeWarning, setNeedsTimeWarning] = useState(false);
  const [dayBeforeCustomTime, setDayBeforeCustomTime] = useState("08:00");
  const [customDays, setCustomDays] = useState(0);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(30);

  const uid = () => crypto.randomUUID();

  const addReminder = (n: Omit<ReminderNotification, "id">) => {
    onChange([...reminders, { id: uid(), ...n }]);
    resetToIdle();
  };

  const resetToIdle = () => {
    setStage("idle");
    setNeedsTimeWarning(false);
  };

  const handleAddClick = () => {
    if (!hasDate) return;
    setNeedsTimeWarning(false);
    setStage("select-kind");
  };

  const handleKindSelect = (kind: ReminderNotificationKind) => {
    if (NEEDS_TIME.has(kind) && !hasTime) {
      setNeedsTimeWarning(true);
      return;
    }
    setNeedsTimeWarning(false);
    if (kind === "day-before") {
      setStage("day-before-time");
      return;
    }
    if (kind === "custom") {
      setStage("custom");
      return;
    }
    addReminder({ kind });
  };

  const handleDayBeforeConfirm = (time: string) => {
    addReminder({ kind: "day-before", dayBeforeTime: time });
  };

  const handleCustomConfirm = () => {
    if (!customDays && !customHours && !customMinutes) return;
    addReminder({
      kind: "custom",
      customDays:    customDays    || undefined,
      customHours:   customHours   || undefined,
      customMinutes: customMinutes || undefined,
    });
    setCustomDays(0);
    setCustomHours(0);
    setCustomMinutes(30);
  };

  const removeReminder = (id: string) =>
    onChange(reminders.filter((r) => r.id !== id));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">

      {/* Existing reminders */}
      {reminders.length > 0 && (
        <div className="space-y-1.5">
          {reminders.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2"
            >
              <span className="text-sm text-gray-300">{notificationLabel(r)}</span>
              <button
                type="button"
                onClick={() => removeReminder(r.id)}
                className="text-gray-500 hover:text-red-400 transition-colors text-base leading-none ml-3 px-1"
                aria-label="移除提醒"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No-date warning (idle only) */}
      {!hasDate && stage === "idle" && (
        <p className="text-xs text-amber-400/70">
          請先設定日期，才能新增提醒時間
        </p>
      )}

      {/* Needs-time warning */}
      {needsTimeWarning && (
        <p className="text-xs text-amber-400/70">
          請先設定事件時間
        </p>
      )}

      {/* ── Stage: idle ───────────────────────────────────────────────────── */}
      {stage === "idle" && hasDate && (
        <button
          type="button"
          onClick={handleAddClick}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-blue-400 hover:text-blue-300 hover:border-blue-500/30 transition-all"
        >
          ＋ 新增提醒
        </button>
      )}

      {/* ── Stage: select-kind ────────────────────────────────────────────── */}
      {stage === "select-kind" && (
        <div className="rounded-xl border border-white/10 bg-gray-900/80 overflow-hidden">
          <p className="text-xs font-semibold text-gray-500 px-3 pt-2.5 pb-1.5 border-b border-white/5 uppercase tracking-wide">
            選擇提醒時間
          </p>
          {KIND_OPTIONS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleKindSelect(kind)}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors border-b border-white/5 last:border-none"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetToIdle}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-500 hover:bg-white/5 transition-colors"
          >
            取消
          </button>
        </div>
      )}

      {/* ── Stage: day-before-time ────────────────────────────────────────── */}
      {stage === "day-before-time" && (
        <div className="rounded-xl border border-white/10 bg-gray-900/80 overflow-hidden">
          <p className="text-xs font-semibold text-gray-500 px-3 pt-2.5 pb-1.5 border-b border-white/5 uppercase tracking-wide">
            前一天 — 選擇提醒時間
          </p>
          {DAY_BEFORE_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleDayBeforeConfirm(t)}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors border-b border-white/5"
            >
              {t}
            </button>
          ))}
          {/* Custom time row */}
          <div className="px-3 py-2.5 flex items-center gap-2 border-b border-white/5">
            <span className="text-sm text-gray-400 shrink-0">自訂</span>
            <input
              type="time"
              value={dayBeforeCustomTime}
              onChange={(e) => setDayBeforeCustomTime(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500/50"
              style={{ colorScheme: "dark" }}
            />
            <button
              type="button"
              onClick={() => handleDayBeforeConfirm(dayBeforeCustomTime)}
              disabled={!dayBeforeCustomTime}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              套用
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStage("select-kind")}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-500 hover:bg-white/5 transition-colors"
          >
            ← 返回
          </button>
        </div>
      )}

      {/* ── Stage: custom ─────────────────────────────────────────────────── */}
      {stage === "custom" && (
        <div className="rounded-xl border border-white/10 bg-gray-900/80 p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            自訂提醒
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={30}
                value={customDays}
                onChange={(e) =>
                  setCustomDays(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-sm text-gray-400">天</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={23}
                value={customHours}
                onChange={(e) =>
                  setCustomHours(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-sm text-gray-400">小時</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={59}
                value={customMinutes}
                onChange={(e) =>
                  setCustomMinutes(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-sm text-gray-400">分鐘</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCustomConfirm}
              disabled={!customDays && !customHours && !customMinutes}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              確定
            </button>
            <button
              type="button"
              onClick={resetToIdle}
              className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm transition-colors hover:text-white"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
