import { useState, useMemo } from "react";
import type { Reminder, FinancialItem } from "../store";
import { loadFinanceEntries, fmtCurrency } from "../financeStore";
import { normalizeDate } from "../utils";
import { loadWorkProfiles, type WorkProfile } from "../workProfileStore";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  reminders: Reminder[];
  onEditReminder: (id: string) => void;
  onNavigateToAdd: () => void;
  onNavigateToReminders: () => void;
  onNavigateToFinance: () => void;
}

// ─── Derive financial items (same logic as FinancePage — no new store) ────────

function deriveFinancialItems(r: Reminder): FinancialItem[] {
  if (r.financialItems && r.financialItems.length > 0) return r.financialItems;
  if (
    (r.financialStatus === "receivable" || r.financialStatus === "payable") &&
    r.expectedAmount && r.expectedAmount > 0
  ) {
    return [{
      id: `legacy-${r.id}-fs`,
      title: r.title || (r.financialStatus === "receivable" ? "待收款項" : "待付款項"),
      type: r.financialStatus,
      amount: r.expectedAmount,
      dueDate: r.financialDueDate || undefined,
    }];
  }
  if (!r.financialStatus && r.type === "Payment" && r.amount) {
    const n = parseFloat(String(r.amount).replace(/,/g, ""));
    if (!isNaN(n) && n > 0) {
      return [{
        id: `legacy-${r.id}-pay`,
        title: r.title || "繳費",
        type: "payable",
        amount: n,
        dueDate: r.financialDueDate || undefined,
      }];
    }
  }
  if (!r.financialStatus && r.type === "Airport Transfer" && r.amount) {
    const n = parseFloat(String(r.amount).replace(/,/g, ""));
    if (!isNaN(n) && n > 0) {
      return [{
        id: `legacy-${r.id}-air`,
        title: r.title || "接送費",
        type: "receivable",
        amount: n,
      }];
    }
  }
  return [];
}

// ─── Transfer type label ──────────────────────────────────────────────────────

function xferTypeLabel(raw?: string): string {
  if (!raw) return "";
  if (raw === "接機" || raw === "pickup")  return "接機";
  if (raw === "送機" || raw === "dropoff") return "送機";
  if (raw === "charter")  return "包車";
  if (raw === "one_way")  return "單程";
  return raw;
}

// ─── Overdue days ─────────────────────────────────────────────────────────────

function overdueDays(dateStr: string, todayStr: string): number {
  const d = new Date(dateStr);
  const t = new Date(todayStr);
  return Math.max(0, Math.floor((t.getTime() - d.getTime()) / 86_400_000));
}

// ─── Short date label for upcoming rows ──────────────────────────────────────

