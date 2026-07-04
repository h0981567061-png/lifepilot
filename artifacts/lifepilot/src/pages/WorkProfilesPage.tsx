// ─── WorkProfilesPage ─────────────────────────────────────────────────────────
//
// Unified single-page add/edit flow.
// Work name + template-specific fields + custom fields + enabled toggle
// are all edited in one form. No separate "profile data" sub-page.

import { useState, useEffect } from "react";
import {
  type WorkProfile,
  type WorkProfileData,
  type WorkTemplateType,
  type CustomField,
  getWorkProfiles,
  createWorkProfile,
  updateWorkProfile,
  deleteWorkProfile,
} from "../workProfileStore";
import type { Reminder } from "../store";

// ─── TextInput helper ─────────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition-colors"
    />
  );
}

// ─── ToggleSwitch helper ─────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
        checked ? "bg-blue-600" : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function SectionDivider() {
  return <div className="h-px bg-white/5" />;
}

// ─── CustomFieldBlock ─────────────────────────────────────────────────────────
// One custom-field row: label input + value input + delete button.

function CustomFieldBlock({
  field,
  onChange,
  onDelete,
}: {
  field: CustomField;
  onChange: (patch: Partial<CustomField>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5">
      <div>
        <label className="block text-xs text-gray-500 mb-1 font-medium">
          欄位名稱
        </label>
        <TextInput
          value={field.label}
          onChange={(v) => onChange({ label: v })}
          placeholder=""
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1 font-medium">
          內容
        </label>
        <TextInput
          value={field.value}
          onChange={(v) => onChange({ value: v })}
          placeholder=""
        />
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="text-xs text-rose-400 hover:text-rose-300 transition-colors pt-0.5"
      >
        刪除此欄位
      </button>
    </div>
  );
}

// ─── WorkProfileEditForm ───────────────────────────────────────────────────────
// Shared by both "add" and "edit". Renders name, template-specific fields,
// custom fields, and the enabled toggle in one page.

interface SavePayload {
  name: string;
  templateType: WorkTemplateType;
  enabled: boolean;
  note: string;
  profileData: WorkProfileData;
}

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
  const isNew = !initialProfile;
  const templateType: WorkTemplateType =
    initialProfile?.templateType ?? "general_work";
  const isAirport = templateType === "airport_transfer";

  const [name, setName] = useState(initialProfile?.name ?? "");
  const [profileData, setProfileData] = useState<WorkProfileData>(
    initialProfile?.profileData ?? {}
  );
  const [customFields, setCustomFields] = useState<CustomField[]>(
    initialProfile?.profileData?.customFields ?? []
  );
  const [enabled, setEnabled] = useState(initialProfile?.enabled ?? true);

  const updData = (patch: Partial<WorkProfileData>) =>
    setProfileData((d) => ({ ...d, ...patch }));

  // ── custom-field ops ──
  const addCF = () =>
    setCustomFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "", value: "" },
    ]);

  const updCF = (id: string, patch: Partial<CustomField>) =>
    setCustomFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );

  const delCF = (id: string) =>
    setCustomFields((prev) => prev.filter((f) => f.id !== id));

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    const mergedData: WorkProfileData = {
      ...profileData,
      customFields: customFields.length > 0 ? customFields : undefined,
    };
    onSave({
      name: name.trim(),
      templateType,
      enabled,
      note: initialProfile?.note ?? "",
      profileData: mergedData,
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-5">
      {/* ── 1. Name ── */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 font-medium">
          工作名稱
        </label>
        <TextInput
          value={name}
          onChange={setName}
          placeholder="輸入工作名稱"
        />
      </div>

      <SectionDivider />

      {/* ── 2. Template-specific fields ── */}
      {isAirport ? (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            基本資料
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              姓名
            </label>
            <TextInput
              value={profileData.driverName ?? ""}
              onChange={(v) => updData({ driverName: v })}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              電話
            </label>
            <TextInput
              type="tel"
              value={profileData.driverPhone ?? ""}
              onChange={(v) => updData({ driverPhone: v })}
              placeholder=""
            />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">
            車輛資料
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              車牌
            </label>
            <TextInput
              value={profileData.vehiclePlate ?? ""}
              onChange={(v) => updData({ vehiclePlate: v })}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              車型
            </label>
            <TextInput
              value={profileData.vehicleModel ?? ""}
              onChange={(v) => updData({ vehicleModel: v })}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              座位數
            </label>
            <TextInput
              value={profileData.vehicleSeats ?? ""}
              onChange={(v) => updData({ vehicleSeats: v })}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              靠行公司
            </label>
            <TextInput
              value={profileData.companyName ?? ""}
              onChange={(v) => updData({ companyName: v })}
              placeholder=""
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              公司／單位
            </label>
            <TextInput
              value={profileData.companyName ?? ""}
              onChange={(v) => updData({ companyName: v })}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              職稱／工作角色
            </label>
            <TextInput
              value={profileData.jobRole ?? ""}
              onChange={(v) => updData({ jobRole: v })}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              工作地點
            </label>
            <TextInput
              value={profileData.workLocation ?? ""}
              onChange={(v) => updData({ workLocation: v })}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              聯絡人
            </label>
            <TextInput
              value={profileData.contactName ?? ""}
              onChange={(v) => updData({ contactName: v })}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
              聯絡電話
            </label>
            <TextInput
              type="tel"
              value={profileData.contactPhone ?? ""}
              onChange={(v) => updData({ contactPhone: v })}
              placeholder=""
            />
          </div>
        </div>
      )}

      <SectionDivider />

      {/* ── 3. Custom fields ── */}
      <div className="space-y-3">
        {customFields.map((cf) => (
          <CustomFieldBlock
            key={cf.id}
            field={cf}
            onChange={(patch) => updCF(cf.id, patch)}
            onDelete={() => delCF(cf.id)}
          />
        ))}
        <button
          type="button"
          onClick={addCF}
          className="w-full py-3 rounded-xl border border-dashed border-white/15 text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-base leading-none">＋</span>
          新增自訂欄位
        </button>
      </div>

      <SectionDivider />

      {/* ── 4. Enabled toggle (always AFTER all data fields) ── */}
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm text-white font-medium">啟用此工作</p>
          <p className="text-xs text-gray-500 mt-0.5">
            停用後仍保留工作與相關資料
          </p>
        </div>
        <ToggleSwitch checked={enabled} onChange={() => setEnabled(!enabled)} />
      </div>

      {/* ── 5. Buttons ── */}
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

// ─── WorkProfile Card ─────────────────────────────────────────────────────────

interface WorkCardProps {
  profile: WorkProfile;
  onEdit: () => void;
  onDelete: () => void;
}

function WorkCard({ profile, onEdit, onDelete }: WorkCardProps) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 transition-colors ${
        profile.enabled
          ? "border-white/10 bg-white/[0.04]"
          : "border-white/5 bg-white/[0.02] opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 border bg-blue-500/10 border-blue-500/20 text-blue-400">
          💼
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{profile.name}</p>
            {!profile.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 font-medium">
                已停用
              </span>
            )}
          </div>
          {profile.note && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
              {profile.note}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
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

// ─── Delete Confirm ───────────────────────────────────────────────────────────

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

// ─── Delete Blocked ───────────────────────────────────────────────────────────

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
          <span className="text-amber-300 font-semibold">{linkedCount}</span>{" "}
          個事項正在使用。
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
    mode.kind === "editing"
      ? profiles.find((p) => p.id === mode.id)
      : undefined;

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
        <h1 className="text-base font-semibold text-white">
          {mode.kind === "adding"
            ? "新增工作"
            : mode.kind === "editing" && editingProfile
            ? `編輯工作 — ${editingProfile.name}`
            : "我的工作"}
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-4">
        {/* Adding / Editing form */}
        {isFormMode && (
          <WorkProfileEditForm
            initialProfile={editingProfile}
            onSave={handleSave}
            onCancel={() => setMode({ kind: "list" })}
            saveLabel={mode.kind === "adding" ? "新增" : "儲存"}
          />
        )}

        {/* Profile list */}
        {mode.kind === "list" && profiles.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💼</p>
            <p className="text-gray-500 text-sm">尚未建立任何工作資料板</p>
            <p className="text-gray-600 text-xs mt-1">點擊下方按鈕新增第一個工作</p>
          </div>
        )}

        {mode.kind === "list" &&
          profiles.map((profile) => {
            return (
              <WorkCard
                key={profile.id}
                profile={profile}
                onEdit={() => setMode({ kind: "editing", id: profile.id })}
                onDelete={() => handleRequestDelete(profile.id)}
              />
            );
          })}

        {/* Delete / Block delete overlays (replace the card in-place) */}
        {mode.kind === "deleting" && (
          (() => {
            const p = profiles.find((pr) => pr.id === mode.id);
            return p ? (
              <DeleteConfirm
                key={p.id}
                profile={p}
                onConfirm={() => handleDelete(p.id)}
                onCancel={() => setMode({ kind: "list" })}
              />
            ) : null;
          })()
        )}

        {mode.kind === "block_delete" && (
          (() => {
            const p = profiles.find((pr) => pr.id === mode.id);
            return p ? (
              <DeleteBlocked
                key={p.id}
                profile={p}
                linkedCount={mode.linkedCount}
                onClose={() => setMode({ kind: "list" })}
              />
            ) : null;
          })()
        )}

        {/* Add button */}
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

        {/* Stats footer */}
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
