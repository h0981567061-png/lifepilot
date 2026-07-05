// ─── WorkProfilesPage ─────────────────────────────────────────────────────────
//
// Dynamic field architecture for work profile creation and editing.
// All fields (system-suggested + custom) are stored as WorkField[].
// Work name → detection (new only) → suggested fields → editable/deletable
// → custom fields → enabled toggle → save.  Single page, no sub-pages.

import { useState, useEffect } from "react";
import {
  type WorkProfile,
  type WorkField,
  type WorkTemplateType,
  type WorkProfileData,
  getWorkProfiles,
  createWorkProfile,
  updateWorkProfile,
  deleteWorkProfile,
  detectWorkType,
  getDefaultFields,
  WORK_TEMPLATE_LABELS,
} from "../workProfileStore";
import type { Reminder } from "../store";

// ─── Helpers: convert legacy profileData → WorkField[] ───────────────────────
// Used when editing old profiles that predate the fields[] data model.

function legacyDataToFields(data: WorkProfileData, type: WorkTemplateType): WorkField[] {
  const make = (
    label: string,
    value: string,
    fieldType: "text" | "tel",
    sortOrder: number
  ): WorkField => ({
    id: crypto.randomUUID(),
    label,
    value: value ?? "",
    fieldType,
    sortOrder,
    source: "system_suggested",
    deletable: true,
  });

  const out: WorkField[] = [];

  if (type === "airport_transfer") {
    out.push(make("姓名", data.driverName ?? "", "text", 0));
    out.push(make("電話", data.driverPhone ?? "", "tel", 1));
    out.push(make("車牌", data.vehiclePlate ?? "", "text", 2));
    out.push(make("車型", data.vehicleModel ?? "", "text", 3));
    out.push(make("座位數", data.vehicleSeats ?? "", "text", 4));
    out.push(make("靠行公司", data.companyName ?? "", "text", 5));
  } else {
    out.push(make("公司／單位", data.companyName ?? "", "text", 0));
    out.push(make("職稱／工作角色", data.jobRole ?? "", "text", 1));
    out.push(make("工作地點", data.workLocation ?? "", "text", 2));
    out.push(make("聯絡人", data.contactName ?? "", "text", 3));
    out.push(make("聯絡電話", data.contactPhone ?? "", "tel", 4));
  }

  (data.customFields ?? []).forEach((cf, i) => {
    out.push({
      id: cf.id,
      label: cf.label,
      value: cf.value,
      fieldType: "text",
      sortOrder: 100 + i,
      source: "user_custom",
      deletable: true,
    });
  });

  return out;
}

function initFieldsForProfile(profile: WorkProfile): WorkField[] {
  if (profile.fields && profile.fields.length > 0) {
    return [...profile.fields];
  }
  if (profile.profileData) {
    return legacyDataToFields(profile.profileData, profile.templateType);
  }
  return getDefaultFields(profile.templateType);
}

// ─── Small UI components ──────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  placeholder = "",
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition-colors ${className}`}
    />
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`inline-flex items-center w-12 h-6 rounded-full px-0.5 transition-colors duration-200 flex-shrink-0 ${
        checked ? "bg-blue-600" : "bg-gray-600"
      }`}
    >
      <span
        className={`inline-block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-white/5" />;
}

// ─── DeleteBtn ────────────────────────────────────────────────────────────────

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="刪除欄位"
      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
    >
      ×
    </button>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────
// Renders one WorkField — label row + value input + optional delete confirm.

