// ─── WorkProfile data model ────────────────────────────────────────────────────
//
// Upgrade path:
//   Replace localStorage calls with API fetch calls.
//   Keep function signatures identical so callers need zero changes.

export type WorkTemplateType = "general_work" | "airport_transfer";

// Long-term personal/vehicle data attached to a WorkProfile.
// NOT per-trip data (flights, passengers, routes → stored on Reminder.templateData).
export interface WorkProfileData {
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleSeats?: string;
  companyName?: string;
}

export interface WorkProfile {
  id: string;
  name: string;
  templateType: WorkTemplateType;
  enabled: boolean;
  note: string;
  profileData?: WorkProfileData;
  createdAt: string;
  updatedAt: string;
}

export const WORK_TEMPLATE_LABELS: Record<WorkTemplateType, string> = {
  general_work:    "一般工作",
  airport_transfer: "機場接送",
};

export const ALL_WORK_TEMPLATES: WorkTemplateType[] = [
  "general_work",
  "airport_transfer",
];

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
