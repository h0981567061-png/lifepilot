import { useState, useMemo } from "react";
import type { PreviewItem, AllType } from "../previewTypes";
import {
  ALL_TYPES,
  TYPE_LABEL,
  typeBorderClass,
  typeBadgeClass,
} from "../previewTypes";
import { normalizeDate, normalizeTime } from "../utils";
import { ReminderEditor } from "./ReminderEditor";
import { TimePicker } from "./TimePicker";
import { CategorySelect } from "./CategorySelect";
import { WorkProfileSelect } from "./WorkProfileSelect";
import { WorkProfileSummary } from "./WorkProfileSummary";
import { AirportTransferTemplateFields } from "./AirportTransferTemplateFields";
import { getWorkProfiles } from "../workProfileStore";
import type { FinancialItem } from "../store";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  item: PreviewItem;
  isEditing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onChange: (patch: Partial<PreviewItem>) => void;
  onDelete: () => void;
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: AllType }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${typeBadgeClass(type)}`}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-500 w-16 pt-2 shrink-0 text-right">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none";
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className={cls}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cls}
    />
  );
}

// ─── AllDay toggle + time inputs ────────────────────────────────────────────────

function AllDayToggle({
  allDay,
  onToggle,
}: {
  allDay: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2.5 py-1 rounded-full text-xs border transition-all shrink-0 ${
        allDay
          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
          : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
      }`}
    >
      全天
    </button>
  );
}

// ─── Compact display area (non-editing mode) ───────────────────────────────────

