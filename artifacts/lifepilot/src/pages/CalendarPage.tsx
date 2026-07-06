import { useState, useMemo } from "react";
import type { Reminder, FinancialItem } from "../store";
import { loadFinanceEntries, fmtCurrency, type FinanceEntry } from "../financeStore";

// ── Date key helpers ───────────────────────────────────────────────────────────

function toKey(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Normalise reminder.date → YYYY-MM-DD key, or null if unparsable. */
function reminderDateKey(dateStr: string): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // MM/DD fallback (legacy)
  const md = dateStr.match(/^(\d{1,2})\/(\d{1,2})/);
  if (md) {
    const y = new Date().getFullYear();
    return `${y}-${String(parseInt(md[1])).padStart(2, "0")}-${String(parseInt(md[2])).padStart(2, "0")}`;
  }
  return null;
}

// ── Calendar grid cell ─────────────────────────────────────────────────────────

interface CalCell {
  key: string;      // YYYY-MM-DD
  day: number;      // 1..31
  inMonth: boolean; // false = prev/next month padding
}

function buildCells(year: number, month: number): CalCell[] {
  const first   = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const cells: CalCell[] = [];

  // Leading padding from prev month
  const startDow = first.getDay(); // 0 = Sun
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ key: toKey(d), day: d.getDate(), inMonth: false });
  }
  // Current month
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ key: toKey(new Date(year, month, d)), day: d, inMonth: true });
  }
  // Trailing padding to fill last row
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const dt = new Date(year, month + 1, d);
    cells.push({ key: toKey(dt), day: d, inMonth: false });
  }
  return cells;
}

// ── Financial items helper (mirrors RemindersPage logic) ──────────────────────

function getFinancialItems(r: Reminder): FinancialItem[] {
  if (r.financialItems && r.financialItems.length > 0) return r.financialItems;
  if (
    (r.financialStatus === "receivable" || r.financialStatus === "payable") &&
    r.expectedAmount && r.expectedAmount > 0
  ) {
    return [{
      id: `leg-${r.id}`,
      title: r.title || (r.financialStatus === "receivable" ? "待收" : "待付"),
      type: r.financialStatus,
      amount: r.expectedAmount,
    }];
  }
  if (!r.financialStatus && r.type === "Payment" && r.amount) {
    const n = parseFloat(String(r.amount).replace(/,/g, ""));
    if (!isNaN(n) && n > 0) return [{ id: `leg-pay-${r.id}`, title: r.title || "繳費", type: "payable", amount: n }];
  }
  return [];
}

// ── Type colour dot ────────────────────────────────────────────────────────────

