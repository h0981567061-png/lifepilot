// ─── WorkProfile data model ────────────────────────────────────────────────────
//
// Upgrade path:
//   Replace localStorage calls with API fetch calls.
//   Keep function signatures identical so callers need zero changes.

export type WorkTemplateType = "general_work" | "airport_transfer";

// ─── Dynamic field architecture ───────────────────────────────────────────────
// All work profile data is stored as WorkField[].
// `source` distinguishes system-suggested vs. user-created fields.
// `deletable` is always true for all fields (work name is NOT a WorkField).

export type WorkFieldSource = "system_suggested" | "user_custom";
export type WorkFieldType = "text" | "tel";

export interface WorkField {
  id: string;
  label: string;
  value: string;
  fieldType: WorkFieldType;
  sortOrder: number;
  source: WorkFieldSource;
  deletable: boolean;
}

// ─── Backward-compat: legacy flat profileData ─────────────────────────────────
// Still kept so existing LocalStorage data continues to load correctly.
// New saves write to WorkProfile.fields instead.

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface WorkProfileData {
  companyName?: string;
  jobRole?: string;
  workLocation?: string;
  contactName?: string;
  contactPhone?: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleSeats?: string;
  customFields?: CustomField[];
}

// ─── WorkProfile ──────────────────────────────────────────────────────────────

export interface WorkProfile {
  id: string;
  name: string;
  // templateType is the source-of-truth for airport_transfer capability.
  // Set at creation from detection; never re-derived from name at runtime.
  templateType: WorkTemplateType;
  enabled: boolean;
  note: string;
  // New primary storage — dynamic field list.
  fields?: WorkField[];
  // Legacy flat storage — kept for backward compat only.
  profileData?: WorkProfileData;
  createdAt: string;
  updatedAt: string;
}

// Kept for backward compat (WorkProfileSelect, etc.) — not shown in UI.
export const WORK_TEMPLATE_LABELS: Record<WorkTemplateType, string> = {
  general_work: "一般工作",
  airport_transfer: "機場接送",
};

// ─── Detection (used ONLY when creating a new profile) ────────────────────────
// Detects which field set to suggest based on the name the user typed.
// After creation, templateType is stored; this function is never called again
// for that profile — capability is always read from WorkProfile.templateType.

export const AIRPORT_TRANSFER_KEYWORDS = ["機場", "接送", "接機", "送機"];

export function detectWorkType(name: string): WorkTemplateType {
  const n = name.trim();
  if (AIRPORT_TRANSFER_KEYWORDS.some((kw) => n.includes(kw))) {
    return "airport_transfer";
  }
  return "general_work";
}

// ─── Default suggested fields per work type ───────────────────────────────────

function makeSuggestedField(
  label: string,
  fieldType: WorkFieldType,
  sortOrder: number
): WorkField {
  return {
    id: crypto.randomUUID(),
    label,
    value: "",
    fieldType,
    sortOrder,
    source: "system_suggested",
    deletable: true,
  };
}

export function getDefaultFields(type: WorkTemplateType): WorkField[] {
  if (type === "airport_transfer") {
    return [
      makeSuggestedField("姓名", "text", 0),
      makeSuggestedField("電話", "tel", 1),
      makeSuggestedField("車牌", "text", 2),
      makeSuggestedField("車型", "text", 3),
      makeSuggestedField("座位數", "text", 4),
      makeSuggestedField("靠行公司", "text", 5),
    ];
  }
  // general_work
  return [
    makeSuggestedField("公司／單位", "text", 0),
    makeSuggestedField("職稱／工作角色", "text", 1),
    makeSuggestedField("工作地點", "text", 2),
    makeSuggestedField("聯絡人", "text", 3),
    makeSuggestedField("聯絡電話", "tel", 4),
  ];
}

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
