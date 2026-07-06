import { useState, useMemo } from "react";
import type { Reminder, FinancialItem } from "../store";
import { updateReminder } from "../store";
import type { FinanceEntry, FinanceType } from "../financeStore";
import {
  loadFinanceEntries,
  saveFinanceEntries,
  fmtCurrency,
  monthPrefix,
} from "../financeStore";
import { FinanceEditor } from "./FinanceEditor";
import { normalizeDate } from "../utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  reminders?: Reminder[];
  onEditReminder?: (id: string) => void;
  onRemindersChange?: (reminders: Reminder[]) => void;
}

// ─── Filter type ──────────────────────────────────────────────────────────────

type FilterType = "all" | "income" | "expense" | "receivable" | "payable";

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all",        label: "全部" },
  { key: "income",     label: "收入" },
  { key: "expense",    label: "支出" },
  { key: "receivable", label: "待收" },
  { key: "payable",    label: "待付" },
];

// ─── Derive financial items from a reminder (same logic as EditPage) ──────────

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
        dueDate: r.financialDueDate || (r.dueDate ? normalizeDate(r.dueDate) : undefined),
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

// ─── Pending item reference ───────────────────────────────────────────────────

interface PendingRef {
  item: FinancialItem;
  reminder: Reminder;
}

function getPendingItems(
  reminders: Reminder[],
  type: "receivable" | "payable",
  entries: FinanceEntry[],
): PendingRef[] {
  const confirmedIds = new Set(entries.map((e) => e.sourceFinancialItemId).filter(Boolean));
  return reminders
    .flatMap((r) =>
      deriveFinancialItems(r)
        .filter((i) => i.type === type && !i.completed && !confirmedIds.has(i.id))
        .map((i) => ({ item: i, reminder: r })),
    )
    .sort((a, b) => {
      if (!a.item.dueDate && !b.item.dueDate) return 0;
      if (!a.item.dueDate) return 1;
      if (!b.item.dueDate) return -1;
      return a.item.dueDate.localeCompare(b.item.dueDate);
    });
}

// ─── List item union type ─────────────────────────────────────────────────────

type ListItem =
  | { kind: "entry";   data: FinanceEntry; sortDate: string }
  | { kind: "pending"; pendingRef: PendingRef; sortDate: string };

// ─── Date group header formatter ──────────────────────────────────────────────