function FieldRow({
  field,
  isPendingDelete,
  onValueChange,
  onLabelChange,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  field: WorkField;
  isPendingDelete: boolean;
  onValueChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const isCustom = field.source === "user_custom";

  return (
    <div className="space-y-1.5">
      {/* Label row */}
      <div className="flex items-center gap-2">
        {isCustom ? (
          <TextInput
            value={field.label}
            onChange={onLabelChange}
            placeholder="欄位名稱"
            className="flex-1 text-xs py-2"
          />
        ) : (
          <span className="flex-1 text-xs text-gray-500 font-medium">{field.label}</span>
        )}
        <DeleteBtn onClick={onDeleteRequest} />
      </div>

      {/* Value input */}
      <TextInput
        type={field.fieldType}
        value={field.value}
        onChange={onValueChange}
        placeholder=""
      />

      {/* Delete confirmation inline */}
      {isPendingDelete && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 space-y-2">
          <p className="text-xs text-rose-300 font-medium">確定要刪除「{field.label}」欄位？</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDeleteConfirm}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors"
            >
              確認刪除
            </button>
            <button
              type="button"
              onClick={onDeleteCancel}
              className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WorkProfileEditForm ───────────────────────────────────────────────────────
// Unified add / edit form with dynamic field architecture.

type SavePayload = Omit<WorkProfile, "id" | "createdAt" | "updatedAt">;

interface WorkProfileEditFormProps {
  initialProfile?: WorkProfile;
  onSave: (payload: SavePayload) => void;
  onCancel: () => void;
  saveLabel: string;
}

function WorkProfileEditForm({
  initialProfile,
  onSave,
  onCancel,
  saveLabel,
}: WorkProfileEditFormProps) {
  const isEdit = !!initialProfile;

  // Name — drives detection for new profiles only
  const [name, setName] = useState(initialProfile?.name ?? "");

  // confirmedType: the actual format in use — only changed by explicit user action.
  // For edit: fixed to the existing templateType, never re-detected.
  // For new: starts as general_work; changed only when user clicks "使用專屬格式".
  const [confirmedType, setConfirmedType] = useState<WorkTemplateType>(
    initialProfile?.templateType ?? "general_work"
  );

  // formatSuggestion: non-null while a suggestion banner is pending (new profiles only).
  // Does NOT auto-apply; waits for user confirmation.
  const [formatSuggestion, setFormatSuggestion] = useState<WorkTemplateType | null>(null);

  // suggestionResolved: once the user accepts or declines, stop prompting for this session.
  const [suggestionResolved, setSuggestionResolved] = useState(false);

  // Dynamic fields — the core data list
  const [fields, setFields] = useState<WorkField[]>(() =>
    initialProfile ? initFieldsForProfile(initialProfile) : getDefaultFields("general_work")
  );

  const [enabled, setEnabled] = useState(initialProfile?.enabled ?? true);

  // ID of the field waiting for deletion confirmation; null = none
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // ── Name change: suggest format for NEW profiles only; never auto-apply ──
  function handleNameChange(v: string) {
    setName(v);
    if (isEdit) return;           // Edit mode: name never affects templateType
    if (suggestionResolved) return; // User already made a choice this session

    const suggested = detectWorkType(v);
    if (suggested !== "general_work" && suggested !== confirmedType) {
      // Detected a special format different from what's currently confirmed
      setFormatSuggestion(suggested);
    } else {
      // Name no longer suggests a special format → hide banner
      setFormatSuggestion(null);
    }
    // Fields are NOT touched here — only changed by explicit user confirmation.
  }

  // User clicks "使用專屬格式"
  function handleAcceptFormat() {
    if (!formatSuggestion) return;
    setConfirmedType(formatSuggestion);
    // Replace system_suggested fields with new format defaults; keep custom fields intact.
    const customFields = fields.filter((f) => f.source === "user_custom");
    const newDefaults = getDefaultFields(formatSuggestion);
    setFields([...newDefaults, ...customFields]);
    setFormatSuggestion(null);
    setSuggestionResolved(true);
  }

  // User clicks "保持一般格式"
  function handleDeclineFormat() {
    setFormatSuggestion(null);
    setSuggestionResolved(true);
    // confirmedType stays as general_work; fields unchanged
  }

  // ── Field mutations ──
  const updField = (id: string, patch: Partial<WorkField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  function handleDeleteRequest(id: string) {
    const f = fields.find((x) => x.id === id);
    if (!f) return;
    if (!f.value.trim()) {
      // Empty field — delete immediately
      setFields((prev) => prev.filter((x) => x.id !== id));
      if (pendingDeleteId === id) setPendingDeleteId(null);
    } else {
      // Filled field — ask confirmation
      setPendingDeleteId(id);
    }
  }

  function handleDeleteConfirm() {
    if (!pendingDeleteId) return;
    setFields((prev) => prev.filter((f) => f.id !== pendingDeleteId));
    setPendingDeleteId(null);
  }

  function addCustomField() {
    const maxOrder = fields.reduce((m, f) => Math.max(m, f.sortOrder), -1);
    setFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "",
        value: "",
        fieldType: "text",
        sortOrder: maxOrder + 1,
        source: "user_custom",
        deletable: true,
      },
    ]);
  }

  function handleSave() {
    const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
    // templateType source-of-truth:
    //   edit  → always the original initialProfile.templateType (name change never alters it)
    //   new   → confirmedType, which starts as general_work and only changes by user action
    const templateType: WorkTemplateType = isEdit
      ? (initialProfile?.templateType ?? "general_work")
      : confirmedType;

    onSave({
      name: name.trim(),
      templateType,
      enabled,
      note: initialProfile?.note ?? "",
      fields: sorted,
      // Preserve legacy profileData on edit so airport-transfer template still works
      profileData: initialProfile?.profileData,
    });
  }

  const canSave = name.trim().length > 0;
  const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-5">
      {/* ── 1. Work name (not deletable) ── */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 font-medium">工作名稱</label>
        <TextInput value={name} onChange={handleNameChange} placeholder="輸入工作名稱" />
      </div>

      {/* ── Format suggestion banner (new profiles only, non-blocking) ── */}
      {!isEdit && formatSuggestion && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-1">
              偵測到這可能是{WORK_TEMPLATE_LABELS[formatSuggestion]}工作
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              是否使用{WORK_TEMPLATE_LABELS[formatSuggestion]}專屬格式？
              <br />
              <span className="text-gray-600">專屬格式包含對應的建議欄位，確認後可再自行調整。</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAcceptFormat}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
            >
              使用專屬格式
            </button>
            <button
              type="button"
              onClick={handleDeclineFormat}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              保持一般格式
            </button>
          </div>
        </div>
      )}

      <Divider />

      {/* ── 2. Dynamic field list ── */}
      <div className="space-y-4">
        {sorted.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            isPendingDelete={pendingDeleteId === field.id}
            onValueChange={(v) => updField(field.id, { value: v })}
            onLabelChange={(v) => updField(field.id, { label: v })}
            onDeleteRequest={() => handleDeleteRequest(field.id)}
            onDeleteConfirm={handleDeleteConfirm}
            onDeleteCancel={() => setPendingDeleteId(null)}
          />
        ))}

        {/* Add custom field button */}
        <button
          type="button"
          onClick={addCustomField}
          className="w-full py-3 rounded-xl border border-dashed border-white/15 text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-base leading-none">＋</span>
          新增自訂欄位
        </button>
      </div>

      <Divider />

      {/* ── 3. Enabled toggle (always AFTER all data fields) ── */}
      <div className="flex items-center justify-between py-0.5">
        <div>
          <p className="text-sm text-white font-medium">啟用此工作</p>
          <p className="text-xs text-gray-500 mt-0.5">停用後仍保留工作與相關資料</p>
        </div>
        <ToggleSwitch checked={enabled} onChange={() => setEnabled((v) => !v)} />
      </div>

      {/* ── 4. Action buttons ── */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => canSave && handleSave()}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ─── WorkCard ─────────────────────────────────────────────────────────────────

function WorkCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: WorkProfile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 transition-colors ${
        profile.enabled
          ? "border-white/10 bg-white/[0.04]"
          : "border-white/5 bg-white/[0.02] opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 border bg-blue-500/10 border-blue-500/20 text-blue-400">
          💼
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{profile.name}</p>
            {!profile.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 font-medium">
                已停用
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors"
        >
          編輯
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-rose-400 bg-rose-500/5 border border-rose-500/15 hover:bg-rose-500/10 transition-colors"
        >
          刪除
        </button>
      </div>
    </div>
  );
}

// ─── DeleteConfirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  profile,
  onConfirm,
  onCancel,
}: {
  profile: WorkProfile;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">確定刪除這個工作資料板？</p>
        <p className="text-xs text-gray-500 mt-1">
          「{profile.name}」將被永久刪除，無法復原。
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors"
        >
          確定刪除
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ─── DeleteBlocked ────────────────────────────────────────────────────────────

function DeleteBlocked({
  profile,
  linkedCount,
  onClose,
}: {
  profile: WorkProfile;
  linkedCount: number;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">無法刪除此工作資料板</p>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          此工作目前仍有{" "}
          <span className="text-amber-300 font-semibold">{linkedCount}</span> 個事項正在使用。
        </p>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
          請先將相關事項改為其他工作，或設為「不指定工作」。
        </p>
        <p className="text-xs text-gray-600 mt-1">（工作名稱：{profile.name}）</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
      >
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

  useEffect(() => {
    refresh();
  }, []);

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
    const linked = savedReminders.filter((r) => r.workProfileId === profileId);
    if (linked.length > 0) {
      setMode({ kind: "block_delete", id: profileId, linkedCount: linked.length });
    } else {
      setMode({ kind: "deleting", id: profileId });
    }
  }

  const editingProfile =
    mode.kind === "editing" ? profiles.find((p) => p.id === mode.id) : undefined;

  const isFormMode = mode.kind === "adding" || mode.kind === "editing";

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <button
          type="button"
          onClick={isFormMode ? () => setMode({ kind: "list" }) : onClose}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 4L6 8l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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

        {mode.kind === "list" &&
          profiles.map((profile) => (
            <WorkCard
              key={profile.id}
              profile={profile}
              onEdit={() => setMode({ kind: "editing", id: profile.id })}
              onDelete={() => handleRequestDelete(profile.id)}
            />
          ))}

        {/* ── Delete confirm (overlays list) ── */}
        {mode.kind === "deleting" &&
          (() => {
            const p = profiles.find((x) => x.id === mode.id);
            return p ? (
              <DeleteConfirm
                key={p.id}
                profile={p}
                onConfirm={() => handleDelete(p.id)}
                onCancel={() => setMode({ kind: "list" })}
              />
            ) : null;
          })()}

        {mode.kind === "block_delete" &&
          (() => {
            const p = profiles.find((x) => x.id === mode.id);
            return p ? (
              <DeleteBlocked
                key={p.id}
                profile={p}
                linkedCount={mode.linkedCount}
                onClose={() => setMode({ kind: "list" })}
              />
            ) : null;
          })()}

        {/* ── Add button ── */}
        {mode.kind === "list" && (
          <button
            type="button"
            onClick={() => setMode({ kind: "adding" })}
            className="w-full py-4 rounded-2xl border border-dashed border-white/15 text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-base leading-none">＋</span>
            新增工作
          </button>
        )}

        {/* ── Stats ── */}
        {mode.kind === "list" && profiles.length > 0 && (
          <p className="text-xs text-gray-700 text-center pt-2">
            共 {profiles.length} 個工作資料板
            {profiles.filter((p) => !p.enabled).length > 0 &&
              `，${profiles.filter((p) => !p.enabled).length} 個已停用`}
          </p>
        )}
      </div>
    </div>
  );
}
