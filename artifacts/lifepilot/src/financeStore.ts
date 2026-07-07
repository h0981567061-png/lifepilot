// ─── Finance entry data model ─────────────────────────────────────────────────

export type FinanceType = "Income" | "Expense" | "Receivable" | "Payable";

export interface RepeatRule {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  dayOfMonth?: number;
  dayOfWeek?: number;
}

export interface FinanceEntry {
  id: string;
  type: FinanceType;
  title: string;
  amount: number;          // always positive; type determines sign
  date: string;            // YYYY-MM-DD (for Receivable/Payable: expected/due date)
  financialCategory: string;
  myCategory?: string;     // 我的分類 (from CategoryStore), optional
  source?: string;         // Income/Receivable: 收入來源
  merchant?: string;       // Expense/Payable: 商家或地點
  note?: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  sourceReminderId?: string;        // link back to a Reminder
  sourceFinancialItemId?: string;   // link to the specific FinancialItem that triggered this entry
  repeatRule?: RepeatRule;          // for recurring entries
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export const FINANCE_STORAGE_KEY = "lifepilot_finance_v1";

export function loadFinanceEntries(): FinanceEntry[] {
  try {
    const raw = localStorage.getItem(FINANCE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FinanceEntry[];
  } catch {
    return [];
  }
}

export function saveFinanceEntries(entries: FinanceEntry[]): void {
  localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(entries));
}

// ─── Financial category options ───────────────────────────────────────────────

export const FINANCE_INCOME_CATEGORIES = [
  "薪資",
  "接送收入",
  "工作收入",
  "獎金",
  "退款",
  "其他收入",
] as const;

export const FINANCE_EXPENSE_CATEGORIES = [
  "餐飲",
  "交通",
  "購物",
  "醫療",
  "娛樂",
  "家庭",
  "工作",
  "帳單",
  "其他支出",
] as const;

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Format amount as NT$ 1,234 */
export function fmtCurrency(amount: number): string {
  return `NT$ ${amount.toLocaleString("zh-TW")}`;
}

/** Parse an amount string → number. Returns NaN on invalid input. */
export function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return n;
}

/** YYYY-MM-DD → M/D */
export function fmtDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** Get "YYYY-MM" prefix for month filtering */
export function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
