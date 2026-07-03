// ─── Persistent reminder store — backed by localStorage ──────────────────────
//
// Upgrade path to a real database:
//   1. Replace `loadReminders` with a fetch to GET /api/reminders
//   2. Replace `persist` with a fetch to PUT /api/reminders
//   3. Replace `deleteReminder` with DELETE /api/reminders/:id
//   4. Replace `toggleReminderComplete` with PATCH /api/reminders/:id
//   Keep the function signatures identical so callers need zero changes.

// ─── Reminder Notification ───────────────────────────────────────────────────

export type ReminderNotificationKind =
  | "at-time"
  | "before-10m"
  | "before-30m"
  | "before-1h"
  | "before-2h"
  | "day-before"
  | "custom";

export interface ReminderNotification {
  id: string;
  kind: ReminderNotificationKind;
  /** HH:MM — only for kind="day-before" */
  dayBeforeTime?: string;
  /** only for kind="custom" */
  customDays?: number;
  customHours?: number;
  customMinutes?: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export type ReminderType =
  | "Course"
  | "Airport Transfer"
  | "Medical"
  | "Shopping"
  | "Payment"
  | "Income"
  | "Expense"
  | "Work"
  | "Family"
  | "General"
  | "Pending";

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  location: string;
  notes: string;
  completed: boolean;
  createdAt: string;
  // Category (separate from type — for filtering/statistics)
  category?: string;
  // Airport Transfer
  flightNumber?: string;
  transferType?: string;
  district?: string;
  vehicleType?: string;
  price?: string;
  // Shopping
  shoppingItems?: string[];
  // Payment / Expense / Income
  dueDate?: string;
  amount?: string;
  account?: string;
  // Medical
  hospital?: string;
  department?: string;
  // Income
  source?: string;
  // Expense
  merchant?: string;
  // Legacy reminder settings (kept for backward compat — do not delete)
  reminderEnabled?: boolean;
  calendarEnabled?: boolean;
  sameDayReminder?: boolean;
  dayBeforeReminder?: boolean;
  hoursBeforeReminder?: number | null;
  // New: structured reminder notifications (v2)
  reminders?: ReminderNotification[];
  // Financial status (optional — does not affect Finance Store statistics)
  financialStatus?: "none" | "receivable" | "payable";
  expectedAmount?: number;      // stored as number
  financialDueDate?: string;    // YYYY-MM-DD, optional
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

export function updateReminder(id: string, patch: Partial<Reminder>): Reminder[] {
  const updated = loadReminders().map((r) =>
    r.id === id ? { ...r, ...patch } : r
  );
  persist(updated);
  return updated;
}
