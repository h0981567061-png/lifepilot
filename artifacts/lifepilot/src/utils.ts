// ─── Shared utility functions ─────────────────────────────────────────────────

/**
 * Normalize a time string to "HH:mm" format.
 * Supports: "2115" (HHMM), "21:15", "9:00" → "09:00",
 *           "21點15分", "晚上9點15分"
 * Returns "" if the input cannot be reliably parsed — never guesses.
 */
export function normalizeTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim();

  // Already HH:mm (or H:mm)
  const hmMatch = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = parseInt(hmMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // Four-digit HHMM (e.g. "2115", "0900")
  if (/^\d{4}$/.test(s)) {
    const h = parseInt(s.slice(0, 2), 10);
    const m = parseInt(s.slice(2), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // Chinese AM/PM prefix: 下午3點15分, 晚上9點15分, 早上8點
  const ampmMatch = s.match(/([上下早晚][午晚]?)(\d{1,2})[點点時](\d{1,2})?分?/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[2], 10);
    const m = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
    const period = ampmMatch[1];
    if ((period === "下" || period === "晚") && h < 12) h += 12;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // Chinese time without AM/PM: "21點15分", "9點30分", "21點"
  const chiMatch = s.match(/^(\d{1,2})[點点時](\d{1,2})?分?$/);
  if (chiMatch) {
    const h = parseInt(chiMatch[1], 10);
    const m = chiMatch[2] ? parseInt(chiMatch[2], 10) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  return ""; // cannot parse reliably — do not guess
}

/**
 * Normalize a date string to "YYYY-MM-DD" format.
 * Supports: "YYYY-MM-DD" (pass-through), "YYYY/MM/DD", "M/D" or "MM/DD"
 * For M/D format, uses the current calendar year.
 * Returns the raw string unchanged if it cannot be parsed.
 */
export function normalizeDate(raw: string): string {
  if (!raw) return "";

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // YYYY/MM/DD
  const ymdSlash = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) {
    const m = parseInt(ymdSlash[2], 10);
    const d = parseInt(ymdSlash[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${ymdSlash[1]}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // M/D or MM/DD (no year — use current calendar year)
  const mdMatch = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return raw; // return as-is if cannot parse
}

/**
 * Format a YYYY-MM-DD string for user-facing display as "YYYY/MM/DD".
 * Legacy M/D strings are returned unchanged.
 */
export function formatDateDisplay(ymd: string): string {
  if (!ymd) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd.replace(/-/g, "/");
  return ymd;
}
