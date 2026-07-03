import { useState } from "react";
import type { Reminder, ReminderNotification, FinancialItem } from "../store";
import { updateReminder } from "../store";
import { normalizeDate } from "../utils";
import { TYPE_LABEL, type AllType } from "../previewTypes";
import { ReminderEditor } from "../components/ReminderEditor";
import { TimePicker } from "../components/TimePicker";
import { CategorySelect } from "../components/CategorySelect";
import {
  loadFinanceEntries,
  saveFinanceEntries,
  type FinanceEntry,
  fmtCurrency,
  FINANCE_INCOME_CATEGORIES,
  FINANCE_EXPENSE_CATEGORIES,
} from "../financeStore";

// ── UI primitives ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mt-8 mb-2 pb-1.5 border-b border-white/8">
      {children}
    </p>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 font-medium mt-3 mb-1.5">{children}</p>;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3 border-b border-white/5 items-start">
      <span className="w-20 text-xs text-gray-500 pt-1.5 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
    />
  );
}

function TextArea({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      rows={3}
      className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none resize-none leading-relaxed"
    />
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-3.5 border-b border-white/5 cursor-pointer select-none"
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className="text-sm text-white">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ml-4 ${
          checked ? "bg-blue-500" : "bg-white/15"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`} />
      </button>
    </div>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  Course:             "bg-blue-500/15 text-blue-300 border-blue-500/25",
  "Airport Transfer": "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Medical:            "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  Shopping:           "bg-purple-500/15 text-purple-300 border-purple-500/25",
  Payment:            "bg-rose-500/15 text-rose-300 border-rose-500/25",
  Income:             "bg-teal-500/15 text-teal-300 border-teal-500/25",
  Expense:            "bg-orange-500/15 text-orange-300 border-orange-500/25",
  Work:               "bg-sky-500/15 text-sky-300 border-sky-500/25",
  Family:             "bg-pink-500/15 text-pink-300 border-pink-500/25",
  General:            "bg-white/10 text-gray-400 border-white/15",
  Pending:            "bg-white/10 text-gray-400 border-white/15",
};

// ─── Time mode ────────────────────────────────────────────────────────────────

type TimeMode = "allday" | "single" | "range";

function deriveTimeMode(r: Reminder): TimeMode {
  if (r.allDay) return "allday";
  if (r.endTime && r.endTime !== r.startTime && r.endTime !== "") return "range";
  if (r.startTime) return "single";
  switch (r.type) {
    case "Course":           return "range";
    case "Medical":
    case "Airport Transfer": return "single";
    default:                 return "allday";
  }
}

function TimeField({
  mode, onModeChange, startTime, onStartTime, endTime, onEndTime,
}: {
  mode: TimeMode; onModeChange: (m: TimeMode) => void;
  startTime: string; onStartTime: (v: string) => void;
  endTime: string;   onEndTime:   (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex gap-1.5 flex-wrap">
        {([ ["allday","全天"], ["single","單一時間"], ["range","時間區間"] ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              onModeChange(key);
              if (key === "allday") { onStartTime(""); onEndTime(""); }
              if (key === "single") { onEndTime(""); }
            }}
            className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
              mode === key
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "single" && <TimePicker value={startTime} onChange={onStartTime} />}
      {mode === "range" && (
        <div className="flex items-center gap-2 flex-wrap">
          <TimePicker value={startTime} onChange={onStartTime} />
          <span className="text-gray-500 text-xs shrink-0">至</span>
          <TimePicker value={endTime} onChange={onEndTime} />
        </div>
      )}
    </div>
  );
}

// ─── Backward compat: derive FinancialItems from legacy fields ────────────────

function deriveFinancialItems(r: Reminder): FinancialItem[] {
  // Already has items — use as-is
  if (r.financialItems && r.financialItems.length > 0) return r.financialItems;

  // Migrate from explicit financialStatus/expectedAmount (Task-010A.1/.2 data)
  if ((r.financialStatus === "receivable" || r.financialStatus === "payable") &&
      r.expectedAmount && r.expectedAmount > 0) {
    return [{
      id: crypto.randomUUID(),
      title: r.title || (r.financialStatus === "receivable" ? "待收款項" : "待付款項"),
      type: r.financialStatus,
      amount: r.expectedAmount,
      dueDate: r.financialDueDate || undefined,
    }];
  }

  // Payment backward compat (pre-Task-010A data: has amount/dueDate, no financialStatus)
  if (!r.financialStatus && r.type === "Payment" && r.amount) {
    const n = parseFloat(String(r.amount).replace(/,/g, ""));
    if (!isNaN(n) && n > 0) {
      return [{
        id: crypto.randomUUID(),
        title: r.title || "繳費",
        type: "payable",
        amount: n,
        dueDate: r.financialDueDate || (r.dueDate ? normalizeDate(r.dueDate) : undefined),
      }];
    }
  }

  // AirportTransfer backward compat (has amount, no financialStatus)
  if (!r.financialStatus && r.type === "Airport Transfer" && r.amount) {
    const n = parseFloat(String(r.amount).replace(/,/g, ""));
    if (!isNaN(n) && n > 0) {
      return [{
        id: crypto.randomUUID(),
        title: r.title || "接送費",
        type: "receivable",
        amount: n,
      }];
    }
  }

  return [];
}

// helpers for defaultCategory and defaultFinanceAmount
function defaultFinCategory(rType: string, finType: "income" | "expense"): string {
  if (finType === "income") {
    if (rType === "Airport Transfer") return "接送收入";
    return "";
  }
  switch (rType) {
    case "Medical":  return "醫療";
    case "Shopping": return "購物";
    case "Payment":  return "帳單";
    case "Course":   return "工作";
    default:         return "";
  }
}

// ─── Financial Item inline form ───────────────────────────────────────────────

function ItemForm({
  type, title, amount, dueDate, note,
  setType, setTitle, setAmount, setDueDate, setNote,
  onSave, onCancel, saveLabel = "新增",
}: {
  type: "receivable" | "payable";
  title: string; amount: string; dueDate: string; note: string;
  setType: (v: "receivable" | "payable") => void;
  setTitle: (v: string) => void;
  setAmount: (v: string) => void;
  setDueDate: (v: string) => void;
  setNote: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const canSave = title.trim() !== "" && parseFloat(amount) > 0;
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-3 mb-2">
      {/* Type */}
      <div className="flex gap-2">
        {([["receivable","待收","bg-teal-500/20 text-teal-300 border-teal-500/40"],
           ["payable",  "待付","bg-rose-500/20 text-rose-300 border-rose-500/40"]] as const).map(([k, l, cls]) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              type === k ? cls : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {/* Name */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="名稱（必填）"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
      />
      {/* Amount */}
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
        <span className="text-gray-500 text-sm shrink-0">NT$</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="flex-1 bg-transparent text-white text-sm font-semibold focus:outline-none placeholder-gray-700"
        />
      </div>
      {/* Date */}
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
        style={{ colorScheme: "dark" }}
      />
      {/* Note */}
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="備註（選填）"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none"
      />
      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ─── FinancialItemRow ─────────────────────────────────────────────────────────

function FinancialItemRow({
  item, isCompleted, isConfirming, onStartConfirm, onEdit, onDelete,
}: {
  item: FinancialItem;
  isCompleted: boolean;
  isConfirming: boolean;
  onStartConfirm: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isReceivable = item.type === "receivable";

  if (isCompleted) {
    // Completed display
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 opacity-70">
        {/* Completed checkmark */}
        <div className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${
          isReceivable ? "bg-teal-500" : "bg-rose-400"
        }`}>
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
              isReceivable
                ? "bg-teal-500/10 text-teal-400/80 border-teal-500/20"
                : "bg-rose-500/10 text-rose-300/80 border-rose-500/20"
            }`}>
              {isReceivable ? "✓ 已收" : "✓ 已付"}
            </span>
            <span className="text-sm text-gray-400 line-through">{item.title}</span>
          </div>
          {item.completedDate && (
            <p className="text-xs text-gray-600 mt-0.5">
              {isReceivable ? "收款日期" : "付款日期"}：{item.completedDate}
            </p>
          )}
        </div>
        <span className={`text-sm font-medium tabular-nums shrink-0 ${
          isReceivable ? "text-teal-400/70" : "text-rose-400/70"
        }`}>
          {isReceivable ? "+" : "−"} {fmtCurrency(item.amount)}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 group ${
      isConfirming ? "border-blue-500/20" : ""
    }`}>
      {/* Interactive circle — click to start confirm flow */}
      <button
        type="button"
        onClick={onStartConfirm}
        title={isReceivable ? "點擊確認收款" : "點擊確認付款"}
        className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all hover:scale-110 active:scale-95 ${
          isReceivable
            ? "border-teal-500/60 hover:border-teal-400 hover:bg-teal-500/10"
            : "border-rose-400/60 hover:border-rose-300 hover:bg-rose-500/10"
        }`}
      />
      {/* Badge + name + amount */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
            isReceivable
              ? "bg-teal-500/15 text-teal-300 border-teal-500/25"
              : "bg-rose-500/15 text-rose-300 border-rose-500/25"
          }`}>
            {isReceivable ? "待收" : "待付"}
          </span>
          <span className="text-sm text-gray-200 truncate">{item.title}</span>
        </div>
        {item.dueDate && (
          <p className="text-xs text-gray-600 mt-0.5">{item.dueDate}</p>
        )}
      </div>
      {/* Amount */}
      <span className={`text-sm font-medium tabular-nums shrink-0 ${
        isReceivable ? "text-teal-400" : "text-rose-400"
      }`}>
        {fmtCurrency(item.amount)}
      </span>
      {/* Edit / Delete — hover only */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-gray-500 hover:text-blue-400 transition-colors px-1"
        >
          編輯
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors px-1"
        >
          刪除
        </button>
      </div>
    </div>
  );
}

