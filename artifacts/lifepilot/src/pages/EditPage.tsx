import { useState } from "react";
import type { Reminder, ReminderNotification } from "../store";
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

// ─── Finance mode types ───────────────────────────────────────────────────────
// "none" | "receivable" | "payable" = Reminder financial status (saved)
// "income" | "expense" = transient UI mode for creating Finance Records

type FinanceMode = "none" | "receivable" | "payable" | "income" | "expense";
type SavedFinancialStatus = "none" | "receivable" | "payable";

const FINANCE_MODE_OPTIONS: {
  key: FinanceMode;
  label: string;
  activeClass: string;
}[] = [
  { key: "none",       label: "無",   activeClass: "bg-white/12 text-gray-300 border-white/25" },
  { key: "receivable", label: "待收", activeClass: "bg-teal-500/20 text-teal-300 border-teal-500/40" },
  { key: "payable",    label: "待付", activeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  { key: "income",     label: "收入", activeClass: "bg-teal-700/25 text-teal-200 border-teal-500/30" },
  { key: "expense",    label: "支出", activeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
];

// helper: default Finance Record category from reminder type
function defaultCategory(rType: string, finType: "income" | "expense"): string {
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

// helper: default Finance Record amount from reminder
function defaultFinanceAmount(reminder: Reminder, finType: "income" | "expense"): string {
  if (reminder.type === "Airport Transfer" && finType === "income") return reminder.price ?? "";
  if (reminder.type === "Payment") return reminder.amount ?? "";
  return "";
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
  const [price,        setPrice]        = useState(reminder.price ?? "");
  const [shoppingItems, setShoppingItems] = useState<string[]>(reminder.shoppingItems ?? []);
  const [newItem,       setNewItem]       = useState("");
  const [dueDate,    setDueDate]    = useState(normalizeDate(reminder.dueDate ?? reminder.date ?? ""));
  const [amount,     setAmount]     = useState(reminder.amount ?? "");
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

  // ── Saved financial status (written to Reminder on save) ──────────────────
  const [financialStatus, setFinancialStatus] = useState<SavedFinancialStatus>(() => {
    if (reminder.financialStatus === "receivable" || reminder.financialStatus === "payable") return reminder.financialStatus;
    if (!reminder.financialStatus && t === "Payment" && reminder.amount) return "payable";
    return "none";
  });
  const [expectedAmount, setExpectedAmount] = useState<number | undefined>(() => {
    if (reminder.expectedAmount !== undefined) return reminder.expectedAmount;
    if (!reminder.financialStatus && t === "Payment" && reminder.amount) {
      const n = parseFloat(String(reminder.amount).replace(/,/g, ""));
      return isNaN(n) ? undefined : n;
    }
    return undefined;
  });
  const [financialDueDate, setFinancialDueDate] = useState<string>(() => {
    if (reminder.financialDueDate) return reminder.financialDueDate;
    if (!reminder.financialStatus && t === "Payment" && reminder.dueDate) return normalizeDate(reminder.dueDate);
    return "";
  });

  // ── Finance UI mode (includes transient income/expense for inline form) ────
  const [financeMode, setFinanceMode] = useState<FinanceMode>(() => {
    if (reminder.financialStatus === "receivable") return "receivable";
    if (reminder.financialStatus === "payable")    return "payable";
    if (!reminder.financialStatus && t === "Payment" && reminder.amount) return "payable";
    return "none";
  });

  // ── Linked Finance Records ─────────────────────────────────────────────────
  const [linkedFinance, setLinkedFinance] = useState<FinanceEntry[]>(() =>
    loadFinanceEntries().filter((e) => e.sourceReminderId === reminder.id)
  );
  const [showDetail,    setShowDetail]    = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false); // mini type picker for "＋新增"

  // ── Inline Finance Record form state ──────────────────────────────────────
  const initFinType: "income" | "expense" =
    t === "Airport Transfer" ? "income" : "expense";
  const [newFinType,    setNewFinType]    = useState<"income" | "expense">(initFinType);
  const [newFinAmount,  setNewFinAmount]  = useState("");
  const [newFinCat,     setNewFinCat]     = useState("");
  const [newFinDate,    setNewFinDate]    = useState(normalizeDate(date));
  const [newFinNotes,   setNewFinNotes]   = useState("");

  const newFinCategories = newFinType === "income" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
  const canSaveNewFin = !!newFinAmount && !isNaN(parseFloat(newFinAmount)) && parseFloat(newFinAmount) > 0;

  // ── Finance summary ────────────────────────────────────────────────────────
  const incomeTotal  = linkedFinance.filter(e => e.type === "Income").reduce((s, e) => s + e.amount, 0);
  const expenseTotal = linkedFinance.filter(e => e.type === "Expense").reduce((s, e) => s + e.amount, 0);

  // ── Finance mode selector handler ─────────────────────────────────────────

  function handleFinanceModeSelect(mode: FinanceMode) {
    setFinanceMode(mode);
    setShowAddPicker(false);
    // 無/待收/待付 → also update the saved financial status
    if (mode === "none" || mode === "receivable" || mode === "payable") {
      setFinancialStatus(mode);
    }
    // 收入/支出 → initialize inline form defaults
    if (mode === "income" || mode === "expense") {
      setNewFinType(mode);
      setNewFinAmount(defaultFinanceAmount(reminder, mode));
      setNewFinCat(defaultCategory(t, mode));
      setNewFinDate(normalizeDate(date || dueDate));
      setNewFinNotes("");
    }
  }

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
    const prev = loadFinanceEntries();
    saveFinanceEntries([...prev, entry]);
    setLinkedFinance((p) => [...p, entry]);
    // Revert to non-transient mode (based on saved financial status)
    setFinanceMode(financialStatus !== "none" ? financialStatus : "none");
    setShowAddPicker(false);
    // Reset form
    setNewFinAmount(""); setNewFinCat(""); setNewFinNotes("");
  }

  function handleCancelFinanceRecord() {
    setFinanceMode(financialStatus !== "none" ? financialStatus : "none");
    setShowAddPicker(false);
  }

  // ── Main save ─────────────────────────────────────────────────────────────

  function handleSave() {
    onSave({
      title,
      date:      isPayment ? "" : date,
      dueDate:   isPayment ? dueDate : undefined,
      startTime: timeMode !== "allday" ? startTime : "",
      endTime:   timeMode === "range"  ? endTime   : "",
      allDay:    timeMode === "allday",
      location,
      notes,
      category,
      flightNumber, transferType, district, vehicleType, price,
      shoppingItems,
      amount: isPayment ? amount : (isIncome || isExpense) ? incomeAmount : amount,
      account,
      hospital, department, source, merchant,
      reminders, reminderEnabled, calendarEnabled,
      sameDayReminder:     reminder.sameDayReminder,
      dayBeforeReminder:   reminder.dayBeforeReminder,
      hoursBeforeReminder: reminder.hoursBeforeReminder,
      // Financial status — only from saved state, never from transient income/expense mode
      financialStatus: financialStatus !== "none" ? financialStatus : undefined,
      expectedAmount:  financialStatus !== "none" ? expectedAmount  : undefined,
      financialDueDate: financialStatus !== "none" ? (financialDueDate || undefined) : undefined,
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
  const re_hasDate = isPayment ? !!dueDate : !!date;
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

      {!isPending && (
        <FieldRow label={isPayment ? "截止日期" : "日期"}>
          <input
            type="date"
            value={isPayment ? dueDate : date}
            onChange={(e) => isPayment ? setDueDate(e.target.value) : setDate(e.target.value)}
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
          <FieldRow label="接送費用">
            <TextInput value={price} onChange={setPrice} placeholder="費用（元）" />
          </FieldRow>
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
          <SectionLabel>付款資訊</SectionLabel>
          <FieldRow label="金額">
            <TextInput value={amount} onChange={setAmount} placeholder="金額（元）" />
          </FieldRow>
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

      {/* ══ 3. 收支（統一區塊）══════════════════════════════════════════════ */}
      {!isPending && (
        <>
          <SectionLabel>收支</SectionLabel>

          {/* Segmented control: 無 | 待收 | 待付 | 收入 | 支出 */}
          <div className="flex gap-1.5 flex-wrap pt-2 pb-3 border-b border-white/5">
            {FINANCE_MODE_OPTIONS.map(({ key, label, activeClass }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleFinanceModeSelect(key)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                  financeMode === key
                    ? activeClass
                    : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 待收 / 待付 expected fields */}
          {(financeMode === "receivable" || financeMode === "payable") && (
            <>
              <FieldRow label="預計金額">
                <input
                  type="number"
                  value={expectedAmount ?? ""}
                  onChange={(e) => setExpectedAmount(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                  placeholder="金額（元）"
                  min={0}
                  step={1}
                  className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
                  style={{ colorScheme: "dark" }}
                />
              </FieldRow>
              <FieldRow label={financeMode === "receivable" ? "預計收款日" : "付款期限"}>
                <input
                  type="date"
                  value={financialDueDate}
                  onChange={(e) => setFinancialDueDate(e.target.value)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none"
                  style={{ colorScheme: "dark" }}
                />
              </FieldRow>
            </>
          )}

          {/* 收入 / 支出 inline Finance Record creation form */}
          {(financeMode === "income" || financeMode === "expense") && (
            <div className="mt-3 mb-2 rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">
                {financeMode === "income" ? "新增收入紀錄" : "新增支出紀錄"}
              </p>
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
              {/* Buttons */}
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
                  onClick={handleCancelFinanceRecord}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Finance Records summary */}
          {linkedFinance.length > 0 && (
            <div className="mt-3 py-3 space-y-1 border-b border-white/5">
              {incomeTotal > 0 && (
                <p className="text-sm text-teal-400">收入 + {fmtCurrency(incomeTotal)}</p>
              )}
              {expenseTotal > 0 && (
                <p className="text-sm text-rose-400">支出 − {fmtCurrency(expenseTotal)}</p>
              )}
              <p className="text-xs text-gray-600">{linkedFinance.length} 筆紀錄</p>

              {/* Actions row */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDetail((p) => !p)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showDetail ? "收合明細" : "查看明細"}
                </button>

                {!showAddPicker && financeMode !== "income" && financeMode !== "expense" && (
                  <button
                    type="button"
                    onClick={() => setShowAddPicker(true)}
                    className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    ＋ 新增
                  </button>
                )}
              </div>

              {/* Mini type picker for ＋新增 */}
              {showAddPicker && (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleFinanceModeSelect("income")}
                    className="px-4 py-2 rounded-xl bg-teal-700/25 text-teal-200 border border-teal-500/30 text-sm font-medium"
                  >
                    收入
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinanceModeSelect("expense")}
                    className="px-4 py-2 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/40 text-sm font-medium"
                  >
                    支出
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPicker(false)}
                    className="px-3 py-2 text-gray-500 hover:text-gray-300 text-sm"
                  >
                    取消
                  </button>
                </div>
              )}

              {/* Detail list */}
              {showDetail && (
                <div className="mt-3 space-y-px">
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
          )}

          {/* ＋新增 — shown only when no Finance Records yet */}
          {linkedFinance.length === 0 && financeMode !== "income" && financeMode !== "expense" && (
            <div className="flex gap-2 pt-3 pb-1">
              <button
                type="button"
                onClick={() => handleFinanceModeSelect("income")}
                className="text-xs text-gray-500 hover:text-teal-300 transition-colors"
              >
                ＋ 收入
              </button>
              <span className="text-gray-700 text-xs">·</span>
              <button
                type="button"
                onClick={() => handleFinanceModeSelect("expense")}
                className="text-xs text-gray-500 hover:text-orange-300 transition-colors"
              >
                ＋ 支出
              </button>
            </div>
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
