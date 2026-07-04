// ─── WorkProfilesPage ─────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import {
  type WorkProfile,
  type WorkProfileData,
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

// ─── WorkProfile Form ─────────────────────────────────────────────────────────
// templateType is intentionally NOT in FormState — new profiles default to
// "general_work"; existing profiles preserve their templateType on edit.

interface FormState {
  name: string;
  note: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  note: "",
  enabled: true,
};

function profileToForm(p: WorkProfile): FormState {
  return {
    name: p.name,
    note: p.note,
    enabled: p.enabled,
  };
}

interface WorkProfileFormProps {
  initial?: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  saveLabel?: string;
}

function WorkProfileForm({
  initial = EMPTY_FORM,
  onSave,
  onCancel,
  saveLabel = "儲存",
}: WorkProfileFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const canSave = form.name.trim().length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
      {/* 工作名稱 */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 font-medium">工作名稱</label>
        <TextInput
          value={form.name}
          onChange={(v) => upd({ name: v })}
          placeholder="例如：機場接送"
        />
      </div>

      {/* 備註 */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 font-medium">備註（選填）</label>
        <TextInput
          value={form.note}
          onChange={(v) => upd({ note: v })}
          placeholder="備註"
        />
      </div>

      {/* 啟用 */}
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm text-white font-medium">啟用此工作</p>
          <p className="text-xs text-gray-500 mt-0.5">停用後仍保留工作資料</p>
        </div>
        <button
          type="button"
          onClick={() => upd({ enabled: !form.enabled })}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
            form.enabled ? "bg-blue-600" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
              form.enabled ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => canSave && onSave(form)}
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
  onProfileData: () => void;
}

function WorkCard({ profile, onEdit, onDelete, onProfileData }: WorkCardProps) {
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
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{profile.note}</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
        {profile.enabled && (
          <button
            type="button"
            onClick={onProfileData}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            工作資料
          </button>
        )}
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

// ─── WorkProfile Data Form ─────────────────────────────────────────────────────
// Long-term driver & vehicle info — separate from per-trip Reminder data.

function WorkProfileDataForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: WorkProfile;
  onSave: (data: WorkProfileData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<WorkProfileData>(profile.profileData ?? {});
  const upd = (patch: Partial<WorkProfileData>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-5">
      {/* 基本資料 */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">基本資料</p>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">姓名</label>
          <TextInput
            value={form.driverName ?? ""}
            onChange={(v) => upd({ driverName: v })}
            placeholder="您的姓名"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">電話</label>
          <TextInput
            type="tel"
            value={form.driverPhone ?? ""}
            onChange={(v) => upd({ driverPhone: v })}
            placeholder="聯絡電話"
          />
        </div>
      </div>

      {/* 車輛資料 */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">車輛資料</p>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">車牌</label>
          <TextInput
            value={form.vehiclePlate ?? ""}
            onChange={(v) => upd({ vehiclePlate: v })}
            placeholder="例如 RFH-7077"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">車型</label>
          <TextInput
            value={form.vehicleModel ?? ""}
            onChange={(v) => upd({ vehicleModel: v })}
            placeholder="例如 CRV、Alphard"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">座位數</label>
          <TextInput
            value={form.vehicleSeats ?? ""}
            onChange={(v) => upd({ vehicleSeats: v })}
            placeholder="例如 5"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">靠行公司（選填）</label>
          <TextInput
            value={form.companyName ?? ""}
            onChange={(v) => upd({ companyName: v })}
            placeholder="靠行公司名稱"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          儲存
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
  | { kind: "block_delete"; id: string; linkedCount: number }
  | { kind: "profile_data"; id: string };

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

  function handleAdd(form: FormState) {
    createWorkProfile({
      name: form.name.trim(),
      templateType: "general_work",
      note: form.note.trim(),
      enabled: form.enabled,
    });
    refresh();
    setMode({ kind: "list" });
  }

  function handleEdit(id: string, form: FormState) {
    const existing = profiles.find((p) => p.id === id);
    updateWorkProfile(id, {
      name: form.name.trim(),
      // Preserve existing templateType — do not overwrite with UI-less default
      templateType: existing?.templateType ?? "general_work",
      note: form.note.trim(),
      enabled: form.enabled,
    });
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

  function handleSaveProfileData(id: string, data: WorkProfileData) {
    updateWorkProfile(id, { profileData: data });
    refresh();
    setMode({ kind: "list" });
  }

  // Derive header context for profile_data sub-page
  const profileDataProfile =
    mode.kind === "profile_data"
      ? profiles.find((p) => p.id === mode.id)
      : undefined;

  const isProfileDataMode = mode.kind === "profile_data";

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <button
          type="button"
          onClick={isProfileDataMode ? () => setMode({ kind: "list" }) : onClose}
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
          {isProfileDataMode && profileDataProfile
            ? `${profileDataProfile.name} — 工作資料`
            : "我的工作"}
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-4">

        {/* ── Profile data sub-page ── */}
        {isProfileDataMode && profileDataProfile && (
          <WorkProfileDataForm
            profile={profileDataProfile}
            onSave={(data) => handleSaveProfileData(profileDataProfile.id, data)}
            onCancel={() => setMode({ kind: "list" })}
          />
        )}

        {/* ── List mode ── */}
        {!isProfileDataMode && (
          <>
            {/* Adding form */}
            {mode.kind === "adding" && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-3">新增工作</p>
                <WorkProfileForm
                  onSave={handleAdd}
                  onCancel={() => setMode({ kind: "list" })}
                  saveLabel="新增"
                />
              </div>
            )}

            {/* Profile list */}
            {profiles.length === 0 && mode.kind !== "adding" && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">💼</p>
                <p className="text-gray-500 text-sm">尚未建立任何工作資料板</p>
                <p className="text-gray-600 text-xs mt-1">點擊下方按鈕新增第一個工作</p>
              </div>
            )}

            {profiles.map((profile) => {
              if (mode.kind === "editing" && mode.id === profile.id) {
                return (
                  <div key={profile.id}>
                    <p className="text-xs text-gray-500 font-medium mb-3">編輯工作</p>
                    <WorkProfileForm
                      initial={profileToForm(profile)}
                      onSave={(form) => handleEdit(profile.id, form)}
                      onCancel={() => setMode({ kind: "list" })}
                      saveLabel="儲存"
                    />
                  </div>
                );
              }

              if (mode.kind === "deleting" && mode.id === profile.id) {
                return (
                  <DeleteConfirm
                    key={profile.id}
                    profile={profile}
                    onConfirm={() => handleDelete(profile.id)}
                    onCancel={() => setMode({ kind: "list" })}
                  />
                );
              }

              if (mode.kind === "block_delete" && mode.id === profile.id) {
                return (
                  <DeleteBlocked
                    key={profile.id}
                    profile={profile}
                    linkedCount={mode.linkedCount}
                    onClose={() => setMode({ kind: "list" })}
                  />
                );
              }

              return (
                <WorkCard
                  key={profile.id}
                  profile={profile}
                  onEdit={() => setMode({ kind: "editing", id: profile.id })}
                  onDelete={() => handleRequestDelete(profile.id)}
                  onProfileData={() => setMode({ kind: "profile_data", id: profile.id })}
                />
              );
            })}

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
            {profiles.length > 0 && mode.kind === "list" && (
              <p className="text-xs text-gray-700 text-center pt-2">
                共 {profiles.length} 個工作資料板
                {profiles.filter((p) => !p.enabled).length > 0 &&
                  `，${profiles.filter((p) => !p.enabled).length} 個已停用`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
