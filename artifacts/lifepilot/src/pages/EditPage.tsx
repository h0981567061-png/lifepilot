import { useState } from "react";
import type { Reminder } from "../store";

// ── UI helpers ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mt-8 mb-2 pb-1.5 border-b border-white/8">
      {children}
    </p>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-white/5">
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

function Toggle({ label, description, checked, onChange, indent = false }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-3.5 border-b border-white/5 cursor-pointer select-none ${indent ? "pl-4" : ""}`}
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
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Type badge constants ─────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  Course: "課程",
  "Airport Transfer": "接送機",
  Medical: "醫療",
  Shopping: "購物",
  Payment: "付款",
  Pending: "待確認",
};

const TYPE_COLOR: Record<string, string> = {
  Course: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  "Airport Transfer": "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Medical: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  Shopping: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  Payment: "bg-purple-500/15 text-purple-300 border-purple-500/25",
  Pending: "bg-white/10 text-gray-400 border-white/15",
};

// ─── Main component ───────────────────────────────────────────────────────────

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
  // ── Common fields ──
  const [title, setTitle] = useState(reminder.title);
  const [date, setDate] = useState(reminder.date);
  const [startTime, setStartTime] = useState(reminder.startTime);
  const [endTime, setEndTime] = useState(reminder.endTime);
  const [location, setLocation] = useState(reminder.location);
  const [notes, setNotes] = useState(reminder.notes);

  // ── Airport Transfer ──
  const [flightNumber, setFlightNumber] = useState(reminder.flightNumber ?? "");
  const [transferType, setTransferType] = useState(reminder.transferType ?? "");
  const [district, setDistrict] = useState(reminder.district ?? "");
  const [vehicleType, setVehicleType] = useState(reminder.vehicleType ?? "");
  const [price, setPrice] = useState(reminder.price ?? "");

  // ── Shopping ──
  const [shoppingItems, setShoppingItems] = useState<string[]>(reminder.shoppingItems ?? []);
  const [newItem, setNewItem] = useState("");

  // ── Payment ──
  const [dueDate, setDueDate] = useState(reminder.dueDate ?? "");
  const [amount, setAmount] = useState(reminder.amount ?? "");

  // ── Medical ──
  const [hospital, setHospital] = useState(reminder.hospital ?? "");
  const [department, setDepartment] = useState(reminder.department ?? "");

  // ── Reminder settings ──
  const [reminderEnabled, setReminderEnabled] = useState(reminder.reminderEnabled ?? true);
  const [calendarEnabled, setCalendarEnabled] = useState(reminder.calendarEnabled ?? false);
  const [sameDayReminder, setSameDayReminder] = useState(reminder.sameDayReminder ?? true);
  const [dayBeforeReminder, setDayBeforeReminder] = useState(reminder.dayBeforeReminder ?? false);
  const [hoursBeforeEnabled, setHoursBeforeEnabled] = useState(
    reminder.hoursBeforeReminder != null
  );
  const [hoursBeforeValue, setHoursBeforeValue] = useState<number>(
    reminder.hoursBeforeReminder ?? 2
  );

  function handleAddShoppingItem() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setShoppingItems((prev) => [...prev, trimmed]);
    setNewItem("");
  }

  function handleSave() {
    onSave({
      title, date, startTime, endTime, location, notes,
      flightNumber, transferType, district, vehicleType, price,
      shoppingItems,
      dueDate, amount,
      hospital, department,
      reminderEnabled, calendarEnabled, sameDayReminder, dayBeforeReminder,
      hoursBeforeReminder: hoursBeforeEnabled ? hoursBeforeValue : null,
    });
  }

  function handleDeleteConfirm() {
    if (window.confirm("確定要刪除這個提醒事項嗎？刪除後無法復原。")) {
      onDelete();
    }
  }

  const badgeClass = TYPE_COLOR[reminder.type] ?? TYPE_COLOR.Pending;
  const badgeLabel = TYPE_LABEL[reminder.type] ?? reminder.type;

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 pb-16">
      {/* ── Header ── */}
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

      {/* ── 基本資訊 ── */}
      <SectionLabel>基本資訊</SectionLabel>
      <FieldRow label="標題">
        <TextInput value={title} onChange={setTitle} placeholder="事項標題" />
      </FieldRow>
      <FieldRow label="日期">
        <TextInput value={date} onChange={setDate} placeholder="M/D，如 7/15" />
      </FieldRow>
      <FieldRow label="開始時間">
        <TextInput value={startTime} onChange={setStartTime} placeholder="HH:MM，如 09:00" />
      </FieldRow>
      <FieldRow label="結束時間">
        <TextInput value={endTime} onChange={setEndTime} placeholder="HH:MM，如 12:00" />
      </FieldRow>
      <FieldRow label="地點">
        <TextInput value={location} onChange={setLocation} placeholder="地點" />
      </FieldRow>
      <FieldRow label="備註">
        <TextArea value={notes} onChange={setNotes} placeholder="備註（可選）" />
      </FieldRow>

      {/* ── 接送機特殊欄位 ── */}
      {reminder.type === "Airport Transfer" && (
        <>
          <SectionLabel>接送機資料</SectionLabel>
          <FieldRow label="類型">
            <div className="flex gap-2">
              {(["接機", "送機", "未指定"] as const).map((opt) => {
                const val = opt === "未指定" ? "" : opt;
                const active = transferType === val;
                return (
                  <button
                    key={opt}
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
          <FieldRow label="地區">
            <TextInput value={district} onChange={setDistrict} placeholder="如 中山" />
          </FieldRow>
          <FieldRow label="車型">
            <TextInput value={vehicleType} onChange={setVehicleType} placeholder="如 轎車、廂型" />
          </FieldRow>
          <FieldRow label="金額">
            <TextInput value={price} onChange={setPrice} placeholder="如 1000" />
          </FieldRow>
        </>
      )}

      {/* ── 購物品項 ── */}
      {reminder.type === "Shopping" && (
        <>
          <SectionLabel>購物品項</SectionLabel>
          <div className="mt-1 flex flex-col gap-1.5">
            {shoppingItems.length === 0 && (
              <p className="text-xs text-gray-600 py-2 italic">尚無品項</p>
            )}
            {shoppingItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.04] border border-white/8"
              >
                <span className="text-sm text-white">{item}</span>
                <button
                  onClick={() => setShoppingItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-gray-500 hover:text-red-400 transition-colors ml-3 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddShoppingItem(); }}
              placeholder="輸入品項名稱，Enter 新增"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            <button
              onClick={handleAddShoppingItem}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-gray-300 border border-white/10 transition-all shrink-0"
            >
              新增
            </button>
          </div>
        </>
      )}

      {/* ── 付款資訊 ── */}
      {reminder.type === "Payment" && (
        <>
          <SectionLabel>付款資訊</SectionLabel>
          <FieldRow label="截止日期">
            <TextInput value={dueDate} onChange={setDueDate} placeholder="M/D，如 8/5" />
          </FieldRow>
          <FieldRow label="金額">
            <TextInput value={amount} onChange={setAmount} placeholder="如 23560" />
          </FieldRow>
        </>
      )}

      {/* ── 醫療資訊 ── */}
      {reminder.type === "Medical" && (
        <>
          <SectionLabel>醫療資訊</SectionLabel>
          <FieldRow label="醫院">
            <TextInput value={hospital} onChange={setHospital} placeholder="醫院名稱" />
          </FieldRow>
          <FieldRow label="科別">
            <TextInput value={department} onChange={setDepartment} placeholder="如 神經內科" />
          </FieldRow>
        </>
      )}

      {/* ── 提醒設定 ── */}
      <SectionLabel>提醒設定</SectionLabel>
      <Toggle
        label="提醒事項"
        description="加入提醒清單"
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
        <div className="ml-1 pl-3 border-l border-white/8 mt-1">
          <Toggle
            label="當日提醒"
            checked={sameDayReminder}
            onChange={setSameDayReminder}
            indent
          />
          <Toggle
            label="前一天提醒"
            checked={dayBeforeReminder}
            onChange={setDayBeforeReminder}
            indent
          />
          <Toggle
            label="提前提醒"
            checked={hoursBeforeEnabled}
            onChange={setHoursBeforeEnabled}
            indent
          />
          {hoursBeforeEnabled && (
            <div className="flex items-center gap-3 pl-4 py-2.5 border-b border-white/5">
              <span className="text-xs text-gray-500 shrink-0">提前幾小時</span>
              <select
                value={hoursBeforeValue}
                onChange={(e) => setHoursBeforeValue(Number(e.target.value))}
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                {[1, 2, 3, 6, 12, 24].map((h) => (
                  <option key={h} value={h} className="bg-gray-900 text-white">
                    {h} 小時前
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── 操作按鈕 ── */}
      <div className="mt-10 flex gap-3">
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
    </div>
  );
}
