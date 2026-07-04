// ─── WorkProfile data model ────────────────────────────────────────────────────
//
// Upgrade path:
//   Replace localStorage calls with API fetch calls.
//   Keep function signatures identical so callers need zero changes.

export type WorkTemplateType = "general_work" | "airport_transfer";

// Custom field — available on ALL work types.
export interface CustomField {
  id: string;
  label: string;
  value: string;
}

// Long-term work data attached to a WorkProfile.
// NOT per-trip data (dates, flights, passengers → stored on Reminder.templateData).
//
// Fields are shared across work types to keep a single flat structure.
// UI decides which fields to show based on templateType.
export interface WorkProfileData {
  // ── General work ──
  companyName?: string;   // 公司／單位
  jobRole?: string;         // 職稱／工作角色
  workLocation?: string;    // 工作地點
  contactName?: string;     // 聯絡人
  contactPhone?: string;    // 聯絡電話

  // ── Airport transfer ──
  driverName?: string;      // 姓名
  driverPhone?: string;     // 電話
  vehiclePlate?: string;    // 車牌
  vehicleModel?: string;    // 車型
  vehicleSeats?: string;    // 座位數
  // companyName reused as 靠行公司 for airport_transfer

  // ── Shared ──
  customFields?: CustomField[];
}

export interface WorkProfile {
  id: string;
  name: string;
  templateType: WorkTemplateType;
  enabled: boolean;
  note: string;             // legacy — kept for backward compat; no longer shown in UI
  profileData?: WorkProfileData;
  createdAt: string;
  updatedAt: string;
}

// Kept for backward compat; no longer shown in UI.
export const WORK_TEMPLATE_LABELS: Record<WorkTemplateType, string> = {
  general_work:    "一般工作",
  airport_transfer: "機場接送",
};

// ─── Storage ──────────────────────────────────────────────────────────────────

export const WORK_PROFILE_STORAGE_KEY = "lifepilot_work_profiles_v1";

export function loadWorkProfiles(): WorkProfile[] {
  try {
    const raw = localStorage.getItem(WORK_PROFILE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkProfile[];
  } catch {
    return [];
  }
}

export function saveWorkProfiles(profiles: WorkProfile[]): void {
  localStorage.setItem(WORK_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getWorkProfiles(): WorkProfile[] {
  return loadWorkProfiles();
}

export function getWorkProfileById(id: string): WorkProfile | undefined {
  return loadWorkProfiles().find((p) => p.id === id);
}

export function createWorkProfile(
  data: Omit<WorkProfile, "id" | "createdAt" | "updatedAt">
): WorkProfile {
  const now = new Date().toISOString();
  const profile: WorkProfile = {
    id: `work_${crypto.randomUUID()}`,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const profiles = loadWorkProfiles();
  saveWorkProfiles([...profiles, profile]);
  return profile;
}

export function updateWorkProfile(
  id: string,
  patch: Partial<Omit<WorkProfile, "id" | "createdAt">>
): WorkProfile | null {
  const profiles = loadWorkProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const updated: WorkProfile = {
    ...profiles[idx],
    ...patch,
    id: profiles[idx].id,
    createdAt: profiles[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  profiles[idx] = updated;
  saveWorkProfiles(profiles);
  return updated;
}

export function deleteWorkProfile(id: string): boolean {
  const profiles = loadWorkProfiles();
  const next = profiles.filter((p) => p.id !== id);
  if (next.length === profiles.length) return false;
  saveWorkProfiles(next);
  return true;
}
