// ─── WorkProfilesPage ─────────────────────────────────────────────────────────
//
// Each work profile is organised into 4 sections:
//   1. 基本資料   — system-suggested fields for this work type
//   2. 自訂欄位   — user-added {label, value} pairs with clear 標題/內容 labels
//   3. 聯絡人/客戶 — contacts associated with this work
//   4. 啟用狀態   — enable/disable toggle
//
// Backward compat:
//   - legacyDataToFields converts old flat profileData → WorkField[]
//   - existing airport_transfer profiles are never broken

import { useState, useEffect } from "react";
import {
  type WorkProfile,
  type WorkField,
  type WorkTemplateType,
  type WorkProfileData,
  type WorkContact,
  type WorkContactType,
  type WorkContactField,
  WORK_CONTACT_TYPES,
  getWorkProfiles,
  createWorkProfile,
  updateWorkProfile,
  deleteWorkProfile,
  detectWorkType,
  getDefaultFields,
  WORK_TEMPLATE_LABELS,
} from "../workProfileStore";
import type { Reminder } from "../store";

// ─── Backward compat: legacy profileData → WorkField[] ────────────────────────

function legacyDataToFields(data: WorkProfileData, type: WorkTemplateType): WorkField[] {
  const make = (
    label: string, value: string, fieldType: "text" | "tel", sortOrder: number
  ): WorkField => ({
    id: crypto.randomUUID(), label, value: value ?? "", fieldType,
    sortOrder, source: "system_suggested", deletable: true,
  });
  const out: WorkField[] = [];
  if (type === "airport_transfer") {
    out.push(make("姓名",    data.driverName  ?? "", "text", 0));
    out.push(make("電話",    data.driverPhone ?? "", "tel",  1));
    out.push(make("車牌",    data.vehiclePlate ?? "", "text", 2));
    out.push(make("車型",    data.vehicleModel ?? "", "text", 3));
    out.push(make("座位數",  data.vehicleSeats ?? "", "text", 4));
    out.push(make("靠行公司",data.companyName  ?? "", "text", 5));
  } else {
    out.push(make("公司／單位",    data.companyName  ?? "", "text", 0));
    out.push(make("職稱／工作角色",data.jobRole      ?? "", "text", 1));
    out.push(make("工作地點",      data.workLocation ?? "", "text", 2));
    out.push(make("聯絡人",        data.contactName  ?? "", "text", 3));
    out.push(make("聯絡電話",      data.contactPhone ?? "", "tel",  4));
  }
  (data.customFields ?? []).forEach((cf, i) => {
    out.push({
      id: cf.id, label: cf.label, value: cf.value, fieldType: "text",
      sortOrder: 100 + i, source: "user_custom", deletable: true,
    });
  });
  return out;
}

function initFieldsForProfile(profile: WorkProfile): WorkField[] {
  if (profile.fields && profile.fields.length > 0) return [...profile.fields];
  if (profile.profileData) return legacyDataToFields(profile.profileData, profile.templateType);
  return getDefaultFields(profile.templateType);
}

// ─── Small shared UI atoms ────────────────────────────────────────────────────

function TextInput({
  value, onChange, placeholder = "", type = "text", className = "",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; className?: string;
}) {
  return (
    <input
      type={type} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition-colors ${className}`}
    />
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`inline-flex items-center w-12 h-6 rounded-full px-0.5 transition-colors duration-200 flex-shrink-0 ${checked ? "bg-blue-600" : "bg-gray-600"}`}
    >
      <span className={`inline-block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-[22px]" : "translate-x-0"}`} />
    </button>
  );
}

function Divider() { return <div className="h-px bg-white/5" />; }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
      {children}
    </p>
  );
}

// ─── SystemFieldRow ───────────────────────────────────────────────────────────
// For system_suggested fields: label is read-only text, value is editable.

