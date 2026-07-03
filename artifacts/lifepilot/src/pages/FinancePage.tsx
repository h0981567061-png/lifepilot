import { useState, useMemo } from "react";
import type { Reminder, FinancialItem } from "../store";
import { updateReminder } from "../store";
import type { FinanceEntry, FinanceType } from "../financeStore";
import {
  loadFinanceEntries,
  saveFinanceEntries,
  fmtCurrency,
  fmtDate,
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

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { key: "overview",   label: "總覽" },
  { key: "receivable", label: "待收" },
  { key: "payable",    label: "待付" },
  { key: "income",     label: "收入" },
  { key: "expense",    label: "支出" },
] as const;

type PageTab = (typeof TABS)[number]["key"];

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
        .filter(
          (i) =>
            i.type === type &&
            !i.completed &&
            !confirmedIds.has(i.id),
        )
        .map((i) => ({ item: i, reminder: r })),
    )
    .sort((a, b) => {
      if (!a.item.dueDate && !b.item.dueDate) return 0;
      if (!a.item.dueDate) return 1;
      if (!b.item.dueDate) return -1;
      return a.item.dueDate.localeCompare(b.item.dueDate);
    });
}

// ─── FinancePage ──────────────────────────────────────────────────────────────

export function FinancePage({ reminders: propReminders = [], onEditReminder, onRemindersChange }: Props) {
  const todayStr = new Date().toISOString().substring(0, 10);
  const todayDate = new Date();

  // ── Finance entries state ──────────────────────────────────────────────────
  const [entries, setEntries] = useState<FinanceEntry[]>(() => loadFinanceEntries());

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<PageTab>("overview");

  // ── Finance Editor state (for Income/Expense add/edit) ────────────────────
  const [editorMode,        setEditorMode]        = useState<"idle" | "add" | "edit">("idle");
  const [editingEntry,      setEditingEntry]      = useState<FinanceEntry | null>(null);
  const [defaultEditorType, setDefaultEditorType] = useState<FinanceType>("Expense");

  // ── Month navigation (for income/expense tabs) ────────────────────────────
  const [year,  setYear]  = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth() + 1);

  // ── Confirm flow state ────────────────────────────────────────────────────
  const [confirmingRef,  setConfirmingRef]  = useState<PendingRef | null>(null);
  const [confirmAmount,  setConfirmAmount]  = useState("");
  const [confirmDate,    setConfirmDate]    = useState(todayStr);
  const [confirmNote,    setConfirmNote]    = useState("");
  const [confirmSubmit,  setConfirmSubmit]  = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────
  const pendingReceivable = useMemo(
    () => getPendingItems(propReminders, "receivable", entries),
    [propReminders, entries],
  );
  const pendingPayable = useMemo(
    () => getPendingItems(propReminders, "payable", entries),
    [propReminders, entries],
  );

  const receivableTotal = pendingReceivable.reduce((s, r) => s + r.item.amount, 0);
  const payableTotal    = pendingPayable.reduce((s, r) => s + r.item.amount, 0);

  const prefix        = monthPrefix(year, month);
  const monthEntries  = entries.filter((e) => e.date.startsWith(prefix));
  const incomeTotal   = monthEntries.filter((e) => e.type === "Income").reduce((s, e) => s + e.amount, 0);
  const expenseTotal  = monthEntries.filter((e) => e.type === "Expense").reduce((s, e) => s + e.amount, 0);

  // ── Month navigation helpers ───────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // ── Finance editor handlers ────────────────────────────────────────────────
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

  // ── Confirm flow handlers ──────────────────────────────────────────────────
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

    // Guard: already confirmed
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

    // Update reminder's financialItems
    const baseItems = reminder.financialItems && reminder.financialItems.length > 0
      ? reminder.financialItems
      : deriveFinancialItems(reminder);

    const updatedItems = baseItems.map((i) =>
      i.id === item.id
        ? { ...i, completed: true, completedDate: confirmedDate }
        : i,
    );

    const updated = updateReminder(reminder.id, {
      financialItems: updatedItems,
      financialStatus: undefined,
      expectedAmount:  undefined,
      financialDueDate: undefined,
    });
    onRemindersChange?.(updated);

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
      />
    );
  }

  // ── Shared confirm form renderer ───────────────────────────────────────────
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

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-5 py-8 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">收支</h1>
        </div>
        {(tab === "income" || tab === "expense" || tab === "overview") && (
          <button
            type="button"
            onClick={() => openAdd(tab === "income" ? "Income" : "Expense")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            <span className="text-base leading-none">＋</span>
            記帳
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 overflow-x-auto scrollbar-hide mb-6 -mx-1 px-1 pb-0.5">
        {TABS.map(({ key, label }) => {
          const isActive = tab === key;
          const badgeCount =
            key === "receivable" ? pendingReceivable.length :
            key === "payable"    ? pendingPayable.length : 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); setConfirmingRef(null); }}
              className={`shrink-0 relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-white/12 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {label}
              {badgeCount > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                  key === "receivable" ? "bg-teal-500 text-white" : "bg-rose-500 text-white"
                }`}>
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 總覽 Tab ────────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* 4 summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTab("receivable")}
              className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.06] px-4 py-4 text-left hover:bg-teal-500/10 transition-colors"
            >
              <p className="text-[10px] text-teal-400/70 font-medium uppercase tracking-wide mb-2">待收</p>
              <p className="text-lg font-bold tabular-nums text-teal-300 leading-tight">
                {fmtCurrency(receivableTotal)}
              </p>
              <p className="text-[10px] text-teal-500/60 mt-1">{pendingReceivable.length} 筆</p>
            </button>
            <button
              type="button"
              onClick={() => setTab("payable")}
              className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-4 text-left hover:bg-rose-500/10 transition-colors"
            >
              <p className="text-[10px] text-rose-400/70 font-medium uppercase tracking-wide mb-2">待付</p>
              <p className="text-lg font-bold tabular-nums text-rose-300 leading-tight">
                {fmtCurrency(payableTotal)}
              </p>
              <p className="text-[10px] text-rose-500/60 mt-1">{pendingPayable.length} 筆</p>
            </button>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-2">本月收入</p>
              <p className="text-lg font-bold tabular-nums text-teal-400 leading-tight">
                + {fmtCurrency(incomeTotal)}
              </p>
              <p className="text-[10px] text-gray-700 mt-1">{year} 年 {month} 月</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-2">本月支出</p>
              <p className="text-lg font-bold tabular-nums text-orange-400 leading-tight">
                − {fmtCurrency(expenseTotal)}
              </p>
              <p className="text-[10px] text-gray-700 mt-1">{year} 年 {month} 月</p>
            </div>
          </div>

          {/* Recent receivable */}
          {pendingReceivable.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">近期待收</p>
                {pendingReceivable.length > 3 && (
                  <button type="button" onClick={() => setTab("receivable")}
                    className="text-xs text-blue-400 hover:text-blue-300">查看全部</button>
                )}
              </div>
              <div className="space-y-2">
                {pendingReceivable.slice(0, 3).map(({ item, reminder }) => (
                  <OverviewPendingRow key={item.id} item={item} reminder={reminder}
                    type="receivable" onGoTab={() => setTab("receivable")} />
                ))}
              </div>
            </div>
          )}

          {/* Recent payable */}
          {pendingPayable.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">近期待付</p>
                {pendingPayable.length > 3 && (
                  <button type="button" onClick={() => setTab("payable")}
                    className="text-xs text-blue-400 hover:text-blue-300">查看全部</button>
                )}
              </div>
              <div className="space-y-2">
                {pendingPayable.slice(0, 3).map(({ item, reminder }) => (
                  <OverviewPendingRow key={item.id} item={item} reminder={reminder}
                    type="payable" onGoTab={() => setTab("payable")} />
                ))}
              </div>
            </div>
          )}

          {pendingReceivable.length === 0 && pendingPayable.length === 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center">
              <p className="text-sm text-gray-500">目前沒有待收或待付款項</p>
            </div>
          )}
        </div>
      )}

      {/* ── 待收 Tab ────────────────────────────────────────────────────────── */}
      {tab === "receivable" && (
        <div>
          <div className="mb-4">
            <p className="text-2xl font-bold tabular-nums text-teal-300">{fmtCurrency(receivableTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">共 {pendingReceivable.length} 筆待收</p>
          </div>

          {pendingReceivable.length === 0 ? (
            <EmptyPending type="receivable" />
          ) : (
            <div className="space-y-3">
              {pendingReceivable.map((ref) => (
                <div key={ref.item.id}>
                  <PendingItemCard
                    ref_={ref}
                    todayStr={todayStr}
                    isConfirming={confirmingRef?.item.id === ref.item.id}
                    onStartConfirm={() => handleStartConfirm(ref)}
                    onEditReminder={onEditReminder}
                  />
                  {renderConfirmForm(ref)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 待付 Tab ────────────────────────────────────────────────────────── */}
      {tab === "payable" && (
        <div>
          <div className="mb-4">
            <p className="text-2xl font-bold tabular-nums text-rose-300">{fmtCurrency(payableTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">共 {pendingPayable.length} 筆待付</p>
          </div>

          {pendingPayable.length === 0 ? (
            <EmptyPending type="payable" />
          ) : (
            <div className="space-y-3">
              {pendingPayable.map((ref) => (
                <div key={ref.item.id}>
                  <PendingItemCard
                    ref_={ref}
                    todayStr={todayStr}
                    isConfirming={confirmingRef?.item.id === ref.item.id}
                    onStartConfirm={() => handleStartConfirm(ref)}
                    onEditReminder={onEditReminder}
                  />
                  {renderConfirmForm(ref)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 收入 Tab ────────────────────────────────────────────────────────── */}
      {tab === "income" && (
        <IncomeExpenseTab
          type="Income"
          entries={entries}
          year={year} month={month}
          onPrevMonth={prevMonth} onNextMonth={nextMonth}
          onAdd={() => openAdd("Income")}
          onEdit={openEdit}
        />
      )}

      {/* ── 支出 Tab ────────────────────────────────────────────────────────── */}
      {tab === "expense" && (
        <IncomeExpenseTab
          type="Expense"
          entries={entries}
          year={year} month={month}
          onPrevMonth={prevMonth} onNextMonth={nextMonth}
          onAdd={() => openAdd("Expense")}
          onEdit={openEdit}
        />
      )}
    </div>
  );
}

// ─── OverviewPendingRow ───────────────────────────────────────────────────────

function OverviewPendingRow({
  item, reminder, type, onGoTab,
}: {
  item: FinancialItem;
  reminder: Reminder;
  type: "receivable" | "payable";
  onGoTab: () => void;
}) {
  const isReceivable = type === "receivable";
  const label = item.title !== reminder.title && item.title ? item.title : reminder.title;
  return (
    <button
      type="button"
      onClick={onGoTab}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isReceivable ? "bg-teal-400" : "bg-rose-400"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{label}</p>
        {item.dueDate && (
          <p className="text-[10px] text-gray-600 mt-0.5">
            {isReceivable ? "預計收款日" : "付款期限"}：{item.dueDate}
          </p>
        )}
      </div>
      <p className={`text-sm font-semibold tabular-nums shrink-0 ${isReceivable ? "text-teal-400" : "text-rose-400"}`}>
        {fmtCurrency(item.amount)}
      </p>
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
        {/* Status circle */}
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
          {/* Badges */}
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

          {/* Title */}
          <p className="text-sm font-semibold text-white leading-snug">{label}</p>

          {/* Date */}
          {item.dueDate && (
            <p className={`text-xs mt-1 ${isOverdue ? "text-rose-400/70" : "text-gray-500"}`}>
              {isReceivable ? "預計收款日" : "付款期限"}：{item.dueDate}
            </p>
          )}

          {/* Note */}
          {item.note && item.note !== label && (
            <p className="text-xs text-gray-600 mt-0.5">備註：{item.note}</p>
          )}

          {/* Source link */}
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

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className={`text-base font-bold tabular-nums ${
            isReceivable ? "text-teal-400" : "text-rose-400"
          }`}>
            {fmtCurrency(item.amount)}
          </p>
        </div>
      </div>

      {/* Confirm button */}
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

// ─── EmptyPending ─────────────────────────────────────────────────────────────

function EmptyPending({ type }: { type: "receivable" | "payable" }) {
  const isReceivable = type === "receivable";
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${
        isReceivable
          ? "border-teal-500/20 bg-teal-500/5"
          : "border-rose-500/20 bg-rose-500/5"
      }`}>
        <span className="text-2xl">{isReceivable ? "💚" : "📋"}</span>
      </div>
      <p className="text-sm text-gray-500">目前沒有{isReceivable ? "待收" : "待付"}款項</p>
      <p className="text-xs text-gray-700">
        在提醒事項中新增款項後，<br />會顯示在這裡。
      </p>
    </div>
  );
}

// ─── IncomeExpenseTab ─────────────────────────────────────────────────────────

function IncomeExpenseTab({
  type, entries, year, month,
  onPrevMonth, onNextMonth, onAdd, onEdit,
}: {
  type: FinanceType;
  entries: FinanceEntry[];
  year: number; month: number;
  onPrevMonth: () => void; onNextMonth: () => void;
  onAdd: () => void;
  onEdit: (e: FinanceEntry) => void;
}) {
  const isIncome = type === "Income";
  const prefix        = monthPrefix(year, month);
  const monthEntries  = entries.filter((e) => e.date.startsWith(prefix) && e.type === type);
  const monthTotal    = monthEntries.reduce((s, e) => s + e.amount, 0);
  const sortedEntries = [...monthEntries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onPrevMonth}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">{year} 年 {month} 月</p>
          <p className={`text-lg font-bold tabular-nums mt-0.5 ${isIncome ? "text-teal-400" : "text-orange-400"}`}>
            {isIncome ? "+" : "−"} {fmtCurrency(monthTotal)}
          </p>
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          ›
        </button>
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={onAdd}
        className={`w-full mb-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
          isIncome
            ? "bg-teal-500/10 border-teal-500/25 text-teal-300 hover:bg-teal-500/18"
            : "bg-orange-500/10 border-orange-500/25 text-orange-300 hover:bg-orange-500/18"
        }`}
      >
        ＋ 新增{isIncome ? "收入" : "支出"}
      </button>

      {/* Entry list */}
      {sortedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
          <p className="text-sm text-gray-500">本月尚無{isIncome ? "收入" : "支出"}紀錄</p>
          <p className="text-xs text-gray-700">點擊上方按鈕新增{isIncome ? "收入" : "支出"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedEntries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} onClick={() => onEdit(entry)} />
          ))}
        </div>
      )}
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
        {entry.note && (
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">{entry.note}</p>
        )}
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className={`text-sm font-bold tabular-nums ${isIncome ? "text-teal-400" : "text-orange-400"}`}>
          {isIncome ? "+" : "−"} {fmtCurrency(entry.amount)}
        </p>
        <p className="text-[11px] text-gray-600 mt-0.5">{fmtDate(entry.date)}</p>
      </div>
      <svg className="w-3.5 h-3.5 text-gray-700 shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
