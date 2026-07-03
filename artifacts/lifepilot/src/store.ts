// ─── Persistent reminder store — backed by localStorage ──────────────────────
//
// Upgrade path to a real database:
//   1. Replace `loadReminders` with a fetch to GET /api/reminders
//   2. Replace `persist` with a fetch to PUT /api/reminders
//   3. Replace `deleteReminder` with DELETE /api/reminders/:id
//   4. Replace `toggleReminderComplete` with PATCH /api/reminders/:id
//   Keep the function signatures identical so callers need zero changes.

export type ReminderType =
  | "Course"
  | "Airport Transfer"
  | "Medical"
  | "Shopping"
  | "Payment"
  | "Pending";

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  completed: boolean;
  createdAt: string;
  // Airport Transfer
  flightNumber?: string;
  transferType?: string;
  district?: string;
  vehicleType?: string;
  price?: string;
  // Shopping
  shoppingItems?: string[];
  // Payment
  dueDate?: string;
  amount?: string;
  // Medical
  hospital?: string;
  department?: string;
}

const STORAGE_KEY = "lifepilot_reminders_v1";

export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Reminder[]) : [];
  } catch {
    return [];
  }
}

function persist(reminders: Reminder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function addReminders(newItems: Reminder[]): Reminder[] {
  const existing = loadReminders();
  const updated = [...existing, ...newItems];
  persist(updated);
  return updated;
}

export function deleteReminder(id: string): Reminder[] {
  const updated = loadReminders().filter((r) => r.id !== id);
  persist(updated);
  return updated;
}

export function toggleReminderComplete(id: string): Reminder[] {
  const updated = loadReminders().map((r) =>
    r.id === id ? { ...r, completed: !r.completed } : r
  );
  persist(updated);
  return updated;
}
