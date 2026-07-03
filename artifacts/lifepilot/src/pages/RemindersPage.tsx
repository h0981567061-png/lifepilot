import { useState, useMemo } from "react";
import { type Reminder, type ReminderType } from "../store";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseReminderDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const md = dateStr.match(/^(\d{1,2})\/(\d{1,2})/);
  if (md) {
    const d = new Date(new Date().getFullYear(), parseInt(md[1]) - 1, parseInt(md[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function displayDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.replace(/-/g, "/");
  return dateStr;
}

function isOverdue(dateStr: string, completed: boolean): boolean {
  if (completed || !dateStr) return false;
  const d = parseReminderDate(dateStr);
  if (!d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

type DateGroup = "overdue" | "today" | "tomorrow" | "this-week" | "later" | "no-date";

function getDateGroup(r: Reminder): DateGroup {
  const date = parseReminderDate(r.date);
  if (!date) return "no-date";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  if (diff < 0)                     return "overdue";
  if (diff === 0)                   return "today";
  if (diff === 86_400_000)          return "tomorrow";
  if (diff <= 7 * 86_400_000)       return "this-week";
  return "later";
}

const GROUP_ORDER: DateGroup[] = ["overdue", "today", "tomorrow", "this-week", "later", "no-date"];

const GROUP_META: Record<DateGroup, { label: string; accent: string }> = {
  overdue:    { label: "已過期",  accent: "text-rose-400" },
  today:      { label: "今天",    accent: "text-blue-400" },
  tomorrow:   { label: "明天",    accent: "text-amber-400" },
  "this-week":{ label: "本週",    accent: "text-emerald-400" },
  later:      { label: "稍後",    accent: "text-gray-400" },
  "no-date":  { label: "無日期",  accent: "text-gray-500" },
};

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<ReminderType, { label: string; className: string }> = {
  Course:           { label: "課程",   className: "bg-blue-500/15 text-blue-300 border-blue-500/25" },
  "Airport Transfer":{ label: "接送機", className: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  Medical:          { label: "醫療",   className: "bg-rose-500/15 text-rose-300 border-rose-500/25" },
  Shopping:         { label: "購物",   className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  Payment:          { label: "付款",   className: "bg-purple-500/15 text-purple-300 border-purple-500/25" },
  Pending:          { label: "待確認", className: "bg-white/10 text-gray-400 border-white/15" },
  Income:           { label: "收入",   className: "bg-teal-500/15 text-teal-300 border-teal-500/25" },
  Expense:          { label: "支出",   className: "bg-red-500/15 text-red-300 border-red-500/25" },
  Work:             { label: "工作",   className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25" },
  Family:           { label: "家庭",   className: "bg-pink-500/15 text-pink-300 border-pink-500/25" },
  General:          { label: "一般",   className: "bg-gray-500/15 text-gray-300 border-gray-500/25" },
};

// Quick-record types (for the "＋記帳" shortcut)
const FINANCE_TYPES: ReminderType[] = ["Income", "Expense"];

// Filter tabs
type FilterTab = "all" | ReminderType;
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all",              label: "全部" },
  { key: "Course",           label: "課程" },
  { key: "Airport Transfer", label: "接送" },
  { key: "Medical",          label: "醫療" },
  { key: "Shopping",         label: "購物" },
  { key: "Payment",          label: "付款" },
  { key: "Income",           label: "收入" },
  { key: "Expense",          label: "支出" },
  { key: "Work",             label: "工作" },
  { key: "Family",           label: "家庭" },
];

// ─── Type-specific detail rows ────────────────────────────────────────────────

function TypeDetails({ reminder }: { reminder: Reminder }) {
  switch (reminder.type) {
    case "Airport Transfer":
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {reminder.transferType && (
            <span className={reminder.transferType === "接機" ? "text-emerald-400/70" : "text-sky-400/70"}>
              {reminder.transferType}
            </span>
          )}
          {reminder.flightNumber && <span>✈ {reminder.flightNumber}</span>}
          {reminder.district && <span>{reminder.district}</span>}
          {reminder.vehicleType && <span>{reminder.vehicleType}</span>}
          {reminder.price && <span>{reminder.price} 元</span>}
        </div>
      );
    case "Shopping":
      if (!reminder.shoppingItems?.length) return null;
      return (
        <div className="text-xs text-gray-500">
          <span className="text-gray-600">{reminder.shoppingItems.length} 項：</span>
          {reminder.shoppingItems.slice(0, 4).join("、")}
          {reminder.shoppingItems.length > 4 && (
            <span className="text-gray-600"> 等 {reminder.shoppingItems.length} 項</span>
          )}
        </div>
      );
    case "Payment":
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {reminder.dueDate && <span>截止 {reminder.dueDate}</span>}
          {reminder.amount && <span className="text-purple-400/70">{reminder.amount} 元</span>}
        </div>
      );
    case "Medical":
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {reminder.hospital && <span>{reminder.hospital}</span>}
          {reminder.department && <span className="text-rose-400/70">{reminder.department}</span>}
        </div>
      );
    case "Income":
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {reminder.amount && <span className="text-teal-400/70">+ {reminder.amount} 元</span>}
          {reminder.source && <span>{reminder.source}</span>}
        </div>
      );
    case "Expense":
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {reminder.amount && <span className="text-red-400/70">- {reminder.amount} 元</span>}
          {reminder.merchant && <span>{reminder.merchant}</span>}
        </div>
      );
    default:
      if (!reminder.notes) return null;
      return <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{reminder.notes}</p>;
  }
}

// ─── Reminder Card ────────────────────────────────────────────────────────────

function ReminderCard({
  reminder,
  onToggleComplete,
  onDelete,
  onEdit,
  onQuickFinance,
}: {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onQuickFinance: (id: string) => void;
}) {
  const badge    = TYPE_BADGE[reminder.type] ?? TYPE_BADGE.Pending;
  const overdue  = isOverdue(reminder.date, reminder.completed);
  const isFinance = FINANCE_TYPES.includes(reminder.type);

  return (
    <div
      onClick={() => onEdit(reminder.id)}
      className={`rounded-xl border p-4 flex items-start gap-3 transition-all duration-150 cursor-pointer group ${
        reminder.completed
          ? "border-white/5 bg-white/[0.02] opacity-50"
          : overdue
            ? "border-rose-500/20 bg-rose-500/[0.04] hover:border-rose-500/30 hover:bg-rose-500/[0.07]"
            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
      }`}
    >
      {/* Complete toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleComplete(reminder.id); }}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 transition-all duration-150 flex items-center justify-center ${
          reminder.completed
            ? "border-blue-500 bg-blue-500"
            : overdue
              ? "border-rose-500/50 hover:border-rose-400"
              : "border-white/25 hover:border-white/50"
        }`}
        title={reminder.completed ? "標記為未完成" : "標記為完成"}
      >
        {reminder.completed && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start gap-2 flex-wrap mb-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${badge.className}`}>
            {badge.label}
          </span>
          {overdue && (
            <span className="text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 bg-rose-500/15 text-rose-300 border-rose-500/25">
              已過期
            </span>
          )}
          {reminder.category && (
            <span className="text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 bg-white/5 text-gray-400 border-white/10">
              {reminder.category}
            </span>
          )}
          <p className={`font-semibold leading-snug text-sm ${reminder.completed ? "line-through text-gray-500" : "text-white"}`}>
            {reminder.title}
          </p>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-1.5">
          {reminder.date && <span>{displayDate(reminder.date)}</span>}
          {reminder.startTime && <span>{reminder.startTime}</span>}
          {reminder.endTime && reminder.endTime !== reminder.startTime && <span>— {reminder.endTime}</span>}
          {reminder.location && <span>📍 {reminder.location}</span>}
        </div>

        {/* Type-specific details */}
        <TypeDetails reminder={reminder} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Quick finance button — only for non-finance reminders */}
        {!isFinance && !reminder.completed && (
          <button
            onClick={() => onQuickFinance(reminder.id)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-600 hover:text-teal-400 hover:bg-teal-500/10 transition-all duration-150 opacity-0 group-hover:opacity-100"
            title="快速記帳"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M7 4.5v5M4.5 7h5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {/* Delete */}
        <button
          onClick={() => onDelete(reminder.id)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
          title="刪除"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7a.5.5 0 00.5.5h5.6a.5.5 0 00.5-.5l.7-7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Quick Finance Modal ──────────────────────────────────────────────────────

function QuickFinanceModal({
  reminder,
  onConfirm,
  onCancel,
}: {
  reminder: Reminder;
  onConfirm: (type: "Income" | "Expense", amount: string) => void;
  onCancel: () => void;
}) {
  const [type, setType]     = useState<"Income" | "Expense">("Expense");
  const [amount, setAmount] = useState(reminder.amount ?? reminder.price ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border-t border-white/10 rounded-t-2xl p-6 pb-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">快速記帳</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <p className="text-xs text-gray-500 truncate">來自：{reminder.title}</p>

        {/* Income / Expense toggle */}
        <div className="flex rounded-xl bg-white/5 border border-white/8 p-1 gap-1">
          {(["Expense", "Income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === t
                  ? t === "Income"
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/25"
                    : "bg-orange-500/20 text-orange-300 border border-orange-500/25"
                  : "text-gray-500 hover:text-gray-400"
              }`}
            >
              {t === "Income" ? "💰 收入" : "💸 支出"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <span className="text-gray-500 text-sm shrink-0">NT$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金額"
            autoFocus
            className="flex-1 bg-transparent text-white text-lg font-semibold focus:outline-none placeholder-gray-700"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => onConfirm(type, amount)}
            disabled={!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
          >
            記帳
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function RemindersPage({
  reminders,
  onToggleComplete,
  onDelete,
  onEdit,
  onQuickFinance,
}: {
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onQuickFinance?: (reminderId: string, type: "Income" | "Expense", amount: string) => void;
}) {
  const [search,        setSearch]        = useState("");
  const [filterTab,     setFilterTab]     = useState<FilterTab>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [quickId,       setQuickId]       = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeCount   = reminders.filter((r) => !r.completed).length;
  const overdueCount  = reminders.filter((r) => isOverdue(r.date, r.completed)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reminders.filter((r) => {
      if (!showCompleted && r.completed) return false;
      if (filterTab !== "all" && r.type !== filterTab) return false;
      if (!q) return true;
      return (
        r.title?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q) ||
        r.hospital?.toLowerCase().includes(q) ||
        r.flightNumber?.toLowerCase().includes(q)
      );
    });
  }, [reminders, search, filterTab, showCompleted]);

  // Group
  const groups = useMemo(() => {
    const g: Record<DateGroup, Reminder[]> = {
      overdue: [], today: [], tomorrow: [], "this-week": [], later: [], "no-date": [],
    };
    for (const r of filtered) {
      g[getDateGroup(r)].push(r);
    }
    return g;
  }, [filtered]);

  // Quick finance reminder lookup
  const quickReminder = quickId ? reminders.find((r) => r.id === quickId) : null;

  function handleQuickConfirm(type: "Income" | "Expense", amount: string) {
    if (!quickId) return;
    onQuickFinance?.(quickId, type, amount);
    setQuickId(null);
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (reminders.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">提醒事項</h1>
          <p className="text-gray-500 text-sm">0 筆</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-2xl text-gray-600">○</span>
          </div>
          <p className="text-gray-500 text-sm text-center">
            還沒有提醒事項<br />分析訊息後建立所選即可加入
          </p>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="max-w-2xl mx-auto px-6 py-10 pb-24">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">提醒事項</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{activeCount} 筆未完成</span>
              {overdueCount > 0 && (
                <span className="text-rose-400 font-medium">· {overdueCount} 筆過期</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              showCompleted
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
            }`}
          >
            {showCompleted ? "隱藏已完成" : "顯示已完成"}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋標題、分類、地點…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter tabs — horizontal scroll */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          {FILTER_TABS.map(({ key, label }) => {
            const count = key === "all"
              ? filtered.length
              : filtered.filter((r) => r.type === key).length;
            if (key !== "all" && count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterTab(key)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filterTab === key
                    ? "bg-blue-600/20 text-blue-300 border-blue-500/30"
                    : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20"
                }`}
              >
                {label}
                {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* No results */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <p className="text-gray-500 text-sm">找不到符合條件的事項</p>
            {search && (
              <button onClick={() => setSearch("")} className="text-xs text-blue-400 hover:text-blue-300">
                清除搜尋
              </button>
            )}
          </div>
        )}

        {/* Grouped list */}
        <div className="flex flex-col gap-8">
          {GROUP_ORDER.map((group) => {
            const items = groups[group];
            if (items.length === 0) return null;
            const meta = GROUP_META[group];
            return (
              <section key={group}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className={`text-xs uppercase tracking-widest font-semibold ${meta.accent}`}>
                    {meta.label}
                  </h2>
                  <span className="text-xs text-gray-700">{items.length}</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((r) => (
                    <ReminderCard
                      key={r.id}
                      reminder={r}
                      onToggleComplete={onToggleComplete}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onQuickFinance={(id) => setQuickId(id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Quick Finance Modal */}
      {quickReminder && (
        <QuickFinanceModal
          reminder={quickReminder}
          onConfirm={handleQuickConfirm}
          onCancel={() => setQuickId(null)}
        />
      )}
    </>
  );
}
