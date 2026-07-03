import { useState } from "react";
import type { Reminder, ReminderNotification } from "../store";
import { normalizeDate } from "../utils";
import { TYPE_LABEL, type AllType } from "../previewTypes";
import { ReminderEditor } from "../components/ReminderEditor";
import { TimePicker } from "../components/TimePicker";
import { QuickFinanceModal } from "../components/QuickFinanceModal";
import { loadFinanceEntries, type FinanceEntry, fmtCurrency } from "../financeStore";

// ── UI primitives ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mt-8 mb-2 pb-1.5 border-b border-white/8">
      {children}
    </p>
  );
}

function FieldRow({ label, children, alignTop = false }: {
  label: string;
  children: React.ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div className={`flex gap-4 py-3 border-b border-white/5 ${alignTop ? "items-start" : "items-start"}`}>
      <span className="w-20 text-xs text-gray-500 pt-1.5 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
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
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ml-4 ${
          checked ? "bg-blue-500" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Type badge styles ────────────────────────────────────────────────────────

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

// ─── Reusable sub-components ──────────────────────────────────────────────────

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent text-sm text-white focus:outline-none"
      style={{ colorScheme: "dark" }}
    />
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

  // ── Common state ──────────────────────────────────────────────────────────
  const [title,     setTitle]     = useState(reminder.title);
  const [date,      setDate]      = useState(normalizeDate(reminder.date));
  const [startTime, setStartTime] = useState(reminder.startTime);
  const [endTime,   setEndTime]   = useState(reminder.endTime);
  const [allDay,    setAllDay]    = useState(reminder.allDay ?? !reminder.startTime);
  const [location,  setLocation]  = useState(reminder.location);
  const [linkedFinance,    setLinkedFinance]    = useState<FinanceEntry[]>(() =>
    loadFinanceEntries().filter((e) => e.sourceReminderId === reminder.id)
  );
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showQuickFinance,  setShowQuickFinance]  = useState(false);
  const [notes,     setNotes]     = useState(reminder.notes);
  const [category,  setCategory]  = useState(reminder.category ?? "");

  // ── Airport Transfer ──────────────────────────────────────────────────────
  const [flightNumber, setFlightNumber] = useState(reminder.flightNumber ?? "");
  const [transferType, setTransferType] = useState(reminder.transferType ?? "");
  const [district,     setDistrict]     = useState(reminder.district ?? "");
  const [vehicleType,  setVehicleType]  = useState(reminder.vehicleType ?? "");
  const [price,        setPrice]        = useState(reminder.price ?? "");

  // ── Shopping ──────────────────────────────────────────────────────────────
  const [shoppingItems, setShoppingItems] = useState<string[]>(
    reminder.shoppingItems ?? []
  );
  const [newItem, setNewItem] = useState("");

  // ── Payment ───────────────────────────────────────────────────────────────
  const [dueDate,  setDueDate]  = useState(
    normalizeDate(reminder.dueDate ?? reminder.date ?? "")
  );
  const [amount,   setAmount]   = useState(reminder.amount ?? "");
  const [account,  setAccount]  = useState(reminder.account ?? "");

  // ── Medical ───────────────────────────────────────────────────────────────
  const [hospital,    setHospital]    = useState(reminder.hospital ?? "");
  const [department,  setDepartment]  = useState(reminder.department ?? "");

  // ── Income ────────────────────────────────────────────────────────────────
  const [source, setSource] = useState(reminder.source ?? "");

  // ── Expense ───────────────────────────────────────────────────────────────
  const [merchant, setMerchant] = useState(reminder.merchant ?? "");

  // ── Reminder notifications (v2) ───────────────────────────────────────────
  const [reminders, setReminders] = useState<ReminderNotification[]>(
    reminder.reminders ?? []
  );

  // ── Legacy reminder settings (preserved for backward compat) ─────────────
  const [reminderEnabled, setReminderEnabled] = useState(
    reminder.reminderEnabled ?? true
  );
  const [calendarEnabled, setCalendarEnabled] = useState(
    reminder.calendarEnabled ?? false
  );

  // ── Computed flags ────────────────────────────────────────────────────────
  const isPayment  = t === "Payment";
  const isCourse   = t === "Course";
  const isAirport  = t === "Airport Transfer";
  const isMedical  = t === "Medical";
  const isShopping = t === "Shopping";
  const isIncome   = t === "Income";
  const isExpense  = t === "Expense";
  const isPending  = t === "Pending";
  const isGeneral  = !isPayment && !isCourse && !isAirport && !isMedical && !isShopping && !isIncome && !isExpense;

  // What to pass into ReminderEditor
  const re_hasDate = isPayment ? !!dueDate : !!date;
  const re_hasTime = (isCourse || isAirport || isMedical || (!isPending && isGeneral)) ? !!startTime : false;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAddShoppingItem() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setShoppingItems((prev) => [...prev, trimmed]);
    setNewItem("");
  }

  function handleSave() {
    onSave({
      title,
      date,
      startTime: allDay ? "" : startTime,
      endTime:   allDay ? "" : endTime,
      allDay,
      location,
      notes,
      category,
      flightNumber,
      transferType,
      district,
      vehicleType,
      price,
      shoppingItems,
      dueDate,
      amount,
      account,
      hospital,
      department,
      source,
      merchant,
      reminders,
      // Legacy fields — always preserved so old data is never wiped
      reminderEnabled,
      calendarEnabled,
      sameDayReminder:     reminder.sameDayReminder,
      dayBeforeReminder:   reminder.dayBeforeReminder,
      hoursBeforeReminder: reminder.hoursBeforeReminder,
    });
  }

  function handleDeleteConfirm() {
    if (linkedFinance.length > 0) {
      setShowDeleteWarning(true);
    } else {
      if (window.confirm("確定要刪除這個提醒事項嗎？刪除後無法復原。")) {
        onDelete();
      }
    }
  }

  const badgeClass = TYPE_BADGE[t] ?? TYPE_BADGE.Pending;
  const badgeLabel = TYPE_LABEL[t as AllType] ?? t;

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
            <path
              d="M10 12L6 8l4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          返回
        </button>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PAYMENT — only payment-specific fields; no general date/time/location
          ══════════════════════════════════════════════════════════════════════ */}
      {isPayment && (
        <>
          <SectionLabel>付款資訊</SectionLabel>
          <FieldRow label="付款名稱">
            <TextInput value={title} onChange={setTitle} placeholder="付款名稱" />
          </FieldRow>

          <FieldRow label="截止日期">
            <DateField value={dueDate} onChange={setDueDate} />
          </FieldRow>
          <FieldRow label="金額">
            <TextInput value={amount} onChange={setAmount} placeholder="金額（元）" />
          </FieldRow>
          <FieldRow label="帳戶">
            <TextInput
              value={account}
              onChange={setAccount}
              placeholder="帳戶或繳費方式（選填）"
            />
          </FieldRow>
          <FieldRow label="備註">
            <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          COURSE — needs both startTime and endTime
          ══════════════════════════════════════════════════════════════════════ */}
      {isCourse && (
        <>
          <SectionLabel>課程資訊</SectionLabel>
          <FieldRow label="課程名稱">
            <TextInput value={title} onChange={setTitle} placeholder="課程名稱" />
          </FieldRow>

          <FieldRow label="日期">
            <DateField value={date} onChange={setDate} />
          </FieldRow>
          <FieldRow label="時間">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { if (!allDay) { setStartTime(""); setEndTime(""); } setAllDay(!allDay); }}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                  allDay ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                }`}
              >
                全天
              </button>
              {!allDay && (
                <>
                  <TimePicker value={startTime} onChange={setStartTime} />
                  <span className="text-gray-500 text-xs shrink-0">—</span>
                  <TimePicker value={endTime} onChange={setEndTime} />
                </>
              )}
            </div>
          </FieldRow>
          <FieldRow label="地點">
            <TextInput value={location} onChange={setLocation} placeholder="地點（選填）" />
          </FieldRow>
          <FieldRow label="備註">
            <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          AIRPORT TRANSFER
          ══════════════════════════════════════════════════════════════════════ */}
      {isAirport && (
        <>
          <SectionLabel>接送機資訊</SectionLabel>
          <FieldRow label="接送類型">
            <div className="flex gap-2 flex-wrap">
              {(["接機", "送機", "未指定"] as const).map((opt) => {
                const val = opt === "未指定" ? "" : opt;
                const active = transferType === val;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setTransferType(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      active
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
          <FieldRow label="日期">
            <DateField value={date} onChange={setDate} />
          </FieldRow>
          <FieldRow label="接送時間">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { if (!allDay) setStartTime(""); setAllDay(!allDay); }}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                  allDay ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                }`}
              >
                全天
              </button>
              {!allDay && <TimePicker value={startTime} onChange={setStartTime} />}
            </div>
          </FieldRow>
          <FieldRow label="地區">
            <TextInput value={district} onChange={setDistrict} placeholder="如 中山、松山機場" />
          </FieldRow>
          <FieldRow label="車型">
            <TextInput value={vehicleType} onChange={setVehicleType} placeholder="如 轎車、廂型" />
          </FieldRow>
          <FieldRow label="金額">
            <TextInput value={price} onChange={setPrice} placeholder="金額（元）" />
          </FieldRow>

          <FieldRow label="備註">
            <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MEDICAL — no endTime; only single appointment time
          ══════════════════════════════════════════════════════════════════════ */}
      {isMedical && (
        <>
          <SectionLabel>醫療資訊</SectionLabel>
          <FieldRow label="事由">
            <TextInput value={title} onChange={setTitle} placeholder="看診事由" />
          </FieldRow>

          <FieldRow label="醫院">
            <TextInput value={hospital} onChange={setHospital} placeholder="醫院名稱" />
          </FieldRow>
          <FieldRow label="科別">
            <TextInput
              value={department}
              onChange={setDepartment}
              placeholder="如 骨科、神經內科"
            />
          </FieldRow>
          <FieldRow label="日期">
            <DateField value={date} onChange={setDate} />
          </FieldRow>
          <FieldRow label="看診時間">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { if (!allDay) setStartTime(""); setAllDay(!allDay); }}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                  allDay ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                }`}
              >
                全天
              </button>
              {!allDay && <TimePicker value={startTime} onChange={setStartTime} />}
            </div>
          </FieldRow>
          <FieldRow label="備註">
            <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SHOPPING — no time fields
          ══════════════════════════════════════════════════════════════════════ */}
      {isShopping && (
        <>
          <SectionLabel>購物清單</SectionLabel>
          <FieldRow label="清單名稱">
            <TextInput value={title} onChange={setTitle} placeholder="清單名稱（選填）" />
          </FieldRow>

          <FieldRow label="日期">
            <DateField value={date} onChange={setDate} />
          </FieldRow>
          <FieldRow label="購物品項" alignTop>
            <div className="space-y-1.5">
              {shoppingItems.length === 0 && (
                <p className="text-xs text-gray-600 py-1 italic">尚無品項</p>
              )}
              {shoppingItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.04] border border-white/8"
                >
                  <span className="text-sm text-white">{item}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setShoppingItems((prev) => prev.filter((_, i) => i !== idx))
                    }
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddShoppingItem();
                  }}
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
          <FieldRow label="備註">
            <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INCOME
          ══════════════════════════════════════════════════════════════════════ */}
      {isIncome && (
        <>
          <SectionLabel>收入資訊</SectionLabel>
          <FieldRow label="標題">
            <TextInput value={title} onChange={setTitle} placeholder="收入名稱" />
          </FieldRow>
          <FieldRow label="日期">
            <DateField value={date} onChange={setDate} />
          </FieldRow>
          <FieldRow label="金額">
            <TextInput value={amount} onChange={setAmount} placeholder="收入金額（元）" />
          </FieldRow>
          <FieldRow label="收入來源">
            <TextInput
              value={source}
              onChange={setSource}
              placeholder="如 薪資、接送收入（選填）"
            />
          </FieldRow>

          <FieldRow label="備註">
            <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          EXPENSE
          ══════════════════════════════════════════════════════════════════════ */}
      {isExpense && (
        <>
          <SectionLabel>支出資訊</SectionLabel>
          <FieldRow label="標題">
            <TextInput value={title} onChange={setTitle} placeholder="支出名稱" />
          </FieldRow>
          <FieldRow label="日期">
            <DateField value={date} onChange={setDate} />
          </FieldRow>
          <FieldRow label="金額">
            <TextInput value={amount} onChange={setAmount} placeholder="支出金額（元）" />
          </FieldRow>
          <FieldRow label="商家">
            <TextInput
              value={merchant}
              onChange={setMerchant}
              placeholder="商家或地點（選填）"
            />
          </FieldRow>

          <FieldRow label="備註">
            <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GENERAL / WORK / FAMILY / PENDING (fallback)
          ══════════════════════════════════════════════════════════════════════ */}
      {isGeneral && (
        <>
          <SectionLabel>基本資訊</SectionLabel>
          <FieldRow label="標題">
            <TextInput value={title} onChange={setTitle} placeholder="事項標題" />
          </FieldRow>
          {!isPending && (
            <FieldRow label="日期">
              <DateField value={date} onChange={setDate} />
            </FieldRow>
          )}
          {!isPending && (
            <FieldRow label="時間">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { if (!allDay) { setStartTime(""); setEndTime(""); } setAllDay(!allDay); }}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                    allDay ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                  }`}
                >
                  全天
                </button>
                {!allDay && <TimePicker value={startTime} onChange={setStartTime} />}
              </div>
            </FieldRow>
          )}
          {!isPending && (
            <FieldRow label="地點">
              <TextInput value={location} onChange={setLocation} placeholder="地點（選填）" />
            </FieldRow>
          )}
          <FieldRow label="備註">
            <TextArea value={notes} onChange={setNotes} placeholder="備註（選填）" />
          </FieldRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REMINDER SETTINGS — all types (except Pending)
          ══════════════════════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════════════════════
          RELATED FINANCE
          ══════════════════════════════════════════════════════════════════════ */}
      {!isPending && (
        <>
          <SectionLabel>相關收支</SectionLabel>
          {linkedFinance.length > 0 ? (
            <div className="mb-3 space-y-px">
              {linkedFinance.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-gray-200">{e.title}</p>
                    {e.financialCategory && (
                      <p className="text-xs text-gray-500">{e.date} · {e.financialCategory}</p>
                    )}
                  </div>
                  <span className={`text-sm font-medium tabular-nums ${e.type === "Income" ? "text-teal-400" : "text-rose-400"}`}>
                    {e.type === "Income" ? "+" : "−"} {fmtCurrency(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600 py-2">尚無相關收支紀錄</p>
          )}
          <button
            type="button"
            onClick={() => setShowQuickFinance(true)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 mb-6"
          >
            <span className="text-sm leading-none">＋</span>
            <span>{linkedFinance.length > 0 ? "新增記帳" : "記帳"}</span>
          </button>
        </>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────────── */}
      <div className="mt-4 flex gap-3">
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
      <button
        onClick={handleDeleteConfirm}
        className="w-full mt-3 py-3.5 rounded-xl text-red-400 hover:bg-red-500/8 border border-red-500/20 text-sm font-semibold transition-all"
      >
        刪除此事項
      </button>

      {/* Quick Finance Modal */}
      {showQuickFinance && (
        <QuickFinanceModal
          reminder={reminder}
          onSave={(entry) => {
            setLinkedFinance((prev) => [...prev, entry]);
            setShowQuickFinance(false);
          }}
          onCancel={() => setShowQuickFinance(false)}
        />
      )}

      {/* Delete Warning Modal */}
      {showDeleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">確認刪除</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              此事項有{" "}
              <span className="text-white font-medium">{linkedFinance.length} 筆</span>
              {" "}相關收支紀錄。刪除事項後，收支紀錄將保留，但會解除事項關聯。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteWarning(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteWarning(false); onDelete(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                刪除事項
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