function SystemFieldRow({
  field, isPendingDelete, onValueChange, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: {
  field: WorkField; isPendingDelete: boolean;
  onValueChange: (v: string) => void;
  onDeleteRequest: () => void; onDeleteConfirm: () => void; onDeleteCancel: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs text-gray-500 font-medium">{field.label}</span>
        <button type="button" onClick={onDeleteRequest} aria-label="刪除欄位"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
          ×
        </button>
      </div>
      <TextInput type={field.fieldType} value={field.value} onChange={onValueChange} />
      {isPendingDelete && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 space-y-2">
          <p className="text-xs text-rose-300 font-medium">確定要刪除「{field.label}」欄位？</p>
          <div className="flex gap-2">
            <button type="button" onClick={onDeleteConfirm}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors">確認刪除</button>
            <button type="button" onClick={onDeleteCancel}
              className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CustomFieldRow ───────────────────────────────────────────────────────────
// For user_custom fields: shows explicit "標題" and "內容" labels.
// Delete button in top-right removes the ENTIRE pair (label + value).

function CustomFieldRow({
  field, isPendingDelete, onValueChange, onLabelChange, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: {
  field: WorkField; isPendingDelete: boolean;
  onValueChange: (v: string) => void; onLabelChange: (v: string) => void;
  onDeleteRequest: () => void; onDeleteConfirm: () => void; onDeleteCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-[10px] text-gray-500 font-medium mb-1">標題</p>
            <TextInput
              value={field.label} onChange={onLabelChange}
              placeholder="欄位名稱（例：車行）" className="text-sm py-2.5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-medium mb-1">內容</p>
            <TextInput
              value={field.value} onChange={onValueChange}
              placeholder="欄位內容（例：慶賓）" className="text-sm py-2.5" />
          </div>
        </div>
        <button type="button" onClick={onDeleteRequest} aria-label="刪除此欄位"
          className="mt-0.5 shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
          ×
        </button>
      </div>
      {isPendingDelete && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2.5 space-y-2">
          <p className="text-xs text-rose-300 font-medium">
            確定要刪除「{field.label || "此欄位"}」（含標題與內容）？
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onDeleteConfirm}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors">確認刪除</button>
            <button type="button" onClick={onDeleteCancel}
              className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ContactEditForm ──────────────────────────────────────────────────────────
// Inline form for adding or editing a single WorkContact.

function ContactEditForm({
  contact, onSave, onCancel,
}: {
  contact: WorkContact | null;   // null = new contact
  onSave: (c: WorkContact) => void;
  onCancel: () => void;
}) {
  const [ctype,    setCtype]   = useState<WorkContactType>(contact?.type    ?? "聯絡人");
  const [name,     setName]    = useState(contact?.name     ?? "");
  const [company,  setCompany] = useState(contact?.company  ?? "");
  const [role,     setRole]    = useState(contact?.role     ?? "");
  const [phone,    setPhone]   = useState(contact?.phone    ?? "");
  const [address,  setAddress] = useState(contact?.address  ?? "");
  const [note,     setNote]    = useState(contact?.note     ?? "");
  const [cfItems,  setCfItems] = useState<WorkContactField[]>(contact?.customFields ?? []);

  function addCf() {
    setCfItems(prev => [...prev, { id: crypto.randomUUID(), label: "", value: "" }]);
  }
  function removeCf(id: string) {
    setCfItems(prev => prev.filter(cf => cf.id !== id));
  }
  function updateCf(id: string, patch: Partial<WorkContactField>) {
    setCfItems(prev => prev.map(cf => cf.id === id ? { ...cf, ...patch } : cf));
  }

  function handleSave() {
    const now = new Date().toISOString();
    onSave({
      id: contact?.id ?? crypto.randomUUID(),
      type: ctype, name: name.trim(), company: company.trim() || undefined,
      role: role.trim() || undefined, phone: phone.trim() || undefined,
      address: address.trim() || undefined, note: note.trim() || undefined,
      customFields: cfItems.filter(cf => cf.label.trim() || cf.value.trim()),
      createdAt: contact?.createdAt ?? now,
    });
  }

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-300">
          {contact ? "編輯聯絡人" : "新增聯絡人"}
        </p>
        <button type="button" onClick={onCancel}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 transition-colors text-sm">
          ×
        </button>
      </div>

      {/* 類型 */}
      <div>
        <p className="text-[10px] text-gray-500 font-medium mb-1.5">類型</p>
        <div className="flex flex-wrap gap-1.5">
          {WORK_CONTACT_TYPES.map(t => (
            <button key={t} type="button" onClick={() => setCtype(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                ctype === t
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 姓名 */}
      <div>
        <p className="text-[10px] text-gray-500 font-medium mb-1">姓名／名稱</p>
        <TextInput value={name} onChange={setName} placeholder="王小明" />
      </div>

      {/* 公司 + 職稱 — side by side on wider screens */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-gray-500 font-medium mb-1">公司／單位</p>
          <TextInput value={company} onChange={setCompany} placeholder="XX 公司" className="text-sm py-2.5" />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 font-medium mb-1">職稱／角色</p>
          <TextInput value={role} onChange={setRole} placeholder="業務窗口" className="text-sm py-2.5" />
        </div>
      </div>

      {/* 電話 */}
      <div>
        <p className="text-[10px] text-gray-500 font-medium mb-1">電話</p>
        <TextInput type="tel" value={phone} onChange={setPhone} placeholder="0912-345-678" />
      </div>

      {/* 地址 */}
      <div>
        <p className="text-[10px] text-gray-500 font-medium mb-1">地址</p>
        <TextInput value={address} onChange={setAddress} placeholder="地址（選填）" />
      </div>

      {/* 備註 */}
      <div>
        <p className="text-[10px] text-gray-500 font-medium mb-1">備註</p>
        <TextInput value={note} onChange={setNote} placeholder="備註（選填）" />
      </div>

      {/* 聯絡人自訂欄位 */}
      {cfItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 font-medium">自訂欄位</p>
          {cfItems.map(cf => (
            <div key={cf.id} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-600 mb-1">標題</p>
                    <TextInput value={cf.label} onChange={v => updateCf(cf.id, { label: v })}
                      placeholder="標題" className="text-xs py-2" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 mb-1">內容</p>
                    <TextInput value={cf.value} onChange={v => updateCf(cf.id, { value: v })}
                      placeholder="內容" className="text-xs py-2" />
                  </div>
                </div>
                <button type="button" onClick={() => removeCf(cf.id)}
                  className="mt-4 w-6 h-6 flex items-center justify-center rounded-md text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-sm">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={addCf}
        className="w-full py-2 rounded-lg border border-dashed border-white/10 text-xs text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors">
        ＋ 新增自訂欄位
      </button>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleSave}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors">
          儲存聯絡人
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
          取消
        </button>
      </div>
    </div>
  );
}

// ─── ContactCard ──────────────────────────────────────────────────────────────

function ContactCard({
  contact, onEdit, onDelete,
}: {
  contact: WorkContact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-gray-400 font-medium shrink-0">
              {contact.type}
            </span>
            <span className="text-sm font-semibold text-white truncate">
              {contact.name || "（未填姓名）"}
            </span>
          </div>
          {contact.company && (
            <p className="text-xs text-gray-500 truncate">{contact.company}{contact.role ? ` · ${contact.role}` : ""}</p>
          )}
          {contact.phone && (
            <p className="text-xs text-gray-400 mt-0.5 tabular-nums">{contact.phone}</p>
          )}
          {contact.note && (
            <p className="text-xs text-gray-600 mt-0.5 truncate">{contact.note}</p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0 mt-0.5">
          <button type="button" onClick={onEdit}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors">
            編輯
          </button>
          <button type="button" onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WorkProfileEditForm ───────────────────────────────────────────────────────

type SavePayload = Omit<WorkProfile, "id" | "createdAt" | "updatedAt">;

interface WorkProfileEditFormProps {
  initialProfile?: WorkProfile;
  onSave: (payload: SavePayload) => void;
  onCancel: () => void;
  saveLabel: string;
}

function WorkProfileEditForm({ initialProfile, onSave, onCancel, saveLabel }: WorkProfileEditFormProps) {
  const isEdit = !!initialProfile;

  const [name,              setName]             = useState(initialProfile?.name ?? "");
  const [confirmedType,     setConfirmedType]    = useState<WorkTemplateType>(initialProfile?.templateType ?? "general_work");
  const [formatSuggestion,  setFormatSuggestion] = useState<WorkTemplateType | null>(null);
  const [suggestionResolved,setSuggResolved]     = useState(false);
  const [fields,            setFields]           = useState<WorkField[]>(() =>
    initialProfile ? initFieldsForProfile(initialProfile) : getDefaultFields("general_work")
  );
  const [enabled,           setEnabled]          = useState(initialProfile?.enabled ?? true);
  const [pendingDeleteId,   setPendingDeleteId]  = useState<string | null>(null);

  // ── Contacts ──
  const [contacts,      setContacts]   = useState<WorkContact[]>(initialProfile?.contacts ?? []);
  const [contactEdit,   setContactEdit] = useState<{
    mode: "add" | "edit";
    contact: WorkContact | null;
  } | null>(null);
  const [contactDeleteId, setContactDeleteId] = useState<string | null>(null);

  // ── Name → format detection (new profiles only) ──
  function handleNameChange(v: string) {
    setName(v);
    if (isEdit || suggestionResolved) return;
    const suggested = detectWorkType(v);
    if (suggested !== "general_work" && suggested !== confirmedType) {
      setFormatSuggestion(suggested);
    } else {
      setFormatSuggestion(null);
    }
  }

  function handleAcceptFormat() {
    if (!formatSuggestion) return;
    setConfirmedType(formatSuggestion);
    const customFs = fields.filter(f => f.source === "user_custom");
    setFields([...getDefaultFields(formatSuggestion), ...customFs]);
    setFormatSuggestion(null);
    setSuggResolved(true);
  }

  function handleDeclineFormat() {
    setFormatSuggestion(null);
    setSuggResolved(true);
  }

  // ── Field mutations ──
  const updField = (id: string, patch: Partial<WorkField>) =>
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  function handleDeleteRequest(id: string) {
    const f = fields.find(x => x.id === id);
    if (!f) return;
    if (!f.value.trim() && (!f.label.trim() || f.source === "system_suggested")) {
      setFields(prev => prev.filter(x => x.id !== id));
      if (pendingDeleteId === id) setPendingDeleteId(null);
    } else {
      setPendingDeleteId(id);
    }
  }

  function handleDeleteConfirm() {
    if (!pendingDeleteId) return;
    setFields(prev => prev.filter(f => f.id !== pendingDeleteId));
    setPendingDeleteId(null);
  }

  function addCustomField() {
    const maxOrder = fields.reduce((m, f) => Math.max(m, f.sortOrder), -1);
    setFields(prev => [...prev, {
      id: crypto.randomUUID(), label: "", value: "", fieldType: "text",
      sortOrder: maxOrder + 1, source: "user_custom", deletable: true,
    }]);
  }

  // ── Contact mutations ──
  function handleContactSave(saved: WorkContact) {
    if (contactEdit?.mode === "edit") {
      setContacts(prev => prev.map(c => c.id === saved.id ? saved : c));
    } else {
      // Duplicate phone check
      if (saved.phone) {
        const dup = contacts.find(c => c.id !== saved.id && c.phone === saved.phone);
        if (dup) {
          // Simple warning — just save anyway since full dedup UI is a future feature
          // The user was already creating this contact, so just save.
        }
      }
      setContacts(prev => [...prev, saved]);
    }
    setContactEdit(null);
  }

  function handleContactDelete(id: string) {
    setContacts(prev => prev.filter(c => c.id !== id));
    setContactDeleteId(null);
  }

  // ── Save ──
  function handleSave() {
    const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
    const templateType: WorkTemplateType = isEdit
      ? (initialProfile?.templateType ?? "general_work")
      : confirmedType;
    onSave({
      name: name.trim(),
      templateType,
      enabled,
      note: initialProfile?.note ?? "",
      fields: sorted,
      profileData: initialProfile?.profileData,
      contacts,
    });
  }

  const canSave = name.trim().length > 0;
  const systemFields = [...fields]
    .filter(f => f.source === "system_suggested")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const customFields = [...fields]
    .filter(f => f.source === "user_custom")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-5">

      {/* ── 工作名稱 ── */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 font-medium">工作名稱</label>
        <TextInput value={name} onChange={handleNameChange} placeholder="輸入工作名稱" />
      </div>

      {/* ── Format suggestion banner (new only) ── */}
      {!isEdit && formatSuggestion && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-1">
              偵測到這可能是{WORK_TEMPLATE_LABELS[formatSuggestion]}工作
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              是否使用{WORK_TEMPLATE_LABELS[formatSuggestion]}專屬格式？
              <br /><span className="text-gray-600">確認後可再自行調整欄位。</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAcceptFormat}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors">
              使用專屬格式
            </button>
            <button type="button" onClick={handleDeclineFormat}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              保持一般格式
            </button>
          </div>
        </div>
      )}

      <Divider />

      {/* ── 1. 基本資料 ── */}
      <div className="space-y-4">
        <SectionLabel>基本資料</SectionLabel>
        {systemFields.length === 0 && (
          <p className="text-xs text-gray-600">（無基本欄位）</p>
        )}
        {systemFields.map(field => (
          <SystemFieldRow
            key={field.id} field={field}
            isPendingDelete={pendingDeleteId === field.id}
            onValueChange={v => updField(field.id, { value: v })}
            onDeleteRequest={() => handleDeleteRequest(field.id)}
            onDeleteConfirm={handleDeleteConfirm}
            onDeleteCancel={() => setPendingDeleteId(null)}
          />
        ))}
      </div>

      <Divider />

      {/* ── 2. 自訂欄位 ── */}
      <div className="space-y-3">
        <SectionLabel>自訂欄位</SectionLabel>
        {customFields.length === 0 && (
          <p className="text-xs text-gray-600">（尚未新增自訂欄位）</p>
        )}
        {customFields.map(field => (
          <CustomFieldRow
            key={field.id} field={field}
            isPendingDelete={pendingDeleteId === field.id}
            onValueChange={v => updField(field.id, { value: v })}
            onLabelChange={v => updField(field.id, { label: v })}
            onDeleteRequest={() => handleDeleteRequest(field.id)}
            onDeleteConfirm={handleDeleteConfirm}
            onDeleteCancel={() => setPendingDeleteId(null)}
          />
        ))}
        <button type="button" onClick={addCustomField}
          className="w-full py-3 rounded-xl border border-dashed border-white/15 text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2">
          <span className="text-base leading-none">＋</span>
          新增自訂欄位
        </button>
      </div>

      <Divider />

      {/* ── 3. 聯絡人／客戶 ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>聯絡人／客戶</SectionLabel>
          {contacts.length > 0 && (
            <span className="text-[10px] text-gray-600">{contacts.length} 筆</span>
          )}
        </div>

        {/* Contact list */}
        {contacts.map(contact => (
          contactDeleteId === contact.id ? (
            <div key={contact.id} className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-2">
              <p className="text-xs text-rose-300">確定刪除「{contact.name || "此聯絡人"}」？</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleContactDelete(contact.id)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors">確認刪除</button>
                <button type="button" onClick={() => setContactDeleteId(null)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">取消</button>
              </div>
            </div>
          ) : contactEdit?.mode === "edit" && contactEdit.contact?.id === contact.id ? (
            <ContactEditForm
              key={contact.id}
              contact={contact}
              onSave={handleContactSave}
              onCancel={() => setContactEdit(null)}
            />
          ) : (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={() => setContactEdit({ mode: "edit", contact })}
              onDelete={() => setContactDeleteId(contact.id)}
            />
          )
        ))}

        {/* Add contact form (inline) */}
        {contactEdit?.mode === "add" ? (
          <ContactEditForm
            contact={null}
            onSave={handleContactSave}
            onCancel={() => setContactEdit(null)}
          />
        ) : (
          <button type="button" onClick={() => setContactEdit({ mode: "add", contact: null })}
            className="w-full py-3 rounded-xl border border-dashed border-white/15 text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2">
            <span className="text-base leading-none">＋</span>
            新增聯絡人
          </button>
        )}
      </div>

      <Divider />

      {/* ── 4. 啟用狀態 ── */}
      <div className="flex items-center justify-between py-0.5">
        <div>
          <p className="text-sm text-white font-medium">啟用此工作</p>
          <p className="text-xs text-gray-500 mt-0.5">停用後仍保留工作與相關資料</p>
        </div>
        <ToggleSwitch checked={enabled} onChange={() => setEnabled(v => !v)} />
      </div>

      {/* ── 儲存 / 取消 ── */}
      <div className="flex gap-2 pt-1">
        <button type="button" disabled={!canSave} onClick={() => canSave && handleSave()}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {saveLabel}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
          取消
        </button>
      </div>
    </div>
  );
}

// ─── WorkCard ─────────────────────────────────────────────────────────────────
// Shows the work profile in list mode with a field value preview.

function WorkCard({
  profile, onEdit, onDelete,
}: {
  profile: WorkProfile; onEdit: () => void; onDelete: () => void;
}) {
  // Build a preview of filled fields (up to 3 system_suggested fields)
  const previewFields = ((): { label: string; value: string }[] => {
    const source = profile.fields ?? (profile.profileData
      ? legacyDataToFields(profile.profileData, profile.templateType)
      : []);
    return source
      .filter(f => f.value.trim() && f.source === "system_suggested")
      .slice(0, 3)
      .map(f => ({ label: f.label, value: f.value.trim() }));
  })();

  const contactCount = profile.contacts?.length ?? 0;
  const customCount  = (profile.fields ?? []).filter(f => f.source === "user_custom" && (f.label.trim() || f.value.trim())).length;

  return (
    <div className={`rounded-2xl border px-5 py-4 transition-colors ${
      profile.enabled ? "border-white/10 bg-white/[0.04]" : "border-white/5 bg-white/[0.02] opacity-60"
    }`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 border bg-blue-500/10 border-blue-500/20 text-blue-400">
          💼
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{profile.name}</p>
            {!profile.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 font-medium">已停用</span>
            )}
            {profile.templateType === "airport_transfer" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-medium">機場接送</span>
            )}
          </div>

          {/* Field preview */}
          {previewFields.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {previewFields.map(f => (
                <div key={f.label} className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[11px] text-gray-600 shrink-0 w-12 text-right">{f.label}</span>
                  <span className="text-xs text-gray-400 truncate">{f.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Counts row */}
          {(customCount > 0 || contactCount > 0) && (
            <div className="flex gap-3 mt-2">
              {customCount > 0 && (
                <span className="text-[10px] text-gray-600">{customCount} 個自訂欄位</span>
              )}
              {contactCount > 0 && (
                <span className="text-[10px] text-gray-600">{contactCount} 位聯絡人</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onEdit}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors">
          編輯
        </button>
        <button type="button" onClick={onDelete}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-rose-400 bg-rose-500/5 border border-rose-500/15 hover:bg-rose-500/10 transition-colors">
          刪除
        </button>
      </div>
    </div>
  );
}

// ─── DeleteConfirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ profile, onConfirm, onCancel }: { profile: WorkProfile; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">確定刪除這個工作資料板？</p>
        <p className="text-xs text-gray-500 mt-1">「{profile.name}」將被永久刪除，無法復原。</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors">確定刪除</button>
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">取消</button>
      </div>
    </div>
  );
}

// ─── DeleteBlocked ─────────────────────────────────────────────────────────────

function DeleteBlocked({ profile, linkedCount, onClose }: { profile: WorkProfile; linkedCount: number; onClose: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">無法刪除此工作資料板</p>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          此工作目前仍有{" "}
          <span className="text-amber-300 font-semibold">{linkedCount}</span> 個事項正在使用。
        </p>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">請先將相關事項改為其他工作，或設為「不指定工作」。</p>
        <p className="text-xs text-gray-600 mt-1">（工作名稱：{profile.name}）</p>
      </div>
      <button type="button" onClick={onClose}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors">
        知道了
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type UIMode =
  | { kind: "list" }
  | { kind: "adding" }
  | { kind: "editing"; id: string }
  | { kind: "deleting"; id: string }
  | { kind: "block_delete"; id: string; linkedCount: number };

interface Props {
  onClose: () => void;
  savedReminders: Reminder[];
}

export function WorkProfilesPage({ onClose, savedReminders }: Props) {
  const [profiles, setProfiles] = useState<WorkProfile[]>(() => getWorkProfiles());
  const [mode, setMode] = useState<UIMode>({ kind: "list" });

  const refresh = () => setProfiles(getWorkProfiles());

  useEffect(() => { refresh(); }, []);

  function handleSave(payload: SavePayload) {
    if (mode.kind === "editing") {
      updateWorkProfile(mode.id, payload);
    } else {
      createWorkProfile(payload);
    }
    refresh();
    setMode({ kind: "list" });
  }

  function handleDelete(id: string) {
    deleteWorkProfile(id);
    refresh();
    setMode({ kind: "list" });
  }

  function handleRequestDelete(profileId: string) {
    const linked = savedReminders.filter(r => r.workProfileId === profileId);
    if (linked.length > 0) {
      setMode({ kind: "block_delete", id: profileId, linkedCount: linked.length });
    } else {
      setMode({ kind: "deleting", id: profileId });
    }
  }

  const editingProfile = mode.kind === "editing" ? profiles.find(p => p.id === mode.id) : undefined;
  const isFormMode = mode.kind === "adding" || mode.kind === "editing";

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <button type="button"
          onClick={isFormMode ? () => setMode({ kind: "list" }) : onClose}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回
        </button>
        <h1 className="text-base font-semibold text-white truncate">
          {mode.kind === "adding"
            ? "新增工作"
            : mode.kind === "editing" && editingProfile
            ? `編輯 — ${editingProfile.name}`
            : "我的工作"}
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-4">
        {/* ── Add / Edit form ── */}
        {isFormMode && (
          <WorkProfileEditForm
            initialProfile={editingProfile}
            onSave={handleSave}
            onCancel={() => setMode({ kind: "list" })}
            saveLabel={mode.kind === "adding" ? "新增" : "儲存"}
          />
        )}

        {/* ── List mode ── */}
        {mode.kind === "list" && profiles.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💼</p>
            <p className="text-gray-500 text-sm">尚未建立任何工作資料板</p>
            <p className="text-gray-600 text-xs mt-1">點擊下方按鈕新增第一個工作</p>
          </div>
        )}

        {mode.kind === "list" && profiles.map(profile => (
          <WorkCard
            key={profile.id} profile={profile}
            onEdit={() => setMode({ kind: "editing", id: profile.id })}
            onDelete={() => handleRequestDelete(profile.id)}
          />
        ))}

        {/* ── Delete confirm ── */}
        {mode.kind === "deleting" && (() => {
          const p = profiles.find(x => x.id === mode.id);
          return p ? (
            <DeleteConfirm key={p.id} profile={p}
              onConfirm={() => handleDelete(p.id)}
              onCancel={() => setMode({ kind: "list" })} />
          ) : null;
        })()}

        {mode.kind === "block_delete" && (() => {
          const p = profiles.find(x => x.id === mode.id);
          return p ? (
            <DeleteBlocked key={p.id} profile={p} linkedCount={mode.linkedCount}
              onClose={() => setMode({ kind: "list" })} />
          ) : null;
        })()}

        {/* ── Add button ── */}
        {mode.kind === "list" && (
          <button type="button" onClick={() => setMode({ kind: "adding" })}
            className="w-full py-4 rounded-2xl border border-dashed border-white/15 text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2">
            <span className="text-base leading-none">＋</span>
            新增工作
          </button>
        )}

        {/* ── Stats ── */}
        {mode.kind === "list" && profiles.length > 0 && (
          <p className="text-xs text-gray-700 text-center pt-2">
            共 {profiles.length} 個工作資料板
            {profiles.filter(p => !p.enabled).length > 0 &&
              `，${profiles.filter(p => !p.enabled).length} 個已停用`}
          </p>
        )}
      </div>
    </div>
  );
}
