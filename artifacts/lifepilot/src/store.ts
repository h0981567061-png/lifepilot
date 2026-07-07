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
  date: string;      // YYYY-MM-DD; for range this is the startDate
  dateMode?: "single" | "range"; // omitted = "single" (backward compat)
  endDate?: string;  // YYYY-MM-DD; only when dateMode="range"
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
  // Financial status (legacy — kept for backward compat; new data uses financialItems)
  financialStatus?: "none" | "receivable" | "payable";
  expectedAmount?: number;
  financialDueDate?: string;
  // Multi-item financial tracking (v2) — replaces single financialStatus
  financialItems?: FinancialItem[];
  // Work profile association (optional — old reminders without this field work normally)
  workProfileId?: string;
  // Contact associated with this reminder (references WorkContact.id within the linked work profile)
  contactId?: string;
  // Template data — stores per-trip data for WorkProfile-based templates
  templateData?: TemplateData;
}

// ─── Template Data ─────────────────────────────────────────────────────────────

export interface AirportTransferTemplateData {
  transferType?: "pickup" | "dropoff" | "charter" | "one_way";
  pickupLocation?: string;
  stops?: string[];
  destination?: string;
  flightNumber?: string;
  passengerName?: string;
  passengerPhone?: string;
  passengerCount?: number;
  luggage?: string;
  // Driver / dispatch fields (per-trip, set by AI or user)
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  orderCodes?: string[];      // e.g. ["AR87260623601O", "AB8830"]
  paymentMethod?: string;     // e.g. "信用卡"
  paymentCondition?: string;  // e.g. "不簽不收，客下後下週四轉帳"
}

export interface TemplateData {
  airportTransfer?: AirportTransferTemplateData;
}

// ─── Financial Item ───────────────────────────────────────────────────────────
// Represents a single expected payment/receivable linked to a Reminder.
// NOT a real Finance Record — those live in financeStore under FinanceEntry.

export interface FinancialItem {
  id: string;
  title: string;
  type: "receivable" | "payable";
  amount: number;          // positive, always
  dueDate?: string;        // YYYY-MM-DD, optional
  note?: string;
  completed?: boolean;     // future use — do NOT act on this yet
  completedDate?: string;  // future use
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

// ─── FinancialItem migration (legacy → v2) ────────────────────────────────────
// Converts old Reminders that stored money data in flat fields
// (amount / financialStatus / expectedAmount / financialDueDate)
// into the structured financialItems[] array.
// Version-gated so it never re-processes already-migrated records.

const MIGRATION_FI_KEY = "lifepilot_migration_fi_v1";

export function runFinancialItemMigration(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATION_FI_KEY) === "done") return;

  const reminders = loadReminders();
  let changed = false;

  const updated = reminders.map((r): Reminder => {
    // Already migrated — skip
    if (r.financialItems && r.financialItems.length > 0) return r;

    const items: FinancialItem[] = [];

    // Path 1: explicit financialStatus + expectedAmount
    if (
      (r.financialStatus === "receivable" || r.financialStatus === "payable") &&
      r.expectedAmount && r.expectedAmount > 0
    ) {
      items.push({
        id: `migrated-${r.id}-fs`,
        title: r.title || (r.financialStatus === "receivable" ? "待收款項" : "待付款項"),
        type: r.financialStatus,
        amount: r.expectedAmount,
        dueDate: r.financialDueDate || undefined,
      });

    // Path 2: Payment type with raw amount string
    } else if (!r.financialStatus && r.type === "Payment" && r.amount) {
      const n = parseFloat(String(r.amount).replace(/,/g, ""));
      if (!isNaN(n) && n > 0) {
        items.push({
          id: `migrated-${r.id}-pay`,
          title: r.title || "繳費",
          type: "payable",
          amount: n,
          dueDate: r.financialDueDate || r.dueDate || undefined,
        });
      }

    // Path 3: Airport Transfer with raw amount string
    } else if (!r.financialStatus && r.type === "Airport Transfer" && r.amount) {
      const n = parseFloat(String(r.amount).replace(/,/g, ""));
      if (!isNaN(n) && n > 0) {
        items.push({
          id: `migrated-${r.id}-air`,
          title: r.title || "接送費",
          type: "receivable",
          amount: n,
          dueDate: r.date || undefined,
        });
      }
    }

    if (items.length > 0) {
      changed = true;
      return { ...r, financialItems: items };
    }
    return r;
  });

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  localStorage.setItem(MIGRATION_FI_KEY, "done");
}