function ItemDisplay({ item }: { item: PreviewItem }) {
  const meta: string[] = [];

  switch (item.type) {
    case "Airport Transfer":
      if (item.transferType) meta.push(item.transferType);
      if (item.flightNumber) meta.push(item.flightNumber);
      if (item.allDay) meta.push("全天");
      else if (item.startTime) meta.push(normalizeTime(item.startTime));
      if (item.district) meta.push(item.district);
      if (item.vehicleType) meta.push(item.vehicleType);
      break;
    case "Payment":
      if (item.date) meta.push(`截止 ${item.date.replace(/-/g, "/")}`);
      break;
    case "Income":
      if (item.amount) meta.push(`${item.amount} 元`);
      if (item.source) meta.push(item.source);
      if (!item.allDay && item.startTime) meta.push(item.startTime);
      break;
    case "Expense":
      if (item.amount) meta.push(`${item.amount} 元`);
      if (item.merchant) meta.push(item.merchant);
      if (!item.allDay && item.startTime) meta.push(item.startTime);
      break;
    case "Medical":
      if (item.hospital) meta.push(item.hospital);
      if (item.department) meta.push(item.department);
      if (item.allDay) meta.push("全天");
      else if (item.startTime) meta.push(item.startTime);
      break;
    default:
      if (item.allDay) meta.push("全天");
      else if (item.startTime) meta.push(item.startTime);
      if (item.location) meta.push(item.location);
  }

  const showDateWarning =
    item.type !== "Payment" && !item.date;

  return (
    <>
      <p className="font-semibold text-white leading-snug text-sm">
        {item.title || TYPE_LABEL[item.type]}
      </p>

      {item.type === "Shopping" && item.shoppingItems.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {item.shoppingItems.slice(0, 3).map((it, i) => (
            <li key={i} className="text-xs text-gray-400 flex gap-1">
              <span className="text-purple-400/60">·</span>
              <span>{it}</span>
            </li>
          ))}
          {item.shoppingItems.length > 3 && (
            <li className="text-xs text-gray-500">
              +{item.shoppingItems.length - 3} 項
            </li>
          )}
        </ul>
      )}

      {item.type === "Pending" && item.pendingText && (
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
          {item.pendingText}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 items-center">
        {showDateWarning ? (
          <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            ⚠ 尚未設定日期
          </span>
        ) : item.type !== "Payment" && item.date ? (
          <span className="text-xs text-gray-500">
            {item.date.replace(/-/g, "/")}
          </span>
        ) : null}

        {meta.map((m, i) => (
          <span key={i} className="text-xs text-gray-500">
            {m}
          </span>
        ))}
      </div>
    </>
  );
}

// ─── Type-specific editor fields ───────────────────────────────────────────────

interface EditorProps {
  draft: PreviewItem;
  setDraft: React.Dispatch<React.SetStateAction<PreviewItem>>;
}

function TypeSpecificEditor({ draft, setDraft }: EditorProps) {
  const [newItem, setNewItem] = useState("");

  const upd = (patch: Partial<PreviewItem>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const addShoppingItem = () => {
    const v = newItem.trim();
    if (!v) return;
    upd({ shoppingItems: [...draft.shoppingItems, v] });
    setNewItem("");
  };

  const removeShoppingItem = (i: number) =>
    upd({ shoppingItems: draft.shoppingItems.filter((_, idx) => idx !== i) });

  switch (draft.type) {
    case "Airport Transfer":
      return (
        <>
          <FormRow label="方向">
            <div className="flex gap-2 flex-wrap">
              {(["接機", "送機", "未指定"] as const).map((opt) => {
                const val = opt === "未指定" ? "" : opt;
                return (
                  <button key={opt} type="button" onClick={() => upd({ transferType: val })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      draft.transferType === val
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                    }`}>{opt}</button>
                );
              })}
            </div>
          </FormRow>
          <FormRow label="航班">
            <TextInput
              value={draft.flightNumber}
              onChange={(v) => upd({ flightNumber: v })}
              placeholder="如 CI173"
            />
          </FormRow>
          <FormRow label="地區">
            <TextInput
              value={draft.district}
              onChange={(v) => upd({ district: v })}
              placeholder="目的地或地區"
            />
          </FormRow>
          <FormRow label="車型">
            <TextInput
              value={draft.vehicleType}
              onChange={(v) => upd({ vehicleType: v })}
              placeholder="如 正七、廂型"
            />
          </FormRow>
        </>
      );

    case "Shopping":
      return (
        <FormRow label="品項">
          <div className="space-y-1.5">
            {draft.shoppingItems.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                  {it}
                </span>
                <button
                  type="button"
                  onClick={() => removeShoppingItem(i)}
                  className="text-gray-500 hover:text-red-400 transition-colors text-xs px-2 py-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addShoppingItem();
                  }
                }}
                placeholder="新增品項（按 Enter）"
                className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
              />
              <button
                type="button"
                onClick={addShoppingItem}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
              >
                新增
              </button>
            </div>
          </div>
        </FormRow>
      );

    case "Payment":
      return (
        <>
          <FormRow label="截止日期">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => upd({ date: e.target.value, dueDate: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              style={{ colorScheme: "dark" }}
            />
          </FormRow>
          <FormRow label="帳戶">
            <TextInput
              value={draft.account}
              onChange={(v) => upd({ account: v })}
              placeholder="帳戶或繳費方式（選填）"
            />
          </FormRow>
        </>
      );

    case "Medical":
      return (
        <>
          <FormRow label="醫院">
            <TextInput
              value={draft.hospital}
              onChange={(v) => upd({ hospital: v })}
              placeholder="醫院名稱"
            />
          </FormRow>
          <FormRow label="科別">
            <TextInput
              value={draft.department}
              onChange={(v) => upd({ department: v })}
              placeholder="科別"
            />
          </FormRow>
        </>
      );

    case "Income":
      return (
        <>
          <FormRow label="金額">
            <TextInput
              value={draft.amount}
              onChange={(v) => upd({ amount: v })}
              placeholder="收入金額（元）"
            />
          </FormRow>
          <FormRow label="來源">
            <TextInput
              value={draft.source}
              onChange={(v) => upd({ source: v })}
              placeholder="收入來源（選填）"
            />
          </FormRow>
        </>
      );

    case "Expense":
      return (
        <>
          <FormRow label="金額">
            <TextInput
              value={draft.amount}
              onChange={(v) => upd({ amount: v })}
              placeholder="支出金額（元）"
            />
          </FormRow>
          <FormRow label="商家">
            <TextInput
              value={draft.merchant}
              onChange={(v) => upd({ merchant: v })}
              placeholder="商家或地點（選填）"
            />
          </FormRow>
        </>
      );

    case "Pending":
      return (
        <FormRow label="內容">
          <TextInput
            value={draft.pendingText}
            onChange={(v) => upd({ pendingText: v, title: v || draft.title })}
            placeholder="原始文字"
            multiline
          />
        </FormRow>
      );

    default:
      return null;
  }
}

// ─── FinancialItemQuickAdd ───────────────────────────────────────────────────────

function FinancialItemQuickAdd({
  onAdd, onCancel,
}: {
  onAdd: (fi: FinancialItem) => void;
  onCancel: () => void;
}) {
  const [fiType,   setFiType]   = useState<"receivable"|"payable">("receivable");
  const [fiAmount, setFiAmount] = useState("");
  const [fiDate,   setFiDate]   = useState("");
  const [fiNote,   setFiNote]   = useState("");
  const canSave = parseFloat(fiAmount.replace(/,/g, "")) > 0;

  function handleAdd() {
    const amt = parseFloat(fiAmount.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) return;
    onAdd({
      id: crypto.randomUUID(),
      type: fiType,
      title: "",
      amount: amt,
      dueDate: fiDate || undefined,
      note: fiNote.trim() || undefined,
    });
  }

  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
      <div className="flex gap-2">
        {([["receivable","待收","bg-teal-500/20 text-teal-300 border-teal-500/40"],
           ["payable",  "待付","bg-rose-500/20 text-rose-300 border-rose-500/40"]] as const).map(([k,l,cls]) => (
          <button key={k} type="button" onClick={() => setFiType(k)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${fiType === k ? cls : "bg-white/5 text-gray-400 border-white/10"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
        <span className="text-gray-500 text-xs shrink-0">NT$</span>
        <input type="text" inputMode="decimal" value={fiAmount}
          onChange={(e) => setFiAmount(e.target.value)} placeholder="金額"
          className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-700" />
      </div>
      <input type="date" value={fiDate} onChange={(e) => setFiDate(e.target.value)}
        placeholder="截止日期（選填）"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
        style={{ colorScheme: "dark" }} />
      <input type="text" value={fiNote} onChange={(e) => setFiNote(e.target.value)}
        placeholder="備註（選填）"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none" />
      <div className="flex gap-2 pt-0.5">
        <button type="button" onClick={handleAdd} disabled={!canSave}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 transition-all">
          新增
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold">
          取消
        </button>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function PreviewItemCard({
  item,
  isEditing,
  onEdit,
  onClose,
  onChange,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<PreviewItem>(item);

  const upd = (patch: Partial<PreviewItem>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const handleEditClick = () => {
    setDraft(item);
    onEdit();
  };

  const [timeMode, setTimeMode] = useState<"allday" | "single" | "range">(() => {
    if (item.allDay) return "allday";
    if (item.endTime) return "range";
    return "single";
  });
  const [showAddFi, setShowAddFi] = useState(false);

  // ── WorkProfile switch protection ──────────────────────────────────────────
  const allProfiles = useMemo(() => getWorkProfiles(), []);
  const [pendingWPSwitch, setPendingWPSwitch] = useState<{ newId: string | undefined } | null>(null);

  const currentWP = allProfiles.find((p) => p.id === draft.workProfileId);
  const isAirportTemplate = currentWP?.templateType === "airport_transfer";

  function handleWorkProfileChange(newId: string | undefined) {
    const oldProfile = allProfiles.find((p) => p.id === draft.workProfileId);
    const newProfile = allProfiles.find((p) => p.id === newId);
    const wasAirport = oldProfile?.templateType === "airport_transfer";
    const willBeAirport = newProfile?.templateType === "airport_transfer";

    // Only confirm when leaving airport template AND there's data worth protecting
    if (wasAirport && !willBeAirport && draft.templateData?.airportTransfer) {
      setPendingWPSwitch({ newId });
      return;
    }
    upd({ workProfileId: newId });
  }

  const showTimeFields = !["Payment", "Shopping"].includes(draft.type);
  const showLocation   = !["Income", "Expense", "Payment", "Medical", "Airport Transfer"].includes(draft.type);

  // ── Display mode ────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div
        className={`rounded-xl border p-4 transition-all duration-150 ${typeBorderClass(item.type)}`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <TypeBadge type={item.type} />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleEditClick}
              className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
            >
              編輯
            </button>
            <button
              onClick={onDelete}
              className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors"
            >
              移除
            </button>
          </div>
        </div>
        <ItemDisplay item={item} />
      </div>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4 transition-all duration-150">
      <p className="text-xs font-semibold text-blue-400 mb-3">編輯事項</p>

      <div className="space-y-3">
        {/* Type selector */}
        <FormRow label="事項類型">
          <select
            value={draft.type}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                type: e.target.value as AllType,
                category: "",
              }))
            }
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
            style={{ colorScheme: "dark" }}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </FormRow>

        {/* Title (hidden for Airport Transfer since it derives title from transferType+flight) */}
        {draft.type !== "Airport Transfer" && (
          <FormRow label="標題">
            <TextInput
              value={draft.title}
              onChange={(v) => upd({ title: v })}
              placeholder="事項標題"
            />
          </FormRow>
        )}

        {/* 群組 */}
        <FormRow label="群組">
          <CategorySelect
            type={draft.type}
            value={draft.category}
            onChange={(v) => upd({ category: v })}
          />
        </FormRow>

        {/* Date (Payment has its own date row inside TypeSpecificEditor) */}
        {draft.type !== "Payment" && (
          <FormRow label="日期">
            <div className="space-y-2">
              <div className="flex gap-2">
                {(["single", "range"] as const).map((m) => (
                  <button key={m} type="button"
                    onClick={() => upd({ dateMode: m, ...(m === "single" ? { endDate: "" } : {}) })}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                      (draft.dateMode ?? "single") === m
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                    }`}>
                    {m === "single" ? "單日" : "日期區間"}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={normalizeDate(draft.date)}
                onChange={(e) => upd({ date: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                style={{ colorScheme: "dark" }}
              />
              {(draft.dateMode ?? "single") === "range" && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs shrink-0">～ 結束</span>
                  <input
                    type="date"
                    value={normalizeDate(draft.endDate ?? "")}
                    onChange={(e) => upd({ endDate: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
              )}
            </div>
          </FormRow>
        )}

        {/* Time — mode buttons + time pickers */}
        {showTimeFields && (
          <FormRow label="時間">
            <div className="space-y-2">
              <div className="flex gap-2">
                {(["allday", "single", "range"] as const).map((m) => (
                  <button key={m} type="button"
                    onClick={() => {
                      setTimeMode(m);
                      if (m === "allday")  upd({ allDay: true,  startTime: "", endTime: "" });
                      else if (m === "single") upd({ allDay: false, endTime: "" });
                      else upd({ allDay: false });
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                      timeMode === m
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
                    }`}>
                    {m === "allday" ? "全天" : m === "single" ? "單一時間" : "時間區間"}
                  </button>
                ))}
              </div>
              {timeMode === "single" && (
                <TimePicker value={draft.startTime} onChange={(v) => upd({ startTime: v })} />
              )}
              {timeMode === "range" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <TimePicker value={draft.startTime} onChange={(v) => upd({ startTime: v })} />
                  <span className="text-gray-500 text-xs shrink-0">～</span>
                  <TimePicker value={draft.endTime} onChange={(v) => upd({ endTime: v })} />
                </div>
              )}
            </div>
          </FormRow>
        )}

        {/* Location */}
        {showLocation && (
          <FormRow label="地點">
            <TextInput
              value={draft.location}
              onChange={(v) => upd({ location: v })}
              placeholder="地點（選填）"
            />
          </FormRow>
        )}

        {/* Reminder notifications */}
        <FormRow label="提醒">
          <ReminderEditor
            reminders={draft.reminders ?? []}
            onChange={(updated) => upd({ reminders: updated })}
            hasDate={draft.type === "Payment" ? !!draft.dueDate : !!draft.date}
            hasTime={showTimeFields ? !draft.allDay && !!draft.startTime : false}
          />
        </FormRow>

        {/* Work profile */}
        <FormRow label="工作">
          <div className="space-y-2">
            <WorkProfileSelect
              value={draft.workProfileId}
              onChange={handleWorkProfileChange}
              currentProfileId={draft.workProfileId}
            />
            {draft.workProfileId && (
              <WorkProfileSummary workProfileId={draft.workProfileId} />
            )}
          </div>
        </FormRow>

        {/* WorkProfile template-switch confirmation */}
        {pendingWPSwitch && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <p className="text-xs text-gray-300 leading-relaxed">
              切換工作後，目前的機場接送資料將不再顯示。
            </p>
            <p className="text-[11px] text-gray-500">（資料不會刪除，重新選回相同類型時可再次顯示）</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  upd({ workProfileId: pendingWPSwitch.newId });
                  setPendingWPSwitch(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
              >
                繼續切換
              </button>
              <button
                type="button"
                onClick={() => setPendingWPSwitch(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Airport transfer template (shown when linked WorkProfile is airport_transfer) */}
        {isAirportTemplate && !pendingWPSwitch && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-px bg-amber-500/15" />
              <span className="text-[10px] font-semibold text-amber-400/70 tracking-wider uppercase">
                機場接送資料
              </span>
              <div className="flex-1 h-px bg-amber-500/15" />
            </div>
            <AirportTransferTemplateFields
              value={draft.templateData?.airportTransfer ?? {}}
              onChange={(atd) =>
                upd({ templateData: { ...draft.templateData, airportTransfer: atd } })
              }
            />
          </div>
        )}

        {/* Type-specific fields — keyed by type so local state resets on type switch */}
        <TypeSpecificEditor
          key={draft.type}
          draft={draft}
          setDraft={setDraft}
        />

        {/* Notes */}
        <FormRow label="備註">
          <TextInput
            value={draft.notes}
            onChange={(v) => upd({ notes: v })}
            placeholder="備註（選填）"
            multiline
          />
        </FormRow>

        {/* Finance — FinancialItems only (Finance Records created after saving) */}
        {!["Pending", "Income", "Expense"].includes(draft.type) && (
          <FormRow label="收支">
            <div className="space-y-2">
              {(draft.financialItems ?? []).map((fi) => (
                <div key={fi.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/8">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${
                    fi.type === "receivable"
                      ? "bg-teal-500/15 text-teal-300 border-teal-500/25"
                      : "bg-rose-500/15 text-rose-300 border-rose-500/25"
                  }`}>
                    {fi.type === "receivable" ? "待收" : "待付"}
                  </span>
                  <span className="flex-1 text-sm text-white tabular-nums">NT$ {fi.amount.toLocaleString()}</span>
                  {fi.dueDate && <span className="text-xs text-gray-500">{fi.dueDate.replace(/-/g, "/")}</span>}
                  <button type="button"
                    onClick={() => upd({ financialItems: (draft.financialItems ?? []).filter((i) => i.id !== fi.id) })}
                    className="text-gray-500 hover:text-red-400 transition-colors text-xs px-1">✕</button>
                </div>
              ))}

              {showAddFi ? (
                <FinancialItemQuickAdd
                  onAdd={(fi) => {
                    upd({ financialItems: [...(draft.financialItems ?? []), fi] });
                    setShowAddFi(false);
                  }}
                  onCancel={() => setShowAddFi(false)}
                />
              ) : (
                <button type="button" onClick={() => setShowAddFi(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors py-1">
                  ＋ 新增款項
                </button>
              )}
            </div>
          </FormRow>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => { onChange(draft); onClose(); }}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            完成
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm transition-colors hover:text-white"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
