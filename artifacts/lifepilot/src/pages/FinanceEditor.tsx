import { useState } from "react";
import type { FinanceEntry, FinanceType } from "../financeStore";
import { FINANCE_INCOME_CATEGORIES, FINANCE_EXPENSE_CATEGORIES, parseAmount } from "../financeStore";
import { useCategoryStore } from "../CategoryContext";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  entry: FinanceEntry | null;       // null = new entry
  defaultType?: FinanceType;
  onSave: (entry: FinanceEntry) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-white/5">
      <span className="w-20 text-xs text-gray-500 pt-1.5 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
    />
  );
}

// ─── FinanceEditor ────────────────────────────────────────────────────────────

export function FinanceEditor({
  entry,
  defaultType,
  onSave,
  onDelete,
  onCancel,
}: Props) {
  const isNew = entry === null;

  const [type,              setType]              = useState<FinanceType>(entry?.type ?? defaultType ?? "Expense");
  const [title,             setTitle]             = useState(entry?.title ?? "");
  const [amountStr,         setAmountStr]         = useState(entry ? String(entry.amount) : "");
  const [date,              setDate]              = useState(
    entry?.date ?? new Date().toISOString().substring(0, 10)
  );
  const [financialCategory, setFinancialCategory] = useState(entry?.financialCategory ?? "");
  const [myCategory,        setMyCategory]        = useState(entry?.myCategory ?? "");
  const [source,            setSource]            = useState(entry?.source ?? "");
  const [merchant,          setMerchant]          = useState(entry?.merchant ?? "");
  const [note,              setNote]              = useState(entry?.note ?? "");

  const { enabledCategories } = useCategoryStore();

  const finCatOptions = type === "Income" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;

  const amount  = parseAmount(amountStr);
  const canSave = title.trim().length > 0 && !isNaN(amount) && amount > 0;

  function handleTypeChange(t: FinanceType) {
    setType(t);
    setFinancialCategory(""); // reset when switching type
  }

  function handleSave() {
    if (!canSave) return;
    const now = new Date().toISOString();
    const saved: FinanceEntry = {
      id:                entry?.id ?? crypto.randomUUID(),
      type,
      title:             title.trim(),
      amount,
      date,
      financialCategory,
      myCategory:        myCategory.trim() || undefined,
      source:            source.trim() || undefined,
      merchant:          merchant.trim() || undefined,
      note:              note.trim() || undefined,
      createdAt:         entry?.createdAt ?? now,
      updatedAt:         now,
      sourceReminderId:  entry?.sourceReminderId,
    };
    onSave(saved);
  }

  function handleDelete() {
    if (!onDelete) return;
    if (window.confirm("確定要刪除這筆記帳紀錄嗎？刪除後無法復原。")) {
      onDelete();
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回
        </button>
        <span className="text-sm text-gray-400 font-medium">
          {isNew ? "新增記帳" : "編輯記帳"}
        </span>
      </div>

      {/* Type segmented control */}
      <div className="flex rounded-2xl bg-white/5 border border-white/8 p-1 mb-6 gap-1">
        {(["Expense", "Income"] as const).map((t) => {
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? t === "Income"
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/25"
                    : "bg-orange-500/20 text-orange-300 border border-orange-500/25"
                  : "text-gray-500 hover:text-gray-400"
              }`}
            >
              {t === "Income" ? "💰 收入" : "💸 支出"}
            </button>
          );
        })}
      </div>

      {/* Fields */}
      <FieldRow label="標題">
        <TextInput
          value={title}
          onChange={setTitle}
          placeholder={type === "Income" ? "收入名稱" : "支出名稱"}
        />
      </FieldRow>

      <FieldRow label="金額">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 shrink-0">NT$</span>
          <TextInput
            value={amountStr}
            onChange={setAmountStr}
            placeholder="0"
            inputMode="decimal"
          />
        </div>
      </FieldRow>

      <FieldRow label="日期">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-transparent text-sm text-white focus:outline-none"
          style={{ colorScheme: "dark" }}
        />
      </FieldRow>

      <FieldRow label="記帳分類">
        <select
          value={financialCategory}
          onChange={(e) => setFinancialCategory(e.target.value)}
          className="w-full bg-transparent text-sm text-white focus:outline-none"
          style={{ colorScheme: "dark" }}
        >
          <option value="">未分類</option>
          {finCatOptions.map((cat) => (
            <option key={cat} value={cat} className="bg-gray-900 text-white">
              {cat}
            </option>
          ))}
        </select>
      </FieldRow>

      <FieldRow label="群組">
        <select
          value={myCategory}
          onChange={(e) => setMyCategory(e.target.value)}
          className="w-full bg-transparent text-sm text-white focus:outline-none"
          style={{ colorScheme: "dark" }}
        >
          <option value="">未分類</option>
          {enabledCategories.map((cat) => (
            <option key={cat.id} value={cat.name} className="bg-gray-900 text-white">
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
      </FieldRow>

      {type === "Income" && (
        <FieldRow label="收入來源">
          <TextInput
            value={source}
            onChange={setSource}
            placeholder="來源（選填）"
          />
        </FieldRow>
      )}

      {type === "Expense" && (
        <FieldRow label="商家地點">
          <TextInput
            value={merchant}
            onChange={setMerchant}
            placeholder="商家或地點（選填）"
          />
        </FieldRow>
      )}

      <FieldRow label="備註">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="備註（選填）"
          rows={2}
          className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none resize-none leading-relaxed"
        />
      </FieldRow>

      {/* Amount validation hint */}
      {amountStr && (isNaN(amount) || amount <= 0) && (
        <p className="text-xs text-rose-400 mt-2">金額必須大於 0</p>
      )}

      {/* Action buttons */}
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg ${
            canSave
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
              : "bg-white/5 text-gray-600 cursor-not-allowed"
          }`}
        >
          儲存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold text-sm transition-all"
        >
          取消
        </button>
      </div>

      {/* Delete button (edit mode only) */}
      {!isNew && onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className="w-full mt-3 py-3.5 rounded-xl text-red-400 hover:bg-red-500/8 border border-red-500/20 text-sm font-semibold transition-all"
        >
          刪除這筆紀錄
        </button>
      )}
    </div>
  );
}
