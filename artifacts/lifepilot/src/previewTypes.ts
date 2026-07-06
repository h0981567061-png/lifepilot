// ─── Unified Preview Item — used in the "新增" flow before saving ─────────────
import type { ReminderNotification } from "./store";

export type AllType =
  | "Course"
  | "Airport Transfer"
  | "Shopping"
  | "Payment"
  | "Medical"
  | "Income"
  | "Expense"
  | "Work"
  | "Family"
  | "General"
  | "Pending";

export const ALL_TYPES: AllType[] = [
  "Course",
  "Airport Transfer",
  "Shopping",
  "Payment",
  "Medical",
  "Income",
  "Expense",
  "Work",
  "Family",
  "General",
  "Pending",
];

export const TYPE_LABEL: Record<AllType, string> = {
  "Course":           "課程",
  "Airport Transfer": "接送機",
  "Shopping":         "購物",
  "Payment":          "付款",
  "Medical":          "醫療",
  "Income":           "收入",
  "Expense":          "支出",
  "Work":             "工作",
  "Family":           "家庭",
  "General":          "一般事項",
  "Pending":          "待確認",
};

export const TYPE_COLOR: Record<AllType, string> = {
  "Course":           "blue",
  "Airport Transfer": "amber",
  "Shopping":         "purple",
  "Payment":          "rose",
  "Medical":          "green",
  "Income":           "emerald",
  "Expense":          "orange",
  "Work":             "sky",
  "Family":           "pink",
  "General":          "gray",
  "Pending":          "gray",
};

// ─── Category lists ────────────────────────────────────────────────────────────

export const GENERAL_CATEGORIES = [
  "工作", "家庭", "小孩", "個人", "重要", "生活", "其他",
];

export const EXPENSE_CATEGORIES = [
  "餐飲", "交通", "購物", "醫療", "娛樂", "家庭", "工作", "帳單", "其他支出",
];

export const INCOME_CATEGORIES = [
  "薪資", "接送收入", "工作收入", "獎金", "退款", "其他收入",
];

export function getCategoriesForType(type: AllType): string[] {
  if (type === "Expense") return EXPENSE_CATEGORIES;
  if (type === "Income") return INCOME_CATEGORIES;
  return GENERAL_CATEGORIES;
}

// ─── PreviewItem ───────────────────────────────────────────────────────────────
// "Fat" interface — all possible fields stored on every item.
// When the user switches type, no data is lost; only the final Reminder
// creation step reads the relevant fields for the current type.

export interface PreviewItem {
  id: string;
  type: AllType;
  category: string;
  // Common fields
  title: string;
  date: string;       // YYYY-MM-DD; for Payment this doubles as dueDate; for range = startDate
  dateMode: "single" | "range";
  endDate: string;    // YYYY-MM-DD; only when dateMode="range", else ""
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  allDay: boolean;
  location: string;
  notes: string;
  // Financial items created in the add flow (saved to Reminder on create)
  financialItems?: import("./store").FinancialItem[];
  // Airport Transfer
  flightNumber: string;
  transferType: string;   // 接機 | 送機
  district: string;
  vehicleType: string;
  price: string;
  // Shopping
  shoppingItems: string[];
  // Payment / Income / Expense
  amount: string;
  account: string;
  dueDate: string;    // YYYY-MM-DD; explicit due date for Payment (may differ from date)
  // Medical
  hospital: string;
  department: string;
  // Income
  source: string;
  // Expense
  merchant: string;
  // Pending
  pendingText: string;
  // Reminder notifications (set in inline editor before saving)
  reminders: ReminderNotification[];
  // Work profile association (optional)
  workProfileId?: string;
  // Template data — airport transfer trip details (separate from unified 收支 system)
  templateData?: import("./store").TemplateData;
  // Financial status
  financialStatus: "none" | "receivable" | "payable";
  expectedAmount?: number;
  financialDueDate: string;
}

export function emptyPreviewItem(type: AllType = "General"): PreviewItem {
  return {
    id: crypto.randomUUID(),
    type,
    category: "",
    title: "",
    date: "",
    dateMode: "single",
    endDate: "",
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
    flightNumber: "",
    transferType: "",
    district: "",
    vehicleType: "",
    price: "",
    shoppingItems: [],
    amount: "",
    account: "",
    dueDate: "",
    hospital: "",
    department: "",
    source: "",
    merchant: "",
    pendingText: "",
    allDay: false,
    reminders: [],
    financialStatus: "none",
    expectedAmount: undefined,
    financialDueDate: "",
  };
}

export type { ReminderNotification };

// ─── Color helpers ─────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, { text: string; border: string; badge: string }> = {
  blue:    { text: "text-blue-400",    border: "border-blue-500/40 bg-blue-500/5",       badge: "bg-blue-500/20 text-blue-300 border-blue-500/30"     },
  amber:   { text: "text-amber-300",   border: "border-amber-500/40 bg-amber-500/5",     badge: "bg-amber-500/20 text-amber-300 border-amber-500/30"   },
  purple:  { text: "text-purple-400",  border: "border-purple-500/40 bg-purple-500/5",   badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  rose:    { text: "text-rose-400",    border: "border-rose-500/40 bg-rose-500/5",       badge: "bg-rose-500/20 text-rose-300 border-rose-500/30"       },
  green:   { text: "text-emerald-400", border: "border-emerald-500/40 bg-emerald-500/5", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  emerald: { text: "text-emerald-400", border: "border-emerald-500/40 bg-emerald-500/5", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  orange:  { text: "text-orange-400",  border: "border-orange-500/40 bg-orange-500/5",   badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  sky:     { text: "text-sky-400",     border: "border-sky-500/40 bg-sky-500/5",         badge: "bg-sky-500/20 text-sky-300 border-sky-500/30"         },
  pink:    { text: "text-pink-400",    border: "border-pink-500/40 bg-pink-500/5",       badge: "bg-pink-500/20 text-pink-300 border-pink-500/30"       },
  gray:    { text: "text-gray-400",    border: "border-white/10 bg-white/5",             badge: "bg-white/10 text-gray-400 border-white/10"            },
};

function getColors(type: AllType) {
  return COLOR_CLASSES[TYPE_COLOR[type]] ?? COLOR_CLASSES.gray;
}

export function typeTextClass(type: AllType): string {
  return getColors(type).text;
}

export function typeBorderClass(type: AllType): string {
  return getColors(type).border;
}

export function typeBadgeClass(type: AllType): string {
  return getColors(type).badge;
}