function fmtGroupDate(dateStr: string): string {
  if (!dateStr) return "未指定日期";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${Number(parts[1])} 月 ${Number(parts[2])} 日`;
}

// ─── FinancePage ──────────────────────────────────────────────────────────────

export function FinancePage({ reminders: propReminders = [], onEditReminder, onRemindersChange }: Props) {
  const todayDate = new Date();
  const todayStr  = todayDate.toISOString().substring(0, 10);

  // ── State ───────────────────────────────────────────────────────────────────
  const [entries,           setEntries]           = useState<FinanceEntry[]>(() => loadFinanceEntries());
  const [filterType,        setFilterType]        = useState<FilterType>("all");
  const [editorMode,        setEditorMode]        = useState<"idle" | "add" | "edit">("idle");
  const [editingEntry,      setEditingEntry]      = useState<FinanceEntry | null>(null);
  const [defaultEditorType, setDefaultEditorType] = useState<FinanceType>("Expense");
  const [year,              setYear]              = useState(todayDate.getFullYear());
  const [month,             setMonth]             = useState(todayDate.getMonth() + 1);
  const [confirmingRef,     setConfirmingRef]     = useState<PendingRef | null>(null);
  const [confirmAmount,     setConfirmAmount]     = useState("");
  const [confirmDate,       setConfirmDate]       = useState(todayStr);
  const [confirmNote,       setConfirmNote]       = useState("");
  const [confirmSubmit,     setConfirmSubmit]     = useState(false);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const prefix = monthPrefix(year, month);
  const isThisMonth = year === todayDate.getFullYear() && month === (todayDate.getMonth() + 1);

  const allReceivable = useMemo(
    () => getPendingItems(propReminders, "receivable", entries),
    [propReminders, entries],
  );
  const allPayable = useMemo(
    () => getPendingItems(propReminders, "payable", entries),
    [propReminders, entries],
  );

  const monthIncomeEntries = useMemo(
    () => entries.filter((e) => e.type === "Income"   && e.date.startsWith(prefix)),
    [entries, prefix],
  );
  const monthExpenseEntries = useMemo(
    () => entries.filter((e) => e.type === "Expense"  && e.date.startsWith(prefix)),
    [entries, prefix],
  );
  const monthReceivable = useMemo(
    () => allReceivable.filter((r) => r.item.dueDate?.startsWith(prefix)),
    [allReceivable, prefix],
  );
  const monthPayable = useMemo(
    () => allPayable.filter((r) => r.item.dueDate?.startsWith(prefix)),
    [allPayable, prefix],
  );

  const incomeTotal     = useMemo(() => monthIncomeEntries.reduce((s, e) => s + e.amount, 0),  [monthIncomeEntries]);
  const expenseTotal    = useMemo(() => monthExpenseEntries.reduce((s, e) => s + e.amount, 0), [monthExpenseEntries]);
  const balance         = incomeTotal - expenseTotal;
  const receivableTotal = useMemo(() => monthReceivable.reduce((s, r) => s + r.item.amount, 0), [monthReceivable]);
  const payableTotal    = useMemo(() => monthPayable.reduce((s, r) => s + r.item.amount, 0),    [monthPayable]);

  // Unified list for selected filter, sorted by date descending
  const listItems = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    if (filterType === "all" || filterType === "income") {
      monthIncomeEntries.forEach((e) => items.push({ kind: "entry", data: e, sortDate: e.date }));
    }
    if (filterType === "all" || filterType === "expense") {
      monthExpenseEntries.forEach((e) => items.push({ kind: "entry", data: e, sortDate: e.date }));
    }
    if (filterType === "all" || filterType === "receivable") {
      monthReceivable.forEach((r) =>
        items.push({ kind: "pending", pendingRef: r, sortDate: r.item.dueDate ?? "" }),
      );
    }
    if (filterType === "all" || filterType === "payable") {
      monthPayable.forEach((r) =>
        items.push({ kind: "pending", pendingRef: r, sortDate: r.item.dueDate ?? "" }),
      );
    }
    return items.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  }, [filterType, monthIncomeEntries, monthExpenseEntries, monthReceivable, monthPayable]);

  // Group by date key
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ListItem[]>();
    for (const item of listItems) {
      const key = item.sortDate || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [listItems]);

  // ── Month navigation ─────────────────────────────────────────────────────────
  function prevMonth() {
    setConfirmingRef(null);
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    setConfirmingRef(null);
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  function goToThisMonth() {
    setConfirmingRef(null);
    setYear(todayDate.getFullYear());
    setMonth(todayDate.getMonth() + 1);
  }

  // ── Finance editor handlers ───────────────────────────────────────────────
  function mutate(fn: (prev: FinanceEntry[]) => FinanceEntry[]) {
    setEntries((prev) => {
      const next = fn(prev);
      saveFinanceEntries(next);
      return next;
    });
  }

  function handleEditorSave(saved: FinanceEntry) {
    mutate((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setEditorMode("idle");
    setEditingEntry(null);
    const [ey, em] = saved.date.split("-").map(Number);
    setYear(ey);
    setMonth(em);
  }

  function handleEditorDelete() {
    if (!editingEntry) return;
    if (editingEntry.sourceFinancialItemId && editingEntry.sourceReminderId) {
      const linkedReminder = propReminders.find((r) => r.id === editingEntry.sourceReminderId);
      if (linkedReminder) {
        const baseItems = linkedReminder.financialItems ?? [];
        const hasItem = baseItems.some((i) => i.id === editingEntry.sourceFinancialItemId);
        if (hasItem) {
          const restoredItems = baseItems.map((i) =>
            i.id === editingEntry.sourceFinancialItemId
              ? { ...i, completed: false, completedDate: undefined }
              : i,
          );
          const updated = updateReminder(linkedReminder.id, { financialItems: restoredItems });
          onRemindersChange?.(updated);
        }
      }
    }
    mutate((prev) => prev.filter((e) => e.id !== editingEntry.id));
    setEditorMode("idle");
    setEditingEntry(null);
  }

  function openAdd(type: FinanceType = "Expense") {
    setDefaultEditorType(type);
    setEditingEntry(null);
    setEditorMode("add");
  }

  function openEdit(entry: FinanceEntry) {
    setEditingEntry(entry);
    setEditorMode("edit");
  }

  // ── Confirm flow handlers ─────────────────────────────────────────────────
  function handleStartConfirm(ref: PendingRef) {
    setConfirmingRef(ref);
    setConfirmAmount(String(ref.item.amount));
    setConfirmDate(todayStr);
    setConfirmNote(ref.item.note ?? "");
    setConfirmSubmit(false);
  }

  function handleConfirm() {
    if (!confirmingRef || confirmSubmit) return;
    const { item, reminder } = confirmingRef;
    if (entries.some((e) => e.sourceFinancialItemId === item.id)) {
      setConfirmingRef(null);
      return;
    }
    const amt = parseFloat(confirmAmount.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) return;
    setConfirmSubmit(true);
    const now           = new Date().toISOString();
    const confirmedDate = confirmDate || todayStr;
    const entry: FinanceEntry = {
      id: crypto.randomUUID(),
      type: item.type === "receivable" ? "Income" : "Expense",
      title: item.title || reminder.title,
      amount: amt,
      date: confirmedDate,
      financialCategory: "",
      note: confirmNote.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      sourceReminderId: reminder.id,
      sourceFinancialItemId: item.id,
    };
    const allEntries = loadFinanceEntries();
    saveFinanceEntries([...allEntries, entry]);
    setEntries([...allEntries, entry]);
    const baseItems = reminder.financialItems && reminder.financialItems.length > 0
      ? reminder.financialItems
      : deriveFinancialItems(reminder);
    const updatedItems = baseItems.map((i) =>
      i.id === item.id ? { ...i, completed: true, completedDate: confirmedDate } : i,
    );
    const updated = updateReminder(reminder.id, {
      financialItems: updatedItems,
      financialStatus: undefined,
      expectedAmount:  undefined,
      financialDueDate: undefined,
    });
    onRemindersChange?.(updated);
    // Navigate to the confirmed entry's month
    const [ey, em] = confirmedDate.split("-").map(Number);
    setYear(ey);
    setMonth(em);
    // Switch to income/expense filter so user sees the result
    setFilterType(item.type === "receivable" ? "income" : "expense");
    setConfirmSubmit(false);
    setConfirmingRef(null);
  }

  // ── Finance Editor overlay ────────────────────────────────────────────────
  if (editorMode !== "idle") {
    return (
      <FinanceEditor
        entry={editorMode === "edit" ? editingEntry : null}
        defaultType={defaultEditorType}
        onSave={handleEditorSave}
        onDelete={editorMode === "edit" ? handleEditorDelete : undefined}
        onCancel={() => { setEditorMode("idle"); setEditingEntry(null); }}
        isLinkedEntry={editorMode === "edit" && !!editingEntry?.sourceFinancialItemId}
      />
    );
  }

  // ── Confirm form ──────────────────────────────────────────────────────────
  const canConfirm = parseFloat(confirmAmount.replace(/,/g, "")) > 0;
  const isReceivableConfirm = confirmingRef?.item.type === "receivable";

  function renderConfirmForm(ref: PendingRef) {
    if (confirmingRef?.item.id !== ref.item.id) return null;
    return (
      <div className="mt-3 rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-300">
          {isReceivableConfirm ? "確認收款" : "確認付款"}
        </p>
        <div>
          <p className="text-[10px] text-gray-500 mb-1.5">
            {isReceivableConfirm ? "實收金額" : "實付金額"}
          </p>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
            <span className="text-gray-500 text-sm shrink-0">NT$</span>
            <input
              type="text"
              inputMode="decimal"
              value={confirmAmount}
              onChange={(e) => setConfirmAmount(e.target.value)}
              className="flex-1 bg-transparent text-white text-base font-semibold focus:outline-none placeholder-gray-700"
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 mb-1.5">
            {isReceivableConfirm ? "收款日期" : "付款日期"}
          </p>
          <input
            type="date"
            value={confirmDate}
            onChange={(e) => setConfirmDate(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 mb-1.5">備註</p>
          <input
            type="text"
            value={confirmNote}
            onChange={(e) => setConfirmNote(e.target.value)}
            placeholder="備註（選填）"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || confirmSubmit}
            className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-40 ${
              isReceivableConfirm ? "bg-teal-600 hover:bg-teal-500" : "bg-rose-600 hover:bg-rose-500"
            }`}
          >
            {confirmSubmit ? "處理中…" : isReceivableConfirm ? "確認已收款" : "確認已付款"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRef(null)}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  // ── Add button label ──────────────────────────────────────────────────────
  const showAddBtn = filterType !== "receivable" && filterType !== "payable";
  const addBtnType: FinanceType = filterType === "income" ? "Income" : "Expense";
  const addBtnLabel = filterType === "income" ? "＋ 新增收入" : filterType === "expense" ? "＋ 新增支出" : "＋ 記帳";

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-5 py-8 pb-28">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">收支</h1>
        {showAddBtn && (
          <button
            type="button"
            onClick={() => openAdd(addBtnType)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            <span className="text-base leading-none">＋</span>
            記帳
          </button>
        )}
      </div>

      {/* ── Month navigator ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="上個月"
          className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
        >
          ‹
        </button>
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <span className="text-base font-bold text-white tabular-nums whitespace-nowrap">
            {year} 年 {month} 月
          </span>
          {!isThisMonth && (
            <button
              type="button"
              onClick={goToThisMonth}
              className="text-xs px-2.5 py-1 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition-colors whitespace-nowrap"
            >
              本月
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="下個月"
          className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
        >
          ›
        </button>
      </div>

      {/* ── Monthly summary ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {/* 收入 */}
        <div className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.06] px-4 py-3.5">
          <p className="text-[10px] text-teal-400/70 font-medium uppercase tracking-wide mb-1.5">本月收入</p>
          <p className="text-base font-bold tabular-nums text-teal-300 leading-tight">
            + {fmtCurrency(incomeTotal)}
          </p>
          <p className="text-[10px] text-teal-600/60 mt-1">{monthIncomeEntries.length} 筆已收</p>
        </div>
        {/* 支出 */}
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.05] px-4 py-3.5">
          <p className="text-[10px] text-orange-400/70 font-medium uppercase tracking-wide mb-1.5">本月支出</p>
          <p className="text-base font-bold tabular-nums text-orange-300 leading-tight">
            − {fmtCurrency(expenseTotal)}
          </p>
          <p className="text-[10px] text-orange-600/60 mt-1">{monthExpenseEntries.length} 筆已付</p>
        </div>
        {/* 待收 */}
        <div className="rounded-2xl border border-teal-500/15 bg-white/[0.03] px-4 py-3.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1.5">本月待收</p>
          <p className={`text-base font-bold tabular-nums leading-tight ${monthReceivable.length > 0 ? "text-teal-400" : "text-gray-600"}`}>
            {fmtCurrency(receivableTotal)}
          </p>
          <p className="text-[10px] text-gray-700 mt-1">{monthReceivable.length} 筆</p>
        </div>
        {/* 待付 */}
        <div className="rounded-2xl border border-rose-500/15 bg-white/[0.03] px-4 py-3.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1.5">本月待付</p>
          <p className={`text-base font-bold tabular-nums leading-tight ${monthPayable.length > 0 ? "text-rose-400" : "text-gray-600"}`}>
            {fmtCurrency(payableTotal)}
          </p>
          <p className="text-[10px] text-gray-700 mt-1">{monthPayable.length} 筆</p>
        </div>
      </div>

      {/* 結餘 */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 mb-5 flex items-center justify-between">
        <p className="text-xs text-gray-500 font-medium">本月結餘</p>
        <p className={`text-base font-bold tabular-nums ${balance >= 0 ? "text-white" : "text-rose-400"}`}>
          {balance >= 0 ? "+" : "−"} {fmtCurrency(Math.abs(balance))}
        </p>
      </div>

      {/* ── Filter pills ─────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5 mb-5">
        {FILTERS.map(({ key, label }) => {
          const isActive = filterType === key;
          const badge =
            key === "receivable" ? monthReceivable.length :
            key === "payable"    ? monthPayable.length    : 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setFilterType(key); setConfirmingRef(null); }}
              className={`shrink-0 relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-white/12 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {label}
              {badge > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                  key === "receivable" ? "bg-teal-500 text-white" : "bg-rose-500 text-white"
                }`}>
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Monthly detail list ──────────────────────────────────────────── */}
      {listItems.length === 0 ? (
        <EmptyMonth filterType={filterType} />
      ) : (
        <div className="space-y-5">
          {groupedByDate.map(([dateKey, dayItems]) => (
            <div key={dateKey || "nodate"}>
              {/* Date group header */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                {dateKey ? fmtGroupDate(dateKey) : "未指定日期"}
              </p>
              <div className="space-y-2">
                {dayItems.map((item) =>
                  item.kind === "entry" ? (
                    <EntryRow
                      key={item.data.id}
                      entry={item.data}
                      onClick={() => openEdit(item.data)}
                    />
                  ) : (
                    <div key={item.pendingRef.item.id}>
                      <PendingItemCard
                        ref_={item.pendingRef}
                        todayStr={todayStr}
                        isConfirming={confirmingRef?.item.id === item.pendingRef.item.id}
                        onStartConfirm={() => handleStartConfirm(item.pendingRef)}
                        onEditReminder={onEditReminder}
                      />
                      {renderConfirmForm(item.pendingRef)}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EmptyMonth ───────────────────────────────────────────────────────────────

function EmptyMonth({ filterType }: { filterType: FilterType }) {
  const messages: Record<FilterType, string> = {
    all:        "本月尚無收支紀錄",
    income:     "本月尚無收入紀錄",
    expense:    "本月尚無支出紀錄",
    receivable: "本月尚無待收款項",
    payable:    "本月尚無待付款項",
  };
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
        <svg className="w-6 h-6 text-gray-700" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M3 10h18M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-sm text-gray-500">{messages[filterType]}</p>
    </div>
  );
}

// ─── EntryRow ─────────────────────────────────────────────────────────────────

function EntryRow({ entry, onClick }: { entry: FinanceEntry; onClick: () => void }) {
  const isIncome = entry.type === "Income";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-all text-left"
    >
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isIncome ? "bg-teal-400" : "bg-orange-400"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{entry.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
            isIncome
              ? "bg-teal-500/15 text-teal-400 border-teal-500/25"
              : "bg-orange-500/15 text-orange-400 border-orange-500/25"
          }`}>
            {isIncome ? "收入" : "支出"}
          </span>
          {entry.note && (
            <p className="text-[10px] text-gray-500 truncate">{entry.note}</p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className={`text-sm font-bold tabular-nums ${isIncome ? "text-teal-400" : "text-orange-400"}`}>
          {isIncome ? "+" : "−"} {fmtCurrency(entry.amount)}
        </p>
      </div>
      <svg className="w-3.5 h-3.5 text-gray-700 shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ─── PendingItemCard ──────────────────────────────────────────────────────────

function PendingItemCard({
  ref_, todayStr, isConfirming, onStartConfirm, onEditReminder,
}: {
  ref_: PendingRef;
  todayStr: string;
  isConfirming: boolean;
  onStartConfirm: () => void;
  onEditReminder?: (id: string) => void;
}) {
  const { item, reminder } = ref_;
  const isReceivable = item.type === "receivable";
  const isOverdue    = !!item.dueDate && item.dueDate < todayStr;
  const label        = item.title !== reminder.title && item.title ? item.title : reminder.title;

  return (
    <div className={`rounded-2xl border px-4 py-4 transition-colors ${
      isConfirming
        ? isReceivable
          ? "border-teal-500/30 bg-teal-500/[0.06]"
          : "border-rose-500/30 bg-rose-500/[0.06]"
        : isOverdue
          ? "border-rose-500/20 bg-rose-500/[0.03]"
          : "border-white/10 bg-white/[0.04]"
    }`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onStartConfirm}
          className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 transition-all hover:scale-110 ${
            isReceivable
              ? "border-teal-500/60 hover:border-teal-400 hover:bg-teal-500/10"
              : "border-rose-400/60 hover:border-rose-300 hover:bg-rose-500/10"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
              isReceivable
                ? "bg-teal-500/15 text-teal-300 border-teal-500/25"
                : "bg-rose-500/15 text-rose-300 border-rose-500/25"
            }`}>
              {isReceivable ? "待收" : "待付"}
            </span>
            {isOverdue && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25 font-medium">
                已逾期
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-snug">{label}</p>
          {item.dueDate && (
            <p className={`text-xs mt-1 ${isOverdue ? "text-rose-400/70" : "text-gray-500"}`}>
              {isReceivable ? "預計收款日" : "付款期限"}：{item.dueDate}
            </p>
          )}
          {item.note && item.note !== label && (
            <p className="text-xs text-gray-600 mt-0.5">備註：{item.note}</p>
          )}
          {onEditReminder && (
            <button
              type="button"
              onClick={() => onEditReminder(reminder.id)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-blue-400/80 hover:text-blue-300 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              來源：{reminder.title}
            </button>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-base font-bold tabular-nums ${isReceivable ? "text-teal-400" : "text-rose-400"}`}>
            {fmtCurrency(item.amount)}
          </p>
        </div>
      </div>
      {!isConfirming && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onStartConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isReceivable
                ? "bg-teal-500/12 border-teal-500/25 text-teal-300 hover:bg-teal-500/20"
                : "bg-rose-500/12 border-rose-500/25 text-rose-300 hover:bg-rose-500/20"
            }`}
          >
            {isReceivable ? "確認收款" : "確認付款"}
          </button>
        </div>
      )}
    </div>
  );
}
