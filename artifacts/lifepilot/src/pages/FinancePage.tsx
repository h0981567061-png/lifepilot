import { useState } from "react";
import type { Reminder } from "../store";
import type { FinanceEntry, FinanceType } from "../financeStore";
import {
  loadFinanceEntries,
  saveFinanceEntries,
  fmtCurrency,
  fmtDate,
  monthPrefix,
} from "../financeStore";
import { FinanceEditor } from "./FinanceEditor";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  reminders?: Reminder[]; // legacy — kept for backward compat, not used
}

// ─── Filter type ──────────────────────────────────────────────────────────────

type FilterTab = "all" | "income" | "expense";

// ─── FinancePage ──────────────────────────────────────────────────────────────

export function FinancePage(_props: Props) {
  // ── Finance data ──────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<FinanceEntry[]>(() => loadFinanceEntries());

  // ── Month navigation ──────────────────────────────────────────────────────
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // ── List filter ───────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<FilterTab>("all");

  // ── Editor state ──────────────────────────────────────────────────────────
  const [editorMode,    setEditorMode]    = useState<"idle" | "add" | "edit">("idle");
  const [editingEntry,  setEditingEntry]  = useState<FinanceEntry | null>(null);
  const [defaultEditorType, setDefaultEditorType] = useState<FinanceType>("Expense");

  // ── Derived values ────────────────────────────────────────────────────────
  const prefix       = monthPrefix(year, month);
  const monthEntries = entries.filter((e) => e.date.startsWith(prefix));
  const totalIncome  = monthEntries
    .filter((e) => e.type === "Income")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = monthEntries
    .filter((e) => e.type === "Expense")
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;

  const filteredEntries = monthEntries
    .filter((e) => {
      if (filter === "income")  return e.type === "Income";
      if (filter === "expense") return e.type === "Expense";
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // ── Month navigation ──────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  function mutate(fn: (prev: FinanceEntry[]) => FinanceEntry[]) {
    setEntries((prev) => {
      const next = fn(prev);
      saveFinanceEntries(next);
      return next;
    });
  }

  function handleSave(saved: FinanceEntry) {
    mutate((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setEditorMode("idle");
    setEditingEntry(null);
    // Jump to the month of the saved entry so it appears in the list
    const [ey, em] = saved.date.split("-").map(Number);
    setYear(ey);
    setMonth(em);
  }

  function handleDelete() {
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

  // ── Editor view ───────────────────────────────────────────────────────────
  if (editorMode !== "idle") {
    return (
      <FinanceEditor
        entry={editorMode === "edit" ? editingEntry : null}
        defaultType={defaultEditorType}
        onSave={handleSave}
        onDelete={editorMode === "edit" ? handleDelete : undefined}
        onCancel={() => { setEditorMode("idle"); setEditingEntry(null); }}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-6 py-14 pb-24">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">收支紀錄</h1>
          <p className="text-gray-500 text-sm">管理每月收入與支出</p>
        </div>
        <button
          type="button"
          onClick={() => openAdd()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
        >
          <span className="text-base leading-none">＋</span>
          記帳
        </button>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          type="button"
          onClick={prevMonth}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
        >
          ‹
        </button>
        <span className="text-base font-semibold text-white min-w-[120px] text-center">
          {year} 年 {month} 月
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
        >
          ›
        </button>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SummaryCard
          label="收入"
          amount={totalIncome}
          sign="positive"
          onClick={() => openAdd("Income")}
        />
        <SummaryCard
          label="支出"
          amount={totalExpense}
          sign="negative"
          onClick={() => openAdd("Expense")}
        />
        <SummaryCard
          label="結餘"
          amount={balance}
          sign={balance >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-white/5 border border-white/8 rounded-xl p-1">
        {(
          [
            { key: "all",     label: "全部" },
            { key: "income",  label: "收入" },
            { key: "expense", label: "支出" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === key
                ? "bg-white/10 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Entry list */}
      {filteredEntries.length === 0 ? (
        <EmptyState onAdd={() => openAdd()} />
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onClick={() => openEdit(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  amount,
  sign,
  onClick,
}: {
  label: string;
  amount: number;
  sign: "positive" | "negative" | "neutral";
  onClick?: () => void;
}) {
  const color =
    sign === "positive" ? "text-teal-400" :
    sign === "negative" ? "text-orange-400" :
    "text-gray-300";

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3.5 text-center ${
        onClick ? "cursor-pointer hover:bg-white/[0.07] transition-colors" : ""
      }`}
      onClick={onClick}
    >
      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1.5">
        {label}
      </p>
      <p className={`text-xs font-bold tabular-nums leading-tight ${color}`}>
        {fmtCurrency(Math.abs(amount))}
      </p>
    </div>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  onClick,
}: {
  entry: FinanceEntry;
  onClick: () => void;
}) {
  const isIncome = entry.type === "Income";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-all text-left"
    >
      {/* Color dot */}
      <div
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isIncome ? "bg-teal-400" : "bg-orange-400"
        }`}
      />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{entry.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {entry.financialCategory && (
            <span className="text-[10px] text-gray-500">{entry.financialCategory}</span>
          )}
          {entry.financialCategory && entry.myCategory && (
            <span className="text-[10px] text-gray-700">·</span>
          )}
          {entry.myCategory && (
            <span className="text-[10px] text-gray-600">{entry.myCategory}</span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="text-right shrink-0 ml-2">
        <p
          className={`text-sm font-bold tabular-nums ${
            isIncome ? "text-teal-400" : "text-orange-400"
          }`}
        >
          {isIncome ? "+" : "-"} {fmtCurrency(entry.amount)}
        </p>
        <p className="text-[11px] text-gray-600 mt-0.5">{fmtDate(entry.date)}</p>
      </div>

      {/* Chevron */}
      <svg className="w-3.5 h-3.5 text-gray-700 shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <span className="text-2xl">💴</span>
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-500">本月尚無記帳紀錄</p>
        <p className="text-xs text-gray-700 mt-1">點擊「記帳」開始記錄</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        ＋ 新增記帳
      </button>
    </div>
  );
}
