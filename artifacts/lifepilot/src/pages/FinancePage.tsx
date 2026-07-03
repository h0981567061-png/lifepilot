import type { Reminder } from "../store";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function displayDate(dateStr: string): string {
  if (!dateStr) return "—";
  return dateStr.replace(/-/g, "/");
}

const TYPE_LABEL: Record<string, string> = {
  Income:  "收入",
  Expense: "支出",
};

// ─── FinancePage ──────────────────────────────────────────────────────────────

export function FinancePage({ reminders }: { reminders: Reminder[] }) {
  const financeItems = reminders
    .filter((r) => r.type === "Income" || r.type === "Expense")
    .sort((a, b) => {
      const da = a.date || a.dueDate || "";
      const db = b.date || b.dueDate || "";
      return db.localeCompare(da);
    });

  const incomeItems  = financeItems.filter((r) => r.type === "Income");
  const expenseItems = financeItems.filter((r) => r.type === "Expense");

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">收支</h1>
        <p className="text-gray-500 text-sm">收入與支出紀錄</p>
      </div>

      {/* Empty state */}
      {financeItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-2xl text-gray-600">¥</span>
          </div>
          <p className="text-gray-500 text-sm text-center">
            尚無收支紀錄
            <br />
            在新增頁面貼上收入或支出訊息
          </p>
        </div>
      )}

      {/* Income section */}
      {incomeItems.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            收入
          </h2>
          <div className="space-y-2">
            {incomeItems.map((r) => (
              <FinanceCard key={r.id} item={r} />
            ))}
          </div>
        </section>
      )}

      {/* Expense section */}
      {expenseItems.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            支出
          </h2>
          <div className="space-y-2">
            {expenseItems.map((r) => (
              <FinanceCard key={r.id} item={r} />
            ))}
          </div>
        </section>
      )}

      {/* Future features hint */}
      {financeItems.length > 0 && (
        <p className="text-xs text-gray-600 text-center pt-2">
          月份切換、統計圖表與分類報表即將推出
        </p>
      )}
    </div>
  );
}

// ─── FinanceCard ──────────────────────────────────────────────────────────────

function FinanceCard({ item }: { item: Reminder }) {
  const isIncome  = item.type === "Income";
  const dateStr   = item.date || item.dueDate || "";
  const subtitle  = isIncome ? item.source : item.merchant;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
      {/* Icon dot */}
      <div
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isIncome ? "bg-emerald-400" : "bg-red-400"
        }`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.title}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right side */}
      <div className="text-right shrink-0">
        {item.amount && (
          <p
            className={`text-sm font-semibold tabular-nums ${
              isIncome ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isIncome ? "+" : "-"}
            {item.amount}
          </p>
        )}
        {dateStr && (
          <p className="text-[11px] text-gray-500 mt-0.5">
            {displayDate(dateStr)}
          </p>
        )}
      </div>

      {/* Type badge */}
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
          isIncome
            ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/20"
            : "bg-red-900/40 text-red-400 border border-red-500/20"
        }`}
      >
        {TYPE_LABEL[item.type] ?? item.type}
      </span>
    </div>
  );
}