function fmtShortDate(r: Reminder, tomorrowStr: string): string {
  const nd = normalizeDate(r.date);
  let startLabel: string;
  if (nd === tomorrowStr) {
    startLabel = "明天";
  } else {
    const parts = nd.split("-");
    startLabel = parts.length === 3
      ? `${parseInt(parts[1])}/${parseInt(parts[2])}`
      : nd;
  }
  if (r.dateMode === "range" && r.endDate) {
    const ep = r.endDate.split("-");
    const endLabel = ep.length === 3
      ? `${parseInt(ep[1])}/${parseInt(ep[2])}`
      : r.endDate;
    return `${startLabel}～${endLabel}`;
  }
  return startLabel;
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export function HomePage({
  reminders,
  onEditReminder,
  onNavigateToAdd,
  onNavigateToReminders,
  onNavigateToFinance,
}: Props) {
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  // Work profiles
  const [workProfiles] = useState<WorkProfile[]>(() => loadWorkProfiles());
  const wpMap = useMemo(() => {
    const m = new Map<string, WorkProfile>();
    workProfiles.forEach((wp) => m.set(wp.id, wp));
    return m;
  }, [workProfiles]);

  // Finance entries
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => loadFinanceEntries(), [reminders]);
  const confirmedItemIds = useMemo(
    () => new Set(entries.map((e) => e.sourceFinancialItemId).filter(Boolean) as string[]),
    [entries],
  );

  // ── Pending receivable / payable ──────────────────────────────────────────
  const allPendingReceivable = useMemo(() =>
    reminders.flatMap((r) =>
      deriveFinancialItems(r)
        .filter((i) => i.type === "receivable" && !i.completed && !confirmedItemIds.has(i.id))
        .map((i) => ({ item: i, reminder: r })),
    ), [reminders, confirmedItemIds]);

  const allPendingPayable = useMemo(() =>
    reminders.flatMap((r) =>
      deriveFinancialItems(r)
        .filter((i) => i.type === "payable" && !i.completed && !confirmedItemIds.has(i.id))
        .map((i) => ({ item: i, reminder: r })),
    ), [reminders, confirmedItemIds]);

  const receivableTotal = useMemo(
    () => allPendingReceivable.reduce((s, r) => s + r.item.amount, 0),
    [allPendingReceivable],
  );
  const payableTotal = useMemo(
    () => allPendingPayable.reduce((s, r) => s + r.item.amount, 0),
    [allPendingPayable],
  );

  // ── Today's items (includes range reminders spanning today) ──────────────
  const todayItems = useMemo(() =>
    reminders
      .filter((r) => {
        if (r.completed) return false;
        const nd = normalizeDate(r.date);
        if (nd === todayStr) return true;
        if (r.dateMode === "range" && r.endDate) {
          return nd <= todayStr && r.endDate >= todayStr;
        }
        return false;
      })
      .sort((a, b) => {
        const aAllDay = !!a.allDay, bAllDay = !!b.allDay;
        if (aAllDay && !bAllDay) return -1;
        if (!aAllDay && bAllDay) return 1;
        const at = a.startTime || "", bt = b.startTime || "";
        if (at && bt) return at.localeCompare(bt);
        if (at && !bt) return -1;
        if (!at && bt) return 1;
        return 0;
      }),
    [reminders, todayStr],
  );

  // ── All future items (not limited to 7 days) ─────────────────────────────
  const futureItems = useMemo(() =>
    reminders
      .filter((r) => {
        if (r.completed) return false;
        return normalizeDate(r.date) > todayStr;
      })
      .sort((a, b) => {
        const ad = normalizeDate(a.date), bd = normalizeDate(b.date);
        if (ad !== bd) return ad.localeCompare(bd);
        return (a.startTime || "").localeCompare(b.startTime || "");
      }),
    [reminders, todayStr],
  );

  // nextFutureItem: shown in 今天 block when today is empty
  const nextFutureItem = futureItems[0] ?? null;

  // upcomingItems: shown in 近期事項 block
  // If today is empty, the first future item is already shown as 下一件事項 — skip it
  const upcomingItems = todayItems.length === 0
    ? futureItems.slice(1, 5)
    : futureItems.slice(0, 5);

  // ── Overdue reminders ─────────────────────────────────────────────────────
  const overdueReminders = useMemo(() =>
    reminders
      .filter((r) => {
        const nd = normalizeDate(r.date);
        return nd && nd < todayStr && !r.completed;
      })
      .sort((a, b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date))),
    [reminders, todayStr],
  );

  const overdueReminderIdSet = useMemo(
    () => new Set(overdueReminders.map((r) => r.id)),
    [overdueReminders],
  );

  const overdueFinancialItems = useMemo(() => {
    const result: { item: FinancialItem; reminder: Reminder }[] = [];
    for (const r of reminders) {
      if (overdueReminderIdSet.has(r.id)) continue;
      for (const item of deriveFinancialItems(r)) {
        if (
          item.dueDate &&
          item.dueDate < todayStr &&
          !item.completed &&
          !confirmedItemIds.has(item.id)
        ) {
          result.push({ item, reminder: r });
        }
      }
    }
    return result.sort((a, b) => (a.item.dueDate || "").localeCompare(b.item.dueDate || ""));
  }, [reminders, todayStr, overdueReminderIdSet, confirmedItemIds]);

  const attentionCount = overdueReminders.length + overdueFinancialItems.length;

  // ── Date header ───────────────────────────────────────────────────────────
  const DAY_NAMES = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const dayOfWeek  = DAY_NAMES[today.getDay()];
  const dateLabel  = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-28">

      {/* ── Date header ─────────────────────────────────────────────────── */}
      <div className="mb-7">
        <p className="text-xs text-gray-500 mb-1">{dayOfWeek}</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">{dateLabel}</h1>
        <p className="text-sm text-gray-500 mt-2">
          {todayItems.length > 0 ? `今天有 ${todayItems.length} 件事情` : "今天沒有安排"}
        </p>
      </div>

      {/* ── 今天 ────────────────────────────────────────────────────────── */}
      <Section title="今天">
        {todayItems.length > 0 ? (
          <div className="space-y-2.5">
            {todayItems.map((r) => (
              <TodayCard
                key={r.id}
                reminder={r}
                wpMap={wpMap}
                confirmedItemIds={confirmedItemIds}
                onClick={() => onEditReminder(r.id)}
              />
            ))}
            <AddButton onClick={onNavigateToAdd} />
          </div>
        ) : (
          <div className="space-y-3">
            {nextFutureItem ? (
              <NextEventCard
                reminder={nextFutureItem}
                tomorrowStr={tomorrowStr}
                onClick={() => onEditReminder(nextFutureItem.id)}
              />
            ) : (
              <p className="text-sm text-gray-600 py-3 text-center">目前沒有安排事項</p>
            )}
            <AddButton onClick={onNavigateToAdd} />
          </div>
        )}
      </Section>

      {/* ── 近期事項 ─────────────────────────────────────────────────────── */}
      {upcomingItems.length > 0 && (
        <Section title="近期事項">
          <div className="rounded-2xl border border-white/8 overflow-hidden divide-y divide-white/5">
            {upcomingItems.map((r) => (
              <UpcomingRow
                key={r.id}
                reminder={r}
                wpMap={wpMap}
                dateLabel={fmtShortDate(r, tomorrowStr)}
                onClick={() => onEditReminder(r.id)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onNavigateToReminders}
            className="w-full mt-2.5 py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors text-center"
          >
            查看全部提醒事項 →
          </button>
        </Section>
      )}

      {/* ── 需要處理 ──────────────────────────────────────────────────────── */}
      {attentionCount > 0 && (
        <Section title="需要處理">
          <div className="space-y-2.5">
            {overdueReminders.map((r) => {
              const days = overdueDays(normalizeDate(r.date), todayStr);
              const items = deriveFinancialItems(r).filter(
                (i) => !i.completed && !confirmedItemIds.has(i.id),
              );
              const pendingAmt  = items.reduce((s, i) => s + i.amount, 0);
              const pendingType = items[0]?.type;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onEditReminder(r.id)}
                  className="w-full text-left rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-4 py-3.5 hover:bg-rose-500/[0.08] transition-colors"
                >
                  <p className="text-[10px] text-rose-400/80 font-medium mb-1">逾期 {days} 天</p>
                  <p className="text-sm font-semibold text-white leading-snug truncate">{r.title}</p>
                  {pendingAmt > 0 && pendingType && (
                    <p className={`text-xs mt-1 ${pendingType === "receivable" ? "text-teal-400" : "text-rose-400"}`}>
                      {pendingType === "receivable" ? "待收" : "待付"} {fmtCurrency(pendingAmt)}
                    </p>
                  )}
                </button>
              );
            })}
            {overdueFinancialItems.map(({ item, reminder }) => {
              const days = overdueDays(item.dueDate!, todayStr);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onEditReminder(reminder.id)}
                  className="w-full text-left rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-4 py-3.5 hover:bg-rose-500/[0.08] transition-colors"
                >
                  <p className="text-[10px] text-rose-400/80 font-medium mb-1">逾期 {days} 天</p>
                  <p className="text-sm font-semibold text-white leading-snug truncate">
                    {item.title !== reminder.title && item.title ? item.title : reminder.title}
                  </p>
                  <p className={`text-xs mt-1 ${item.type === "receivable" ? "text-teal-400" : "text-rose-400"}`}>
                    {item.type === "receivable" ? "待收" : "待付"} {fmtCurrency(item.amount)}
                  </p>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── 收支摘要 (只在有待收 / 待付時顯示) ─────────────────────────── */}
      {(receivableTotal > 0 || payableTotal > 0) && (
        <Section title="收支摘要">
          <div className="space-y-2">
            {receivableTotal > 0 && (
              <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-teal-500/20 bg-teal-500/[0.05]">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-teal-500/70 font-medium">待收</p>
                  <p className="text-xs text-teal-600/70">{allPendingReceivable.length} 筆</p>
                </div>
                <p className="text-base font-bold text-teal-300 tabular-nums">{fmtCurrency(receivableTotal)}</p>
              </div>
            )}
            {payableTotal > 0 && (
              <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.05]">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-rose-500/70 font-medium">待付</p>
                  <p className="text-xs text-rose-600/70">{allPendingPayable.length} 筆</p>
                </div>
                <p className="text-base font-bold text-rose-300 tabular-nums">{fmtCurrency(payableTotal)}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onNavigateToFinance}
            className="w-full mt-2.5 py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors text-center"
          >
            查看收支 →
          </button>
        </Section>
      )}

    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

// ─── AddButton ────────────────────────────────────────────────────────────────

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-3 rounded-xl border border-dashed border-white/15 text-gray-500 text-sm hover:border-white/25 hover:text-gray-300 transition-all text-center font-medium"
    >
      ＋ 新增事項
    </button>
  );
}

// ─── NextEventCard — shown in 今天 block when today has no items ──────────────

function NextEventCard({
  reminder: r,
  tomorrowStr,
  onClick,
}: {
  reminder: Reminder;
  tomorrowStr: string;
  onClick: () => void;
}) {
  const nd = normalizeDate(r.date);
  let dateChip: string;
  if (nd === tomorrowStr) {
    dateChip = "明天";
  } else {
    const parts = nd.split("-");
    dateChip = parts.length === 3
      ? `${parseInt(parts[1])}/${parseInt(parts[2])}`
      : nd;
  }
  if (r.dateMode === "range" && r.endDate) {
    const ep = r.endDate.split("-");
    const endLabel = ep.length === 3 ? `${parseInt(ep[1])}/${parseInt(ep[2])}` : r.endDate;
    dateChip = `${dateChip}～${endLabel}`;
  }

  const timeRange = r.allDay
    ? "全天"
    : r.startTime
      ? r.endTime && r.endTime !== r.startTime
        ? `${r.startTime}－${r.endTime}`
        : r.startTime
      : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-white/12 bg-white/[0.04] hover:bg-white/[0.07] px-5 py-4 transition-colors"
    >
      <p className="text-xs text-gray-500 mb-2.5 font-medium">下一件事項</p>
      <p className="text-xs text-blue-400/80 tabular-nums mb-1.5">
        {dateChip}{timeRange ? `　${timeRange}` : ""}
      </p>
      <p className="text-base font-bold text-white leading-snug">{r.title}</p>
      {r.location && <p className="text-sm text-gray-500 mt-1">{r.location}</p>}
    </button>
  );
}

// ─── UpcomingRow — compact row for 近期事項 ──────────────────────────────────

function UpcomingRow({
  reminder: r,
  wpMap,
  dateLabel,
  onClick,
}: {
  reminder: Reminder;
  wpMap: Map<string, WorkProfile>;
  dateLabel: string;
  onClick: () => void;
}) {
  const wp = r.workProfileId ? wpMap.get(r.workProfileId) : undefined;
  const timeStr = r.allDay
    ? ""
    : r.startTime
      ? r.endTime && r.endTime !== r.startTime
        ? `${r.startTime}－${r.endTime}`
        : r.startTime
      : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.06] transition-colors"
    >
      <div className="w-[4.5rem] shrink-0">
        <p className="text-xs font-semibold text-blue-300/80 leading-tight whitespace-nowrap truncate">{dateLabel}</p>
        {timeStr && (
          <p className="text-[11px] text-gray-600 tabular-nums mt-0.5">{timeStr}</p>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{r.title}</p>
        {(r.location || wp) && (
          <p className="text-xs text-gray-600 truncate mt-0.5">
            {[r.location, wp?.name].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <svg className="w-3 h-3 text-gray-700 shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ─── TodayCard ────────────────────────────────────────────────────────────────

function TodayCard({
  reminder: r,
  wpMap,
  confirmedItemIds,
  onClick,
}: {
  reminder: Reminder;
  wpMap: Map<string, WorkProfile>;
  confirmedItemIds: Set<string>;
  onClick: () => void;
}) {
  const isAirport = r.type === "Airport Transfer";
  const wp = r.workProfileId ? wpMap.get(r.workProfileId) : undefined;

  const financialItems = deriveFinancialItems(r).filter(
    (i) => !i.completed && !confirmedItemIds.has(i.id),
  );
  const pendingReceivable = financialItems.filter((i) => i.type === "receivable");
  const pendingPayable    = financialItems.filter((i) => i.type === "payable");
  const receivableAmt     = pendingReceivable.reduce((s, i) => s + i.amount, 0);
  const payableAmt        = pendingPayable.reduce((s, i) => s + i.amount, 0);

  const at     = r.templateData?.airportTransfer;
  const xType  = xferTypeLabel(r.transferType || at?.transferType);
  const flight = r.flightNumber || "";
  const pickup = at?.pickupLocation || r.district || "";
  const dest   = at?.destination || "";
  const route  = dest ? `${pickup || "—"} → ${dest}` : pickup;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] px-4 py-3.5 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 shrink-0 pt-0.5">
          {r.allDay ? (
            <p className="text-[10px] text-gray-600 font-medium">全天</p>
          ) : r.startTime ? (
            <p className="text-xs font-semibold text-gray-400 tabular-nums">{r.startTime}</p>
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <TypeChip type={r.type} />
            {wp && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 border border-white/12 text-gray-400">
                {wp.name}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-snug truncate">{r.title}</p>
          {isAirport && (xType || flight || route) && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {[xType, flight].filter(Boolean).join(" · ")}
              {route && ` · ${route}`}
            </p>
          )}
          {!isAirport && r.location && (
            <p className="text-xs text-gray-600 mt-1 truncate">{r.location}</p>
          )}
          {receivableAmt > 0 && (
            <p className="text-xs text-teal-400 mt-1">待收 {fmtCurrency(receivableAmt)}</p>
          )}
          {payableAmt > 0 && (
            <p className="text-xs text-rose-400 mt-1">待付 {fmtCurrency(payableAmt)}</p>
          )}
        </div>
        <svg className="w-3.5 h-3.5 text-gray-700 shrink-0 mt-1" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

// ─── TypeChip ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Partial<Record<string, string>> = {
  "Course":           "課程",
  "Airport Transfer": "機場接送",
  "Medical":          "醫療",
  "Shopping":         "購物",
  "Payment":          "繳費",
  "Income":           "收入",
  "Expense":          "支出",
  "Work":             "工作",
  "Family":           "家庭",
  "General":          "一般",
  "Pending":          "待確認",
};

const TYPE_COLORS: Partial<Record<string, string>> = {
  "Course":           "bg-blue-500/15 text-blue-300 border-blue-500/20",
  "Airport Transfer": "bg-violet-500/15 text-violet-300 border-violet-500/20",
  "Medical":          "bg-rose-500/15 text-rose-300 border-rose-500/20",
  "Shopping":         "bg-amber-500/15 text-amber-300 border-amber-500/20",
  "Payment":          "bg-orange-500/15 text-orange-300 border-orange-500/20",
  "Income":           "bg-teal-500/15 text-teal-300 border-teal-500/20",
  "Expense":          "bg-orange-500/15 text-orange-300 border-orange-500/20",
  "Work":             "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
  "Family":           "bg-pink-500/15 text-pink-300 border-pink-500/20",
  "General":          "bg-white/8 text-gray-400 border-white/12",
  "Pending":          "bg-white/8 text-gray-400 border-white/12",
};

function TypeChip({ type }: { type: string }) {
  const label  = TYPE_LABELS[type] ?? type;
  const colors = TYPE_COLORS[type] ?? "bg-white/8 text-gray-400 border-white/12";
  return (
    <span className={`inline-block border rounded-full font-medium text-[10px] px-1.5 py-0.5 ${colors}`}>
      {label}
    </span>
  );
}
