import { type Reminder, type ReminderType } from "../store";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseReminderDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const month = parseInt(m[1], 10) - 1;
  const day = parseInt(m[2], 10);
  const year = new Date().getFullYear();
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

type DateGroup = "today" | "tomorrow" | "this-week" | "later" | "none";

function getDateGroup(dateStr: string): DateGroup {
  const date = parseReminderDate(dateStr);
  if (!date) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  date.setHours(0, 0, 0, 0);
  const t = date.getTime();

  if (t === today.getTime()) return "today";
  if (t === tomorrow.getTime()) return "tomorrow";
  if (t > today.getTime() && t <= nextWeek.getTime()) return "this-week";
  return "later";
}

const GROUP_ORDER: DateGroup[] = ["today", "tomorrow", "this-week", "later", "none"];
const GROUP_LABEL: Record<DateGroup, string> = {
  today: "今天",
  tomorrow: "明天",
  "this-week": "本週",
  later: "稍後",
  none: "無日期",
};

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<ReminderType, { label: string; className: string }> = {
  Course: {
    label: "課程",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  },
  "Airport Transfer": {
    label: "接送機",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  },
  Medical: {
    label: "醫療",
    className: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  },
  Shopping: {
    label: "購物",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  },
  Payment: {
    label: "付款",
    className: "bg-purple-500/15 text-purple-300 border-purple-500/25",
  },
  Pending: {
    label: "待確認",
    className: "bg-white/10 text-gray-400 border-white/15",
  },
};

// ─── Reminder card ────────────────────────────────────────────────────────────

function ReminderCard({
  reminder,
  onToggleComplete,
  onDelete,
}: {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const badge = TYPE_BADGE[reminder.type];

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-3 transition-all duration-150 ${
        reminder.completed
          ? "border-white/5 bg-white/[0.02] opacity-50"
          : "border-white/10 bg-white/5"
      }`}
    >
      {/* Complete toggle */}
      <button
        onClick={() => onToggleComplete(reminder.id)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 transition-all duration-150 flex items-center justify-center ${
          reminder.completed
            ? "border-blue-500 bg-blue-500"
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
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${badge.className}`}
          >
            {badge.label}
          </span>
          <p
            className={`font-semibold leading-snug text-sm ${
              reminder.completed ? "line-through text-gray-500" : "text-white"
            }`}
          >
            {reminder.title}
          </p>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-1.5">
          {reminder.date && <span>{reminder.date}</span>}
          {reminder.startTime && <span>{reminder.startTime}</span>}
          {reminder.location && <span>{reminder.location}</span>}
        </div>

        {/* Type-specific details */}
        <TypeDetails reminder={reminder} />
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(reminder.id)}
        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        title="刪除"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
          <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7a.5.5 0 00.5.5h5.6a.5.5 0 00.5-.5l.7-7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

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
          <span className="text-gray-600">
            {reminder.shoppingItems.length} 項：
          </span>
          {reminder.shoppingItems.slice(0, 4).join("、")}
          {reminder.shoppingItems.length > 4 && (
            <span className="text-gray-600">
              {" "}等 {reminder.shoppingItems.length} 項
            </span>
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

    default:
      if (!reminder.notes) return null;
      return (
        <p className="text-xs text-gray-600 leading-relaxed">{reminder.notes}</p>
      );
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function RemindersPage({
  reminders,
  onToggleComplete,
  onDelete,
}: {
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const activeCount = reminders.filter((r) => !r.completed).length;

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
            還沒有提醒事項
            <br />
            分析訊息後建立所選即可加入
          </p>
        </div>
      </div>
    );
  }

  // Group reminders
  const groups: Record<DateGroup, Reminder[]> = {
    today: [],
    tomorrow: [],
    "this-week": [],
    later: [],
    none: [],
  };

  for (const r of reminders) {
    const g = getDateGroup(r.date);
    groups[g].push(r);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">提醒事項</h1>
          <p className="text-gray-500 text-sm">{activeCount} 筆未完成，共 {reminders.length} 筆</p>
        </div>
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-8">
        {GROUP_ORDER.map((group) => {
          const items = groups[group];
          if (items.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">
                {GROUP_LABEL[group]}
              </h2>
              <div className="flex flex-col gap-2">
                {items.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    onToggleComplete={onToggleComplete}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
