import { useState } from "react";
import { useCategoryStore } from "../CategoryContext";
import { COLOR_OPTIONS, ICON_OPTIONS, colorDot } from "../categories";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
} from "../previewTypes";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  type: string;
  value: string;
  onChange: (name: string) => void;
  /** Compact style for PreviewItemCard inline editor */
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isFinanceType = (t: string) => t === "Income" || t === "Expense";

// ─── Quick-add mini-form ──────────────────────────────────────────────────────

function QuickAddForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string, color: string, icon: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [icon, setIcon] = useState("📎");
  const [showIconGrid, setShowIconGrid] = useState(false);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, color, icon);
  };

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-gray-900/90 p-3 space-y-2.5">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
        新增分類
      </p>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
        placeholder="分類名稱"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
        autoFocus
      />

      {/* Color row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setColor(c.value)}
            title={c.label}
            className={`w-5 h-5 rounded-full transition-all ${c.dot} ${
              color === c.value
                ? "ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110"
                : "opacity-60 hover:opacity-100"
            }`}
          />
        ))}
      </div>

      {/* Icon selector */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowIconGrid((v) => !v)}
          className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-gray-300 hover:bg-white/10 transition-colors"
        >
          <span className="text-base leading-none">{icon}</span>
          <span>圖示</span>
        </button>
      </div>

      {showIconGrid && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {ICON_OPTIONS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => { setIcon(em); setShowIconGrid(false); }}
              className={`text-lg w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10 ${
                icon === em ? "bg-white/15 ring-1 ring-white/30" : ""
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!name.trim()}
          className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
        >
          建立分類
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs transition-colors hover:text-white"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CategorySelect({ type, value, onChange, compact = false }: Props) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const store = useCategoryStore();

  // Income / Expense use their own hardcoded list — no quick-add
  if (isFinanceType(type)) {
    const opts = type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const cls = compact
      ? "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
      : "w-full bg-transparent text-sm text-white focus:outline-none";
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ colorScheme: "dark" }}
      >
        <option value="">未分類</option>
        {opts.map((cat) => (
          <option key={cat} value={cat} className="bg-gray-900 text-white">
            {cat}
          </option>
        ))}
      </select>
    );
  }

  // General types — use shared Category store
  const { enabledCategories, addCategory } = store;

  const handleAdd = (name: string, color: string, icon: string) => {
    const newCat = addCategory({ name, color, icon });
    onChange(newCat.name);
    setShowQuickAdd(false);
  };

  const selectedCat = enabledCategories.find((c) => c.name === value);
  const dot = selectedCat ? colorDot(selectedCat.color) : null;

  const selectCls = compact
    ? "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
    : "w-full bg-transparent text-sm text-white focus:outline-none";

  return (
    <div className="space-y-1">
      {/* Color dot + select inline */}
      <div className="flex items-center gap-2">
        {dot && (
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 ${selectCls}`}
          style={{ colorScheme: "dark" }}
        >
          <option value="">未分類</option>
          {enabledCategories.map((cat) => (
            <option key={cat.id} value={cat.name} className="bg-gray-900 text-white">
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Quick-add toggle */}
      {!showQuickAdd && (
        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          className="text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors"
        >
          ＋ 新增分類
        </button>
      )}

      {/* Quick-add form */}
      {showQuickAdd && (
        <QuickAddForm
          onConfirm={handleAdd}
          onCancel={() => setShowQuickAdd(false)}
        />
      )}
    </div>
  );
}