const TYPE_DOT: Record<string, string> = {
  "Airport Transfer": "bg-amber-400",
  Medical:           "bg-rose-400",
  Course:            "bg-blue-400",
  Shopping:          "bg-emerald-400",
  Payment:           "bg-purple-400",
  Income:            "bg-teal-400",
  Expense:           "bg-red-400",
  Work:              "bg-indigo-400",
  Family:            "bg-pink-400",
  General:           "bg-gray-400",
  Pending:           "bg-white/40",
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const DOW_LABELS  = ["日","一","二","三","四","五","六"];
const MAX_CELL_ITEMS = 2;

// ─────────────────────────────────────────────────────────────────────────────
// CalendarPage
// ─────────────────────────────────────────────────────────────────────────────

export function CalendarPage({
  reminders,
  onEdit,
  onNewWithDate,
}: {
  reminders: Reminder[];
  onEdit: (id: string) => void;
  onNewWithDate: (date: string) => void;
}) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayKey = toKey(todayDate);

  const [viewYear,    setViewYear]    = useState(todayDate.getFullYear());
  const [viewMonth,   setViewMonth]   = useState(todayDate.getMonth());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);
  const [financeEntries]              = useState<FinanceEntry[]>(() => loadFinanceEntries());

  // ── Derived: date → Reminder[] map ────────────────────────────────────────
  const dateMap = useMemo(() => {
    const map: Record<string, Reminder[]> = {};
    for (const r of reminders) {
      const key = reminderDateKey(r.date);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [reminders]);

  // ── Derived: calendar grid ─────────────────────────────────────────────────
  const cells = useMemo(() => buildCells(viewYear, viewMonth), [viewYear, viewMonth]);

  // ── Selected day data ──────────────────────────────────────────────────────
  const selectedReminders = dateMap[selectedKey] ?? [];

  // Format selected key for display: "2026-08-05" → "2026 / 08 / 05"
  const selectedDisplay = selectedKey.replace(/-/g, " / ");

  // ── Month navigation ───────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  function goToday() {
    setViewYear(todayDate.getFullYear());
    setViewMonth(todayDate.getMonth());
    setSelectedKey(todayKey);
  }

  function handleCellClick(cell: CalCell) {
    if (!cell.inMonth) {
      const d = new Date(cell.key + "T00:00:00");
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    setSelectedKey(cell.key);
  }

  return (
    <div className="max-w-2xl mx-auto px-3 pb-28">

      {/* ── Month navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 active:bg-white/15 transition-all"
          aria-label="上一個月"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <p className="flex-1 text-center text-base font-semibold text-white select-none">
          {viewYear} 年 {MONTH_NAMES[viewMonth]}
        </p>
        <button
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 active:bg-white/15 transition-all"
          aria-label="下一個月"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          onClick={goToday}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          今天
        </button>
      </div>

      {/* ── Day-of-week header ────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 mb-0.5 px-0.5">
        {DOW_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-medium py-1.5 ${
            i === 0 ? "text-rose-400/60" : i === 6 ? "text-blue-400/60" : "text-gray-600"
          }`}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 border border-white/8 rounded-xl overflow-hidden bg-white/5">
        {cells.map((cell, idx) => {
          const items     = dateMap[cell.key] ?? [];
          const isToday   = cell.key === todayKey;
          const isSelected = cell.key === selectedKey;
          const shown = items.slice(0, MAX_CELL_ITEMS);
          const extra = items.length - MAX_CELL_ITEMS;
          const isLastRow  = idx >= cells.length - 7;
          const isLastCol  = (idx + 1) % 7 === 0;

          return (
            <button
              key={cell.key}
              onClick={() => handleCellClick(cell)}
              className={[
                "relative flex flex-col items-start p-1 min-h-[58px] transition-colors text-left",
                !isLastRow ? "border-b border-white/5" : "",
                !isLastCol ? "border-r border-white/5" : "",
                isSelected ? "bg-blue-600/15" : "bg-gray-950 hover:bg-white/[0.03] active:bg-white/[0.06]",
                !cell.inMonth ? "opacity-30" : "",
              ].filter(Boolean).join(" ")}
            >
              {/* Date number */}
              <span className={[
                "text-xs font-semibold leading-none mb-1 w-5 h-5 flex items-center justify-center rounded-full shrink-0",
                isToday && isSelected  ? "bg-blue-500 text-white"         :
                isToday               ? "ring-1 ring-blue-400 text-blue-300" :
                isSelected            ? "bg-blue-500/25 text-blue-200"    :
                cell.inMonth          ? "text-white/75"                   : "text-gray-600",
              ].join(" ")}>
                {cell.day}
              </span>

              {/* Event labels */}
              <div className="w-full flex flex-col gap-px overflow-hidden">
                {shown.map((r) => (
                  <div key={r.id} className="flex items-center gap-0.5 overflow-hidden w-full">
                    <span className={`w-1 h-1 rounded-full shrink-0 ${TYPE_DOT[r.type] ?? "bg-gray-400"}`} />
                    <span className="text-[9px] leading-tight text-gray-300 truncate">{r.title}</span>
                  </div>
                ))}
                {extra > 0 && (
                  <span className="text-[9px] leading-tight text-gray-500 pl-1.5">＋{extra}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Selected date detail ──────────────────────────────────────────── */}
      <div className="mt-5 px-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-white">{selectedDisplay}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedReminders.length === 0 ? "目前沒有事項" : `${selectedReminders.length} 個事項`}
            </p>
          </div>
          <button
            onClick={() => onNewWithDate(selectedKey)}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/15 border border-blue-500/25 text-blue-300 hover:bg-blue-600/25 hover:border-blue-500/40 transition-all font-medium"
          >
            ＋ 新增
          </button>
        </div>

        {selectedReminders.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-gray-600">這天沒有事項</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedReminders.map((r) => (
              <CalendarDayRow
                key={r.id}
                reminder={r}
                linkedEntries={financeEntries.filter((e) => e.sourceReminderId === r.id)}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarDayRow — per-reminder row in the day detail panel
// ─────────────────────────────────────────────────────────────────────────────

function CalendarDayRow({
  reminder,
  linkedEntries,
  onEdit,
}: {
  reminder: Reminder;
  linkedEntries: FinanceEntry[];
  onEdit: (id: string) => void;
}) {
  const financialItems = getFinancialItems(reminder);
  const dotColor = TYPE_DOT[reminder.type] ?? "bg-gray-400";

  // Airport Transfer fields
  const atd          = reminder.templateData?.airportTransfer;
  const flight       = atd?.flightNumber || reminder.flightNumber;
  const pickupLoc    = atd?.pickupLocation || reminder.location;
  const destination  = atd?.destination;
  const transferType = atd?.transferType
    ? atd.transferType === "pickup" ? "接機" : atd.transferType === "dropoff" ? "送機" : ""
    : (reminder.transferType ?? "");

  return (
    <button
      onClick={() => onEdit(reminder.id)}
      className={[
        "w-full text-left rounded-xl border p-3.5 transition-all",
        reminder.completed
          ? "border-white/5 bg-white/[0.02] opacity-50"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07] active:bg-white/10",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        {/* Colour dot */}
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={`text-sm font-semibold leading-snug ${reminder.completed ? "line-through text-gray-500" : "text-white"}`}>
            {reminder.title}
          </p>

          {/* Time */}
          {reminder.startTime && (
            <p className="text-xs text-gray-500 mt-0.5">
              {reminder.startTime}
              {reminder.endTime && reminder.endTime !== reminder.startTime && ` – ${reminder.endTime}`}
            </p>
          )}

          {/* Airport Transfer detail */}
          {reminder.type === "Airport Transfer" && (
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
              {transferType && (
                <span className={transferType === "接機" ? "text-emerald-400/70" : "text-sky-400/70"}>
                  {transferType}
                </span>
              )}
              {flight && <span className="font-mono text-amber-300/70">✈ {flight}</span>}
              {(pickupLoc || destination) && (
                <span className="text-gray-500">
                  {pickupLoc}{destination ? ` → ${destination}` : ""}
                </span>
              )}
            </div>
          )}

          {/* Location (non-airport) */}
          {reminder.location && reminder.type !== "Airport Transfer" && (
            <p className="text-xs text-gray-600 mt-0.5">📍 {reminder.location}</p>
          )}

          {/* Financial items (receivable / payable) */}
          {financialItems.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {financialItems.map((fi) =>
                fi.completed ? (
                  <p key={fi.id} className="text-xs text-gray-500">
                    <span className="text-teal-400/60 mr-1">✓</span>
                    {fi.type === "receivable" ? "已收" : "已付"} {fmtCurrency(fi.amount)}
                  </p>
                ) : (
                  <p key={fi.id} className={`text-xs ${fi.type === "receivable" ? "text-teal-400/80" : "text-rose-300/80"}`}>
                    {fi.type === "receivable" ? "待收" : "待付"} {fmtCurrency(fi.amount)}
                  </p>
                )
              )}
            </div>
          )}

          {/* Actual finance entries */}
          {linkedEntries.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {linkedEntries.map((e) => (
                <p key={e.id} className={`text-xs ${e.type === "Income" ? "text-teal-400/70" : "text-rose-400/70"}`}>
                  {e.type === "Income" ? `收入 + ${fmtCurrency(e.amount)}` : `支出 − ${fmtCurrency(e.amount)}`}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Chevron */}
        <svg className="w-3.5 h-3.5 text-gray-700 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}