// ─── EditPage ─────────────────────────────────────────────────────────────────

export function EditPage({
  reminder,
  onSave,
  onCancel,
  onDelete,
}: {
  reminder: Reminder;
  onSave: (patch: Partial<Reminder>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const t = reminder.type;
  const isPending  = t === "Pending";
  const isPayment  = t === "Payment";
  const isCourse   = t === "Course";
  const isAirport  = t === "Airport Transfer";
  const isMedical  = t === "Medical";
  const isShopping = t === "Shopping";
  const isIncome   = t === "Income";
  const isExpense  = t === "Expense";

  // ── Common ──────────────────────────────────────────────────────────────────
  const [title,     setTitle]     = useState(reminder.title);
  const [date,      setDate]      = useState(normalizeDate(reminder.date));
  const [timeMode,  setTimeMode]  = useState<TimeMode>(deriveTimeMode(reminder));
  const [startTime, setStartTime] = useState(reminder.startTime ?? "");
  const [endTime,   setEndTime]   = useState(reminder.endTime ?? "");
  const [location,  setLocation]  = useState(reminder.location ?? "");
  const [notes,     setNotes]     = useState(reminder.notes ?? "");
  const [category,  setCategory]  = useState(reminder.category ?? "");

  // ── Type-specific ──────────────────────────────────────────────────────────
  const [flightNumber, setFlightNumber] = useState(reminder.flightNumber ?? "");
  const [transferType, setTransferType] = useState(reminder.transferType ?? "");
  const [district,     setDistrict]     = useState(reminder.district ?? "");
  const [vehicleType,  setVehicleType]  = useState(reminder.vehicleType ?? "");
  const [shoppingItems, setShoppingItems] = useState<string[]>(reminder.shoppingItems ?? []);
  const [newItem,       setNewItem]       = useState("");
  const [account,    setAccount]    = useState(reminder.account ?? "");
  const [hospital,   setHospital]   = useState(reminder.hospital ?? "");
  const [department, setDepartment] = useState(reminder.department ?? "");
  const [source,     setSource]     = useState(reminder.source ?? "");
  const [merchant,   setMerchant]   = useState(reminder.merchant ?? "");
  const [incomeAmount, setIncomeAmount] = useState(reminder.amount ?? "");

  // ── Reminder notifications ─────────────────────────────────────────────────
  const [reminders,       setReminders]       = useState<ReminderNotification[]>(reminder.reminders ?? []);
  const [reminderEnabled, setReminderEnabled] = useState(reminder.reminderEnabled ?? true);
  const [calendarEnabled, setCalendarEnabled] = useState(reminder.calendarEnabled ?? false);

  // ── Financial Items (v2) ───────────────────────────────────────────────────
  const [financialItems, setFinancialItems] = useState<FinancialItem[]>(() => deriveFinancialItems(reminder));

  // Add new item form state
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [itemFormType,   setItemFormType]   = useState<"receivable" | "payable">("receivable");
  const [itemFormTitle,  setItemFormTitle]  = useState("");
  const [itemFormAmount, setItemFormAmount] = useState("");
  const [itemFormDate,   setItemFormDate]   = useState("");
  const [itemFormNote,   setItemFormNote]   = useState("");

  // Edit item form state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormType,   setEditFormType]   = useState<"receivable" | "payable">("receivable");
  const [editFormTitle,  setEditFormTitle]  = useState("");
  const [editFormAmount, setEditFormAmount] = useState("");
  const [editFormDate,   setEditFormDate]   = useState("");
  const [editFormNote,   setEditFormNote]   = useState("");

  // ── Confirm flow state (待收/待付 → 建立真實 Finance Record) ─────────────
  const todayStr = new Date().toISOString().substring(0, 10);
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);
  const [confirmAmount,    setConfirmAmount]    = useState("");
  const [confirmDate,      setConfirmDate]      = useState(todayStr);
  const [confirmNote,      setConfirmNote]      = useState("");

  // ── Linked Finance Records (real Income/Expense entries) ──────────────────
  const [linkedFinance, setLinkedFinance] = useState<FinanceEntry[]>(() =>
    loadFinanceEntries().filter((e) => e.sourceReminderId === reminder.id)
  );
  const [showDetail,       setShowDetail]       = useState(false);
  const [showAddFinance,   setShowAddFinance]   = useState(false);

  // Inline Finance Record form
  const initFinType: "income" | "expense" = t === "Airport Transfer" ? "income" : "expense";
  const [newFinType,   setNewFinType]   = useState<"income" | "expense">(initFinType);
  const [newFinAmount, setNewFinAmount] = useState("");
  const [newFinCat,    setNewFinCat]    = useState("");
  const [newFinDate,   setNewFinDate]   = useState(normalizeDate(date));
  const [newFinNotes,  setNewFinNotes]  = useState("");

  const newFinCategories = newFinType === "income" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
  const canSaveNewFin = !!newFinAmount && !isNaN(parseFloat(newFinAmount)) && parseFloat(newFinAmount) > 0;

  // ── Finance Records summary ────────────────────────────────────────────────
  const incomeTotal  = linkedFinance.filter(e => e.type === "Income").reduce((s, e) => s + e.amount, 0);
  const expenseTotal = linkedFinance.filter(e => e.type === "Expense").reduce((s, e) => s + e.amount, 0);

  // ── Financial Items handlers ───────────────────────────────────────────────

  function resetAddForm() {
    setItemFormType("receivable");
    setItemFormTitle("");
    setItemFormAmount("");
    setItemFormDate("");
    setItemFormNote("");
  }

  function handleAddItem() {
    const amt = parseFloat(itemFormAmount.replace(/,/g, ""));
    if (!itemFormTitle.trim() || isNaN(amt) || amt <= 0) return;
    const newFi: FinancialItem = {
      id: crypto.randomUUID(),
      title: itemFormTitle.trim(),
      type: itemFormType,
      amount: amt,
      dueDate: itemFormDate || undefined,
      note: itemFormNote.trim() || undefined,
    };
    setFinancialItems((p) => [...p, newFi]);
    setShowAddItemForm(false);
    resetAddForm();
  }

  function handleStartEditItem(item: FinancialItem) {
    setEditingItemId(item.id);
    setEditFormType(item.type);
    setEditFormTitle(item.title);
    setEditFormAmount(String(item.amount));
    setEditFormDate(item.dueDate ?? "");
    setEditFormNote(item.note ?? "");
  }

  function handleSaveEditItem() {
    if (!editingItemId) return;
    const amt = parseFloat(editFormAmount.replace(/,/g, ""));
    if (!editFormTitle.trim() || isNaN(amt) || amt <= 0) return;
    setFinancialItems((p) => p.map((i) =>
      i.id === editingItemId
        ? { ...i, type: editFormType, title: editFormTitle.trim(), amount: amt,
            dueDate: editFormDate || undefined, note: editFormNote.trim() || undefined }
        : i
    ));
    setEditingItemId(null);
  }

  function handleDeleteItem(id: string) {
    if (!window.confirm("確定要刪除這筆款項？")) return;
    setFinancialItems((p) => p.filter((i) => i.id !== id));
    if (confirmingItemId === id) setConfirmingItemId(null);
  }

  // ── Confirm flow (待收/待付 → Income/Expense) ─────────────────────────────

  function handleStartConfirm(item: FinancialItem) {
    setConfirmingItemId(item.id);
    setConfirmAmount(String(item.amount));
    setConfirmDate(todayStr);
    setConfirmNote(item.note ?? "");
    // Close any other panels
    setEditingItemId(null);
    setShowAddItemForm(false);
  }

  function handleConfirmItem(item: FinancialItem) {
    // Guard: already completed via Finance Record (belt-and-suspenders)
    if (linkedFinance.some(e => e.sourceFinancialItemId === item.id)) {
      setConfirmingItemId(null);
      return;
    }
    const amt = parseFloat(confirmAmount.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) return;

    const now = new Date().toISOString();
    const confirmedDate = confirmDate || todayStr;

    // 1. Build Finance Record
    const entry: FinanceEntry = {
      id: crypto.randomUUID(),
      type: item.type === "receivable" ? "Income" : "Expense",
      title: item.title,
      amount: amt,
      date: confirmedDate,
      financialCategory: item.type === "receivable" ? "接送收入" : "",
      note: confirmNote.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      sourceReminderId: reminder.id,
      sourceFinancialItemId: item.id,
    };
    saveFinanceEntries([...loadFinanceEntries(), entry]);
    setLinkedFinance((p) => [...p, entry]);

    // 2. Mark Financial Item completed
    const updatedItems = financialItems.map((i) =>
      i.id === item.id
        ? { ...i, completed: true, completedDate: confirmedDate }
        : i
    );
    setFinancialItems(updatedItems);

    // 3. Persist immediately to Reminder in localStorage
    //    (prevents re-creation even if user doesn't click main 儲存)
    updateReminder(reminder.id, {
      financialItems: updatedItems,
      financialStatus: undefined,
      expectedAmount:  undefined,
      financialDueDate: undefined,
    });

    setConfirmingItemId(null);
  }

  // ── Finance Record handlers ────────────────────────────────────────────────

  function handleSaveFinanceRecord() {
    const amt = parseFloat(newFinAmount.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) return;
    const now = new Date().toISOString();
    const entry: FinanceEntry = {
      id: crypto.randomUUID(),
      type: newFinType === "income" ? "Income" : "Expense",
      title: reminder.title || (newFinType === "income" ? "收入" : "支出"),
      amount: amt,
      date: newFinDate || now.substring(0, 10),
      financialCategory: newFinCat,
      note: newFinNotes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      sourceReminderId: reminder.id,
    };
    saveFinanceEntries([...loadFinanceEntries(), entry]);
    setLinkedFinance((p) => [...p, entry]);
    setShowAddFinance(false);
    setNewFinAmount(""); setNewFinCat(""); setNewFinNotes("");
  }

  // ── Main save ──────────────────────────────────────────────────────────────

  function handleSave() {
    // Derive backward-compat amount/dueDate for Payment and AirportTransfer
    const firstPayable    = financialItems.find(i => i.type === "payable");
    const firstReceivable = financialItems.find(i => i.type === "receivable");

    const savedAmount = (() => {
      if (isPayment)  return String(firstPayable?.amount ?? "");
      if (isAirport && firstReceivable) return String(firstReceivable.amount);
      if (isIncome || isExpense) return incomeAmount;
      return reminder.amount ?? "";
    })();

    onSave({
      title,
      date:    isPayment ? "" : date,
      dueDate: isPayment ? (firstPayable?.dueDate || undefined) : undefined,
      startTime: timeMode !== "allday" ? startTime : "",
      endTime:   timeMode === "range"  ? endTime   : "",
      allDay:    timeMode === "allday",
      location, notes, category,
      flightNumber, transferType, district, vehicleType,
      shoppingItems,
      amount: savedAmount,
      account,
      hospital, department, source, merchant,
      reminders, reminderEnabled, calendarEnabled,
      sameDayReminder:     reminder.sameDayReminder,
      dayBeforeReminder:   reminder.dayBeforeReminder,
      hoursBeforeReminder: reminder.hoursBeforeReminder,
      // v2 financial items
      financialItems: financialItems.length > 0 ? financialItems : undefined,
      // Clear legacy single-status fields (now covered by financialItems)
      financialStatus: undefined,
      expectedAmount:  undefined,
      financialDueDate: undefined,
    });
  }

  function handleDeleteConfirm() {
    const msg = linkedFinance.length > 0
      ? `此事項有 ${linkedFinance.length} 筆相關收支紀錄。刪除後紀錄將保留但解除關聯。確定刪除？`
      : "確定要刪除這個提醒事項嗎？刪除後無法復原。";
    if (window.confirm(msg)) onDelete();
  }

  function handleAddShoppingItem() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setShoppingItems((prev) => [...prev, trimmed]);
    setNewItem("");
  }

  const badgeClass = TYPE_BADGE[t] ?? TYPE_BADGE.Pending;
  const badgeLabel = TYPE_LABEL[t as AllType] ?? t;
  const re_hasDate = isPayment
    ? !!(financialItems.find(i => i.type === "payable")?.dueDate)
    : !!date;
  const re_hasTime = timeMode !== "allday" && !!startTime;

  // ── Render ────────────────────────────────────────────────────────────────
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
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>

      {/* ══ 1. 基本資訊 ═══════════════════════════════════════════════════════ */}
      <SectionLabel>基本資訊</SectionLabel>

      <FieldRow label="標題">
        <TextInput value={title} onChange={setTitle} placeholder="事項標題" />
      </FieldRow>

      <FieldRow label="群組">
        <CategorySelect type={t} value={category} onChange={setCategory} />
      </FieldRow>

      {/* Payment 截止日期由收支款項管理，不在基本資訊重複 */}
      {!isPending && !isPayment && (
        <FieldRow label="日期">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-transparent text-sm text-white focus:outline-none"
            style={{ colorScheme: "dark" }}
          />
        </FieldRow>
      )}

      {!isPending && (
        <FieldRow label="時間">
          <TimeField
            mode={timeMode} onModeChange={setTimeMode}
            startTime={startTime} onStartTime={setStartTime}
            endTime={endTime}     onEndTime={setEndTime}
          />
        </FieldRow>
      )}

      {!isPending && (
        <FieldRow label="地點">
          <TextInput value={location} onChange={setLocation} placeholder="地點（選填）" />
        </FieldRow>
      )}

      {/* ══ 2. Type-specific ══════════════════════════════════════════════════ */}

      {isMedical && (
        <>
          <SectionLabel>醫療資訊</SectionLabel>
          <FieldRow label="醫院">
            <TextInput value={hospital} onChange={setHospital} placeholder="醫院名稱" />
          </FieldRow>
          <FieldRow label="科別">
            <TextInput value={department} onChange={setDepartment} placeholder="如 骨科、神經內科" />
          </FieldRow>
        </>
      )}

      {isCourse && <SectionLabel>課程資訊</SectionLabel>}

      {isAirport && (
        <>
          <SectionLabel>接送機資訊</SectionLabel>
          <FieldRow label="接送類型">
            <div className="flex gap-2 flex-wrap">
              {(["接機", "送機", "未指定"] as const).map((opt) => {
                const val = opt === "未指定" ? "" : opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setTransferType(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      transferType === val
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </FieldRow>
          <FieldRow label="航班號碼">
            <TextInput value={flightNumber} onChange={setFlightNumber} placeholder="如 CI173" />
          </FieldRow>
          <FieldRow label="地區">
            <TextInput value={district} onChange={setDistrict} placeholder="如 中山、松山機場" />
          </FieldRow>
          <FieldRow label="車型">
            <TextInput value={vehicleType} onChange={setVehicleType} placeholder="如 轎車、廂型" />
          </FieldRow>
          {/* 接送費用由收支款項統一管理 */}
        </>
      )}

      {isShopping && (
        <>
          <SectionLabel>購物清單</SectionLabel>
          <FieldRow label="購物品項">
            <div className="space-y-1.5">
              {shoppingItems.length === 0 && (
                <p className="text-xs text-gray-600 py-1 italic">尚無品項</p>
              )}
              {shoppingItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.04] border border-white/8">
                  <span className="text-sm text-white">{item}</span>
                  <button
                    type="button"
                    onClick={() => setShoppingItems((p) => p.filter((_, i) => i !== idx))}
                    className="text-gray-500 hover:text-red-400 transition-colors ml-3 shrink-0 text-base leading-none px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddShoppingItem(); }}
                  placeholder="輸入品項，Enter 新增"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  type="button"
                  onClick={handleAddShoppingItem}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-gray-300 border border-white/10 transition-all shrink-0"
                >
                  新增
                </button>
              </div>
            </div>
          </FieldRow>
        </>
      )}

      {isPayment && (
        <>
          {/* 金額與截止日期由收支款項管理 */}
          <SectionLabel>付款資訊</SectionLabel>
          <FieldRow label="帳戶">
            <TextInput value={account} onChange={setAccount} placeholder="帳戶或繳費方式（選填）" />
          </FieldRow>
        </>
      )}

      {isIncome && (
        <>
          <SectionLabel>收入資訊</SectionLabel>
          <FieldRow label="金額">
            <TextInput value={incomeAmount} onChange={setIncomeAmount} placeholder="收入金額（元）" />
          </FieldRow>
          <FieldRow label="收入來源">
            <TextInput value={source} onChange={setSource} placeholder="如 薪資、接送收入（選填）" />
          </FieldRow>
        </>
      )}

      {isExpense && (
        <>
          <SectionLabel>支出資訊</SectionLabel>
          <FieldRow label="金額">
            <TextInput value={incomeAmount} onChange={setIncomeAmount} placeholder="支出金額（元）" />
          </FieldRow>
          <FieldRow label="商家">
            <TextInput value={merchant} onChange={setMerchant} placeholder="商家或地點（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══ 備註（共通）═══════════════════════════════════════════════════════ */}
      <FieldRow label="備註">
        <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
      </FieldRow>

      {/* ══ 3. 收支 ═══════════════════════════════════════════════════════════ */}
      {!isPending && (
        <>
          <SectionLabel>收支</SectionLabel>

          {/* ── 款項（預計收付）─────────────────────────────────────────── */}
          <SubLabel>款項</SubLabel>

          {/* Financial Items list */}
          {financialItems.length === 0 && !showAddItemForm && (
            <p className="text-xs text-gray-600 py-2">尚無待收或待付款項</p>
          )}

          <div className="space-y-px">
            {financialItems.map((fi) => {
              // An item is "completed" if flag is set OR a Finance Record already links to it
              const isItemCompleted =
                fi.completed === true ||
                linkedFinance.some(e => e.sourceFinancialItemId === fi.id);

              if (editingItemId === fi.id) {
                return (
                  <div key={fi.id} className="mb-2">
                    <ItemForm
                      type={editFormType}    title={editFormTitle}
                      amount={editFormAmount} dueDate={editFormDate} note={editFormNote}
                      setType={setEditFormType}    setTitle={setEditFormTitle}
                      setAmount={setEditFormAmount} setDueDate={setEditFormDate} setNote={setEditFormNote}
                      onSave={handleSaveEditItem}
                      onCancel={() => setEditingItemId(null)}
                      saveLabel="儲存"
                    />
                  </div>
                );
              }

              const isConf = confirmingItemId === fi.id;
              const canConfirmAmt = parseFloat(confirmAmount.replace(/,/g, "")) > 0;

              return (
                <div key={fi.id}>
                  <FinancialItemRow
                    item={fi}
                    isCompleted={isItemCompleted}
                    isConfirming={isConf}
                    onStartConfirm={() => !isItemCompleted && handleStartConfirm(fi)}
                    onEdit={() => handleStartEditItem(fi)}
                    onDelete={() => handleDeleteItem(fi.id)}
                  />

                  {/* Inline confirm form — expands below the row */}
                  {isConf && (
                    <div className="ml-7 mb-3 rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
                      <p className="text-xs text-gray-300 font-semibold">
                        {fi.type === "receivable" ? "確認收款" : "確認付款"}
                      </p>
                      {/* Amount */}
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1.5">
                          {fi.type === "receivable" ? "實收金額" : "實付金額"}
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
                      {/* Date */}
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1.5">
                          {fi.type === "receivable" ? "收款日期" : "付款日期"}
                        </p>
                        <input
                          type="date"
                          value={confirmDate}
                          onChange={(e) => setConfirmDate(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                          style={{ colorScheme: "dark" }}
                        />
                      </div>
                      {/* Note */}
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
                      {/* Buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleConfirmItem(fi)}
                          disabled={!canConfirmAmt}
                          className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-40 ${
                            fi.type === "receivable"
                              ? "bg-teal-600 hover:bg-teal-500"
                              : "bg-rose-600 hover:bg-rose-500"
                          }`}
                        >
                          {fi.type === "receivable" ? "確認已收款" : "確認已付款"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingItemId(null)}
                          className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add item form */}
          {showAddItemForm && !editingItemId && !confirmingItemId && (
            <ItemForm
              type={itemFormType}    title={itemFormTitle}
              amount={itemFormAmount} dueDate={itemFormDate} note={itemFormNote}
              setType={setItemFormType}    setTitle={setItemFormTitle}
              setAmount={setItemFormAmount} setDueDate={setItemFormDate} setNote={setItemFormNote}
              onSave={handleAddItem}
              onCancel={() => { setShowAddItemForm(false); resetAddForm(); }}
            />
          )}

          {/* ＋ 新增款項 */}
          {!showAddItemForm && !editingItemId && !confirmingItemId && (
            <button
              type="button"
              onClick={() => setShowAddItemForm(true)}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <span className="text-sm leading-none">＋</span>
              <span>新增款項</span>
            </button>
          )}

          {/* ── 實際收支（Finance Records）─────────────────────────────── */}
          <SubLabel>實際收支</SubLabel>

          {linkedFinance.length === 0 && !showAddFinance ? (
            <p className="text-xs text-gray-600 py-2">尚無實際收支紀錄</p>
          ) : linkedFinance.length > 0 ? (
            <div className="py-2 space-y-1">
              {incomeTotal > 0 && (
                <p className="text-sm text-teal-400">收入 + {fmtCurrency(incomeTotal)}</p>
              )}
              {expenseTotal > 0 && (
                <p className="text-sm text-rose-400">支出 − {fmtCurrency(expenseTotal)}</p>
              )}
              <p className="text-xs text-gray-600">{linkedFinance.length} 筆紀錄</p>

              <div className="flex items-center gap-4 pt-1.5">
                <button
                  type="button"
                  onClick={() => setShowDetail((p) => !p)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showDetail ? "收合明細" : "查看明細"}
                </button>
                {!showAddFinance && (
                  <button
                    type="button"
                    onClick={() => { setShowAddFinance(true); setNewFinType(initFinType); setNewFinAmount(""); setNewFinCat(defaultFinCategory(t, initFinType)); }}
                    className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    ＋ 新增
                  </button>
                )}
              </div>

              {/* Detail list */}
              {showDetail && (
                <div className="mt-2 space-y-px">
                  {linkedFinance.map((e) => (
                    <div key={e.id} className="flex items-start justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-sm text-gray-200">{e.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {e.date}{e.financialCategory ? ` · ${e.financialCategory}` : ""}
                        </p>
                      </div>
                      <span className={`text-sm font-medium tabular-nums ml-4 shrink-0 ${
                        e.type === "Income" ? "text-teal-400" : "text-rose-400"
                      }`}>
                        {e.type === "Income" ? "+" : "−"} {fmtCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Inline Finance Record form */}
          {showAddFinance && (
            <div className="mt-2 rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">
                {newFinType === "income" ? "新增收入紀錄" : "新增支出紀錄"}
              </p>
              {/* Type toggle */}
              <div className="flex rounded-xl bg-white/5 border border-white/8 p-0.5 gap-0.5">
                {([["expense","支出"],["income","收入"]] as const).map(([ft, lbl]) => (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => { setNewFinType(ft); setNewFinCat(defaultFinCategory(t, ft)); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      newFinType === ft
                        ? ft === "income"
                          ? "bg-teal-500/20 text-teal-300 border border-teal-500/25"
                          : "bg-orange-500/20 text-orange-300 border border-orange-500/25"
                        : "text-gray-500"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              {/* Amount */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-gray-500 text-sm shrink-0">NT$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newFinAmount}
                  onChange={(e) => setNewFinAmount(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent text-white text-base font-semibold focus:outline-none placeholder-gray-700"
                />
              </div>
              {/* Category */}
              <select
                value={newFinCat}
                onChange={(e) => setNewFinCat(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                style={{ colorScheme: "dark" }}
              >
                <option value="">選擇分類</option>
                {newFinCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {/* Date */}
              <input
                type="date"
                value={newFinDate}
                onChange={(e) => setNewFinDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                style={{ colorScheme: "dark" }}
              />
              {/* Notes */}
              <input
                type="text"
                value={newFinNotes}
                onChange={(e) => setNewFinNotes(e.target.value)}
                placeholder="備註（選填）"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveFinanceRecord}
                  disabled={!canSaveNewFin}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
                >
                  儲存紀錄
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddFinance(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* ＋ 新增收支 — when no records and form not showing */}
          {linkedFinance.length === 0 && !showAddFinance && (
            <button
              type="button"
              onClick={() => { setShowAddFinance(true); setNewFinType(initFinType); setNewFinAmount(""); setNewFinCat(defaultFinCategory(t, initFinType)); }}
              className="mt-2 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
            >
              <span className="text-sm leading-none">＋</span>
              <span>新增收支</span>
            </button>
          )}
        </>
      )}

      {/* ══ 4. 提醒設定 ════════════════════════════════════════════════════════ */}
      {!isPending && (
        <>
          <SectionLabel>提醒設定</SectionLabel>
          <Toggle
            label="提醒事項"
            description="啟用提醒通知"
            checked={reminderEnabled}
            onChange={setReminderEnabled}
          />
          <Toggle
            label="行事曆"
            description="加入行事曆（尚未串接）"
            checked={calendarEnabled}
            onChange={setCalendarEnabled}
          />
          {reminderEnabled && (
            <div className="pt-3 pb-1">
              <ReminderEditor
                reminders={reminders}
                onChange={setReminders}
                hasDate={re_hasDate}
                hasTime={re_hasTime}
              />
            </div>
          )}
        </>
      )}

      {/* ══ 5. 儲存／取消 ══════════════════════════════════════════════════════ */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20"
        >
          儲存
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold text-sm transition-all"
        >
          取消
        </button>
      </div>

      {/* ══ 6. 刪除 ════════════════════════════════════════════════════════════ */}
      <button
        onClick={handleDeleteConfirm}
        className="w-full mt-3 py-3.5 rounded-xl text-red-400 hover:bg-red-500/8 border border-red-500/20 text-sm font-semibold transition-all"
      >
        刪除此事項
      </button>
    </div>
  );
}
