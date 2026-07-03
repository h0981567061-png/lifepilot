import { useState } from "react";
import type { Reminder } from "../store";
import {
  type FinanceEntry,
  type FinanceType,
  loadFinanceEntries,
  saveFinanceEntries,
  FINANCE_INCOME_CATEGORIES,
  FINANCE_EXPENSE_CATEGORIES,
} from "../financeStore";
import { normalizeDate } from "../utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultFinanceType(r: Reminder): FinanceType {
  return r.type === "Airport Transfer" ? "Income" : "Expense";
}

function defaultCategory(r: Reminder, finType: FinanceType): string {
  if (finType === "Income") {
    if (r.type === "Airport Transfer") return "接送收入";
    return "";
  }
  switch (r.type) {
    case "Medical":   return "醫療";
    case "Shopping":  return "購物";
    case "Payment":   return "帳單";
    case "Course":    return "工作";
    default:          return "";
  }
}

function defaultAmount(r: Reminder, finType: FinanceType): string {
  if (r.type === "Airport Transfer" && finType === "Income") return r.price ?? "";
  if (r.type === "Payment")  return r.amount ?? "";
  return "";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  reminder: Reminder;
  onSave: (entry: FinanceEntry) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickFinanceModal({ reminder, onSave, onCancel }: Props) {
  const initType = defaultFinanceType(reminder);
  const [finType,  setFinType]  = useState<FinanceType>(initType);
  const [title,    setTitle]    = useState(reminder.title || "");
  const [amount,   setAmount]   = useState(defaultAmount(reminder, initType));
  const [date,     setDate]     = useState(normalizeDate(reminder.date));
  const [category, setCategory] = useState(defaultCategory(reminder, initType));
  const [source,   setSource]   = useState("");
  const [merchant, setMerchant] = useState("");
  const [note,     setNote]     = useState("");

  const categoryOptions = finType === "Income"
    ? FINANCE_INCOME_CATEGORIES
    : FINANCE_EXPENSE_CATEGORIES;

  function handleTypeSwitch(t: FinanceType) {
    const newCat = defaultCategory(reminder, t);
    setFinType(t);
    setCategory(newCat);
  }

  function handleSave() {
    const amt = parseFloat(amount.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) return;
    const now = new Date().toISOString();
    const entry: FinanceEntry = {
      id: crypto.randomUUID(),
      type: finType,
      title: title.trim() || (finType === "Income" ? "收入" : "支出"),
      amount: amt,
      date: date || now.substring(0, 10),
      financialCategory: category,
      source:   finType === "Income" ? source || undefined : undefined,
      merchant: finType === "Expense" ? merchant || undefined : undefined,
      note: note.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      sourceReminderId: reminder.id,
    };
    const prev = loadFinanceEntries();
    saveFinanceEntries([...prev, entry]);
    onSave(entry);
  }

  const canSave = !!amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-2xl bg-gray-900 border-t border-white/10 rounded-t-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-base font-semibold text-white">快速記帳</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <p className="px-6 pb-4 text-xs text-gray-500 truncate">來自：{reminder.title}</p>

        {/* Scrollable form */}
        <div className="overflow-y-auto max-h-[70vh] px-6 pb-10 space-y-4">
          {/* Income / Expense */}
          <div className="flex rounded-xl bg-white/5 border border-white/8 p-1 gap-1">
            {(["Expense", "Income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeSwitch(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  finType === t
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

          {/* Title */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">標題</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="記帳標題"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">金額</label>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <span className="text-gray-500 text-sm shrink-0">NT$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className="flex-1 bg-transparent text-white text-lg font-semibold focus:outline-none placeholder-gray-700"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">記帳分類</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40"
              style={{ colorScheme: "dark" }}
            >
              <option value="">選擇分類</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Source (Income) / Merchant (Expense) */}
          {finType === "Income" ? (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">收入來源（選填）</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="如：接送費、薪資"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">商家或地點（選填）</label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="如：全聯、停車場"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">備註（選填）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備註"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
            >
              儲存
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
    </div>
  );
}
