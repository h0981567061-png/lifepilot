import { useState } from "react";
import { parseWithAI, type AIEvent } from "./aiParser";
import type { PreviewItem } from "./previewTypes";
import { TYPE_LABEL, emptyPreviewItem } from "./previewTypes";
import { PreviewItemCard } from "./components/PreviewItemCard";
import { normalizeTime, normalizeDate } from "./utils";
import {
  addReminders,
  deleteReminder,
  loadReminders,
  toggleReminderComplete,
  updateReminder,
  type Reminder,
} from "./store";
import { RemindersPage }          from "./pages/RemindersPage";
import { FinancePage }             from "./pages/FinancePage";
import { MyPage }                  from "./pages/MyPage";
import { EditPage }                from "./pages/EditPage";
import { CategoryManagementPage }  from "./pages/CategoryManagementPage";
import { CategoryProvider }        from "./CategoryContext";
import {
  loadFinanceEntries,
  saveFinanceEntries,
  type FinanceEntry,
} from "./financeStore";

// ─── Course parser types & helpers ───────────────────────────────────────────

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  keepInLifePilot: boolean;
  addToCalendar: boolean;
}

// ─── Apple Reminders data structure ──────────────────────────────────────────

interface ReminderItem {
  sourceEventId: number;
  title: string;
  notes: string;
  dueDate: Date | null;
  reminderDate: Date | null;
  isCompleted: boolean;
}

// ─── Apple Calendar data structure ───────────────────────────────────────────

interface CalendarItem {
  sourceEventId: number;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  location: string;
  notes: string;
}

// ─── Medical / Shopping / Payment / Pending types ────────────────────────────

interface MedicalItem {
  id: number;
  date: string;
  time: string;
  hospital: string;
  department: string;
  notes: string;
  selected: boolean;
}

interface ShoppingItem {
  id: number;
  date: string;
  lines: string[];
  amount: string;
  selected: boolean;
}

interface PaymentItem {
  id: number;
  name: string;
  dueDate: string;
  amount: string;
  account: string;
  notes: string;
  selected: boolean;
}

interface PendingItem {
  id: number;
  text: string;
  selected: boolean;
}

// ─── Course parser ────────────────────────────────────────────────────────────

// Date pattern: 7/30  |  7/21  |  7/20-7/24  |  7/20-24
const DATE_RE = /\d{1,2}\/\d{1,2}(?:[-–~～]\d{1,2}(?:\/\d{1,2})?)?/;

function isEventHeader(line: string): boolean {
  const m = line.match(DATE_RE);
  if (!m) return false;
  const beforeDate = line.slice(0, m.index).trim();
  return /[\u4e00-\u9fff\w]/.test(beforeDate);
}

function extractDate(line: string): string {
  const m = line.match(DATE_RE);
  return m ? m[0] : "";
}

function extractTitle(line: string, date: string): string {
  return line.replace(date, "").replace(/\s+/g, " ").trim();
}

function extractTime(line: string): string {
  // （時間09點-12點）  |  時間14點-17點  |  09:00-12:00
  const patterns = [
    /時間\s*(\d{1,2}[點点]\s*[-–~～]\s*\d{1,2}[點点])/,
    /時間\s*(\d{1,2}[點点])/,
    /時間\s*(\d{1,2}:\d{2}\s*[-–~～]\s*\d{1,2}:\d{2})/,
    /時間\s*(\d{1,2}:\d{2})/,
    /(\d{1,2}:\d{2}\s*[-–~～]\s*\d{1,2}:\d{2})/,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) return m[1];
  }
  return "";
}

function extractLocation(line: string): string {
  return line.replace(/[（()）【】]/g, "").trim();
}

function isTimeLine(line: string): boolean {
  return /時間/.test(line) || /\d{1,2}:\d{2}/.test(line);
}

function parseEvents(text: string): Event[] {
  // Preserve blank lines as boundary signals — do NOT filter them yet
  const rawLines = text.split("\n").map((l) => l.trim());

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of rawLines) {
    if (line === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else if (isEventHeader(line) && current.length > 0) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks
    .filter((b) => b.length > 0)
    .map((block, idx) => {
      const firstLine = block[0];
      const bodyLines = block.slice(1);

      let date = extractDate(firstLine);
      if (!date) {
        for (const line of bodyLines) {
          const d = extractDate(line);
          if (d) { date = d; break; }
        }
      }

      const title = extractTitle(firstLine, date) || "（無標題）";

      let time = "";
      let location = "";

      for (const line of bodyLines) {
        const t = extractTime(line);
        if (t && !time) {
          time = t;
        } else if (!isTimeLine(line) && !location) {
          location = extractLocation(line);
        }
      }

      return {
        id: idx + 1,
        title,
        date,
        time,
        location,
        keepInLifePilot: true,
        addToCalendar: false,
      };
    });
}

// ─── Airport Transfer parser ──────────────────────────────────────────────────

interface AirportTransfer {
  id: number;
  date: string;    // YYYY-MM-DD or ""
  time: string;
  flight: string;
  type: string;    // 接機 | 送機 | ""
  district: string;
  vehicle: string;
  price: string;
  notes: string;
  selected: boolean;
}

// A line "starts with a four-digit time" e.g. 2100, 2115, 0830
const TRANSFER_HEADER_RE = /^\d{4}(\s|$)/;
// Flight number embedded anywhere: 1–2 letters + 2–5 digits (e.g. CI173, BR68, VN0578)
const FLIGHT_EMBEDDED_RE = /[A-Za-z]{1,2}\d{2,5}/;
// Price: a standalone 3–6 digit number token
const PRICE_RE = /^\d{3,6}$/;
// Vehicle keywords — includes seat-count codes common in TW dispatch messages
const VEHICLE_RE =
  /轎車|廂型|sedan|van|巴士|bus|正七|正五|小車|大車|七人座|九人座|豪華|商務/i;
// Pickup / Dropoff keywords
const TRANSFER_TYPE_RE = /接機|送機/;

function isTransferHeader(line: string): boolean {
  return TRANSFER_HEADER_RE.test(line);
}

/**
 * Classify a single atomic token extracted from a transfer record.
 * A token is one space-delimited chunk from the header remainder or a body line.
 * The `+` separator is handled by the caller before this function is reached.
 */
function classifyToken(
  token: string,
  state: {
    flight: string; type: string; district: string;
    vehicle: string; price: string; noteParts: string[];
  }
): void {
  // ── Transfer type (接機 / 送機) — may be fused with flight, e.g. "接機CI173" ──
  const typeMatch = token.match(TRANSFER_TYPE_RE);
  if (typeMatch && !state.type) {
    state.type = typeMatch[0];
    // Check for an embedded flight in the same token after the type keyword
    const remainder = token.replace(TRANSFER_TYPE_RE, "").trim();
    if (remainder && FLIGHT_EMBEDDED_RE.test(remainder) && !state.flight) {
      const fm = remainder.match(FLIGHT_EMBEDDED_RE);
      if (fm) state.flight = fm[0].toUpperCase();
    }
    return;
  }

  // ── Standalone flight token (pure letter+digit, no Chinese) ──
  if (!state.flight && FLIGHT_EMBEDDED_RE.test(token) && !/[\u4e00-\u9fff]/.test(token)) {
    const fm = token.match(FLIGHT_EMBEDDED_RE);
    if (fm) { state.flight = fm[0].toUpperCase(); return; }
  }

  // ── Vehicle keyword ──
  if (!state.vehicle && VEHICLE_RE.test(token)) {
    state.vehicle = token; return;
  }

  // ── Price: standalone digits ──
  if (!state.price && PRICE_RE.test(token)) {
    state.price = token; return;
  }

  // ── Notes label ──
  if (/備註/.test(token)) {
    state.noteParts.push(token.replace(/備註\s*[：:]\s*/, "").trim());
    return;
  }

  // ── Chinese text → district first, then notes ──
  if (/[\u4e00-\u9fff]/.test(token)) {
    if (!state.district) { state.district = token; }
    else { state.noteParts.push(token); }
    return;
  }

  // ── Fallback ──
  if (token) state.noteParts.push(token);
}

function parseAirportTransfers(text: string): AirportTransfer[] {
  const rawLines = text.split("\n").map((l) => l.trim());

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of rawLines) {
    if (line === "") {
      if (current.length > 0) { blocks.push(current); current = []; }
    } else if (isTransferHeader(line) && current.length > 0) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks
    .filter((b) => b.length > 0 && isTransferHeader(b[0]))
    .map((block, idx) => {
      const firstLine = block[0];
      const time = firstLine.slice(0, 4);
      const headerRest = firstLine.slice(4).trim();
      const bodyLines = block.slice(1);

      // Build token list:
      //   • Split header remainder by spaces → compact single-line tokens
      //   • Each body line is also one token
      const rawTokens: string[] = [
        ...(headerRest ? headerRest.split(/\s+/).filter(Boolean) : []),
        ...bodyLines.filter(Boolean),
      ];

      const state = {
        flight: "", type: "", district: "",
        vehicle: "", price: "", noteParts: [] as string[],
      };

      for (const rawToken of rawTokens) {
        // Split on "+" — used in TW dispatch to append accessory notes
        // e.g. "桃園八德+兒童椅" → ["桃園八德", "兒童椅"]
        const parts = rawToken.split("+").map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          classifyToken(part, state);
        }
      }

      return {
        id: idx + 1,
        date: "",
        time,
        flight:   state.flight,
        type:     state.type,
        district: state.district,
        vehicle:  state.vehicle,
        price:    state.price,
        notes:    state.noteParts.filter(Boolean).join("　").trim(),
        selected: false,
      };
    });
}

// ─── Medical parser ───────────────────────────────────────────────────────────

const HOSPITAL_NAME_RE =
  /醫院|診所|榮總|長庚|台大|成大|北榮|中榮|高榮|林口|新光|國泰|慈濟|馬偕|衛生所|聯合醫院/;
const DEPARTMENT_NAME_RE =
  /骨科|內科|外科|眼科|耳鼻喉|皮膚科|牙科|精神科|婦產科|兒科|泌尿科|心臟科|神經科|腫瘤科|放射科|復健科|急診|家醫科|一般科|感染科|風濕科|肝膽科|腸胃科|胸腔科|血液科|過敏科|免疫科/;

function parseMedical(text: string): MedicalItem[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let date = "";
  let time = "";
  let hospital = "";
  let department = "";
  const noteLines: string[] = [];

  for (const line of lines) {
    if (!date) {
      const d = extractDate(line);
      if (d) { date = d; continue; }
    }
    // Time: try full extractTime first, then standalone HH:MM or N點 patterns
    if (!time) {
      const t = extractTime(line);
      if (t) { time = t; continue; }
      if (/^\d{1,2}:\d{2}$/.test(line)) { time = line; continue; }
      if (/^\d{1,2}[點点]$/.test(line)) { time = line; continue; }
    }
    if (!hospital && HOSPITAL_NAME_RE.test(line)) { hospital = line; continue; }
    if (!department && DEPARTMENT_NAME_RE.test(line)) { department = line; continue; }
    noteLines.push(line);
  }

  return [{
    id: 1, date, time, hospital, department,
    notes: noteLines.join("\n"), selected: true,
  }];
}

// ─── Shopping parser ──────────────────────────────────────────────────────────

function parseShopping(text: string): ShoppingItem[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let date = "";
  let amount = "";
  const itemLines: string[] = [];

  for (const line of lines) {
    // Extract a leading date line (e.g. "6/27") — only take the very first match
    if (!date) {
      const d = extractDate(line);
      // Accept as the date line only if it is a pure date (no other meaningful text)
      if (d && line.replace(d, "").trim() === "") {
        date = d;
        continue;
      }
    }
    // Amount / total line
    const amtMatch = line.match(
      /NT\$?\s*[\d,]+|NTD\s*[\d,]+|總計\s*[：:]?\s*[\d,]+|合計\s*[：:]?\s*[\d,]+|\d+元/
    );
    if (amtMatch && !amount) {
      amount = amtMatch[0];
      continue;
    }
    itemLines.push(line);
  }

  return [{ id: 1, date, lines: itemLines, amount, selected: true }];
}

// ─── Payment parser ───────────────────────────────────────────────────────────

function parsePayment(text: string): PaymentItem[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let name = "";
  let dueDate = "";
  let amount = "";
  let account = "";
  const noteLines: string[] = [];

  for (const line of lines) {
    if (!account && (/帳號|戶名|匯入/.test(line) || /\d{10,}/.test(line))) {
      account = line; continue;
    }
    if (!amount && /NT\$|NTD|金額|元整|\d+元/.test(line)) {
      amount = line; continue;
    }
    if (!dueDate && DATE_RE.test(line) && /截止|繳費|到期|期限/.test(line)) {
      const d = extractDate(line);
      dueDate = d || line; continue;
    }
    if (!dueDate && /^\d{1,2}\/\d{1,2}/.test(line)) {
      dueDate = line; continue;
    }
    if (!name && /[\u4e00-\u9fff]/.test(line)) {
      name = line; continue;
    }
    noteLines.push(line);
  }

  return [{
    id: 1, name, dueDate, amount, account,
    notes: noteLines.join("\n"), selected: true,
  }];
}

// ─── Pending parser ───────────────────────────────────────────────────────────

function parsePending(text: string): PendingItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return [{ id: 1, text: trimmed, selected: true }];
}

// ─── Message type detection ───────────────────────────────────────────────────

type MessageTypeName =
  | "Course"
  | "Airport Transfer"
  | "Shopping"
  | "Payment"
  | "Medical"
  | "Pending";

interface DetectionResult {
  type: string;
  label: string;       // Traditional Chinese label
  confidence: number;  // 0–99
  color: string;       // Tailwind accent name
}

function detectMessageType(text: string): DetectionResult {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const full = lines.join("\n");

  const scores: Record<string, number> = {
    "Airport Transfer": 0,
    "Course": 0,
    "Shopping": 0,
    "Payment": 0,
    "Medical": 0,
  };

  // ── Airport Transfer ──
  scores["Airport Transfer"] += lines.filter((l) => TRANSFER_HEADER_RE.test(l)).length * 60;
  scores["Airport Transfer"] +=
    (full.match(/接機|送機|班機|轎車|廂型|接送|機場|航班/g) ?? []).length * 15;

  // ── Course ──
  scores["Course"] += lines.filter((l) => isEventHeader(l)).length * 30;
  scores["Course"] +=
    (full.match(/時間.*?點|上課|課程|補習|教室|國小|國中|高中/g) ?? []).length * 10;

  // ── Shopping ──
  scores["Shopping"] +=
    (full.match(/購買|訂單|商品|結帳|收據|發票|折扣|優惠|免運|出貨|宅配|購物|下單|採購|清單/g) ?? []).length * 20;
  if (/NT\$|NTD/.test(full)) scores["Shopping"] += 15;
  // Structural: 3+ short Chinese-only lines (≤15 chars) suggest a product list
  {
    const shortChineseLines = lines.filter((l) =>
      /^[\u4e00-\u9fff\s]{1,15}$/.test(l) && l.trim().length > 0
    );
    if (shortChineseLines.length >= 3) scores["Shopping"] += shortChineseLines.length * 5;
  }

  // ── Payment ──
  scores["Payment"] +=
    (full.match(/轉帳|匯款|帳號|收款|付款|ATM|繳費|銀行|戶名|存款|匯入|繳納|截止|到期|期限/g) ?? []).length * 20;
  scores["Payment"] +=
    (full.match(/信用卡|電費|水費|電話費|瓦斯費|水電費|停車費|管理費|繳款/g) ?? []).length * 15;
  scores["Payment"] +=
    (full.match(/\d+元/g) ?? []).length * 10;

  // ── Medical ──
  scores["Medical"] +=
    (full.match(/掛號|診所|醫院|看診|門診|醫師|醫生|回診|複診|藥局|處方|掛診|榮總|長庚|台大/g) ?? []).length * 25;
  // Department names also signal Medical
  scores["Medical"] +=
    (full.match(/骨科|內科|外科|眼科|耳鼻喉|皮膚科|牙科|精神科|婦產科|兒科|心臟科|神經科|復健科|家醫科|腸胃科/g) ?? []).length * 20;

  // ── Find winner ──
  const entries = Object.entries(scores);
  const [winner, winScore] = entries.reduce<[string, number]>(
    (best, [k, v]) => (v > best[1] ? [k, v] : best),
    ["", 0]
  );

  if (winScore === 0) {
    return { type: "Pending", label: "待分類", confidence: 0, color: "gray" };
  }

  const restSum = entries.reduce((s, [, v]) => s + v, 0) - winScore;
  const confidence = Math.min(99, Math.round((winScore / (winScore + restSum + 20)) * 100));

  const META: Record<string, { type: MessageTypeName; label: string; color: string }> = {
    "Airport Transfer": { type: "Airport Transfer", label: "接送機",  color: "amber"  },
    "Course":           { type: "Course",           label: "課程",    color: "blue"   },
    "Shopping":         { type: "Shopping",         label: "購物",    color: "purple" },
    "Payment":          { type: "Payment",          label: "付款",    color: "green"  },
    "Medical":          { type: "Medical",          label: "醫療",    color: "rose"   },
  };

  return { ...META[winner], confidence };
}

// ─── detectParserType — thin wrapper that shares logic with detectMessageType ─

function detectParserType(text: string): MessageTypeName {
  return detectMessageType(text).type as MessageTypeName;
}

// ─── Apple Reminders builder ──────────────────────────────────────────────────

/** Parse "7/30" or "7/20-7/24" → Date (start) using the current year. */
function parseEventDate(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  const datePart = dateStr.split(/[-–~～]/)[0].trim();
  const [monthStr, dayStr] = datePart.split("/");
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);
  if (!month || !day) return null;

  const year = new Date().getFullYear();
  let hour = 0;
  let minute = 0;

  if (timeStr) {
    const colonMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (colonMatch) {
      hour = parseInt(colonMatch[1]);
      minute = parseInt(colonMatch[2]);
    } else {
      const dotMatch = timeStr.match(/(\d{1,2})[點点]/);
      if (dotMatch) hour = parseInt(dotMatch[1]);
    }
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/** Parse end date + end time from a date/time string pair. */
function parseEndDate(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;

  const year = new Date().getFullYear();
  const dateParts = dateStr.split(/[-–~～]/);

  let month: number;
  let day: number;

  if (dateParts.length >= 2) {
    // Date range: 7/20-7/24 or 7/20-24
    const endPart = dateParts[dateParts.length - 1].trim();
    if (endPart.includes("/")) {
      const [m, d] = endPart.split("/").map(Number);
      month = m; day = d;
    } else {
      month = parseInt(dateParts[0].split("/")[0]);
      day = parseInt(endPart);
    }
  } else {
    const [m, d] = dateStr.split("/").map(Number);
    month = m; day = d;
  }

  if (!month || !day) return null;

  // End time: take the second number in a time range, else reuse start time
  let hour = 0;
  let minute = 0;

  if (timeStr) {
    const colonRange = timeStr.match(/\d{1,2}:\d{2}\s*[-–~～]\s*(\d{1,2}):(\d{2})/);
    if (colonRange) {
      hour = parseInt(colonRange[1]);
      minute = parseInt(colonRange[2]);
    } else {
      const dotRange = timeStr.match(/\d{1,2}[點点]\s*[-–~～]\s*(\d{1,2})[點点]/);
      if (dotRange) {
        hour = parseInt(dotRange[1]);
      } else {
        // Single time → same as start time
        const c = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (c) { hour = parseInt(c[1]); minute = parseInt(c[2]); }
        else {
          const d = timeStr.match(/(\d{1,2})[點点]/);
          if (d) hour = parseInt(d[1]);
        }
      }
    }
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/** Convert selected course events into Apple Reminders-ready data objects. */
function buildReminderItems(events: Event[]): ReminderItem[] {
  return events
    .filter((e) => e.keepInLifePilot)
    .map((e) => {
      const dueDate = parseEventDate(e.date, e.time);

      let reminderDate: Date | null = null;
      if (dueDate) {
        if (e.time) {
          reminderDate = new Date(dueDate.getTime() - 60 * 60 * 1000);
        } else {
          reminderDate = new Date(dueDate);
          reminderDate.setHours(9, 0, 0, 0);
        }
      }

      const noteLines: string[] = [];
      if (e.location) noteLines.push(`地點：${e.location}`);
      if (e.time)     noteLines.push(`時間：${e.time}`);
      if (e.date)     noteLines.push(`日期：${e.date}`);

      return {
        sourceEventId: e.id,
        title: e.title,
        notes: noteLines.join("\n"),
        dueDate,
        reminderDate,
        isCompleted: false,
      };
    });
}

/** Convert selected course events into Apple Calendar-ready data objects. */
function buildCalendarItems(events: Event[]): CalendarItem[] {
  return events
    .filter((e) => e.keepInLifePilot)
    .map((e) => {
      const startDate = parseEventDate(e.date, e.time);
      const endDate = parseEndDate(e.date, e.time);
      const noteLines: string[] = [];
      if (e.date) noteLines.push(`日期：${e.date}`);
      if (e.time) noteLines.push(`時間：${e.time}`);
      return {
        sourceEventId: e.id,
        title: e.title,
        startDate,
        endDate,
        location: e.location,
        notes: noteLines.join("\n"),
      };
    });
}

/** Format a Date for compact display, e.g. "7/30 09:00". */
function formatReminderDate(d: Date | null): string {
  if (!d) return "—";
  const mo = d.getMonth() + 1;
  const da = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? `${mo}/${da} ${h}:${m}` : `${mo}/${da}`;
}

// ─── Accent helper ────────────────────────────────────────────────────────────

function accentText(color: string) {
  return (
    color === "amber"  ? "text-amber-300"   :
    color === "blue"   ? "text-blue-400"    :
    color === "purple" ? "text-purple-400"  :
    color === "green"  ? "text-emerald-400" :
    color === "rose"   ? "text-rose-400"    :
    "text-gray-400"
  );
}

function accentBg(color: string) {
  return (
    color === "amber"  ? "bg-amber-400"   :
    color === "blue"   ? "bg-blue-400"    :
    color === "purple" ? "bg-purple-400"  :
    color === "green"  ? "bg-emerald-400" :
    color === "rose"   ? "bg-rose-400"    :
    "bg-gray-500"
  );
}

function accentBorder(color: string) {
  return (
    color === "amber"  ? "border-amber-500/40 bg-amber-500/5"   :
    color === "blue"   ? "border-blue-500/40 bg-blue-500/5"     :
    color === "purple" ? "border-purple-500/40 bg-purple-500/5" :
    color === "green"  ? "border-emerald-500/40 bg-emerald-500/5" :
    color === "rose"   ? "border-rose-500/40 bg-rose-500/5"     :
    "border-white/10 bg-white/5"
  );
}

function accentCheckbox(color: string) {
  return (
    color === "amber"  ? "accent-amber-500"   :
    color === "blue"   ? "accent-blue-500"    :
    color === "purple" ? "accent-purple-500"  :
    color === "green"  ? "accent-emerald-500" :
    color === "rose"   ? "accent-rose-500"    :
    "accent-gray-500"
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

// ─── Bottom navigation ────────────────────────────────────────────────────────

type PageId = "add" | "reminders" | "finance" | "my";

function BottomNav({
  activePage,
  onNavigate,
  remindersCount,
}: {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  remindersCount: number;
}) {
  const tabs: { id: PageId; label: string; badge?: number }[] = [
    { id: "add",       label: "新增" },
    { id: "reminders", label: "提醒事項", badge: remindersCount },
    { id: "finance",   label: "收支" },
    { id: "my",        label: "我的" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[58px] bg-gray-950/95 backdrop-blur border-t border-white/10 flex z-50">
      {tabs.map((tab) => {
        const active = activePage === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-150 ${
              active ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <div className="relative">
              <span className={`text-[11px] font-semibold tracking-wide ${active ? "text-blue-400" : ""}`}>
                {tab.label}
              </span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-3.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-blue-500 text-white text-[9px] font-bold px-1">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </div>
            {active && (
              <span className="w-1 h-1 rounded-full bg-blue-400" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [message, setMessage] = useState("");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState<"ai" | "rule" | null>(null);
  const [activePage, setActivePage] = useState<PageId>("add");
  const [showCategoryMgmt, setShowCategoryMgmt] = useState(false);
  const [savedReminders, setSavedReminders] = useState<Reminder[]>(() => loadReminders());
  const [bulkDatePickerOpen, setBulkDatePickerOpen] = useState(false);
  const [bulkDateValue, setBulkDateValue] = useState("");
  const [bulkConfirmNeeded, setBulkConfirmNeeded] = useState<"none" | "has-dates">("none");
  const [createConfirmPending, setCreateConfirmPending] = useState(false);
  const [missingDateCount, setMissingDateCount] = useState(0);

  function handleDeleteReminder(id: string) {
    const entries = loadFinanceEntries();
    const hasLinked = entries.some((e) => e.sourceReminderId === id);
    if (hasLinked) {
      saveFinanceEntries(entries.map((e) =>
        e.sourceReminderId === id ? { ...e, sourceReminderId: undefined } : e
      ));
    }
    setSavedReminders(deleteReminder(id));
  }

  function handleToggleReminderComplete(id: string) {
    setSavedReminders(toggleReminderComplete(id));
  }

  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);

  function handleOpenEdit(id: string) {
    setEditingReminderId(id);
  }

  function handleCloseEdit() {
    setEditingReminderId(null);
  }

  function handleSaveEdit(patch: Partial<Reminder>) {
    if (!editingReminderId) return;
    setSavedReminders(updateReminder(editingReminderId, patch));
    setEditingReminderId(null);
  }

  function handleDeleteFromEdit() {
    if (!editingReminderId) return;
    const entries = loadFinanceEntries();
    const hasLinked = entries.some((e) => e.sourceReminderId === editingReminderId);
    if (hasLinked) {
      saveFinanceEntries(entries.map((e) =>
        e.sourceReminderId === editingReminderId ? { ...e, sourceReminderId: undefined } : e
      ));
    }
    setSavedReminders(deleteReminder(editingReminderId));
    setEditingReminderId(null);
  }

  function handleBulkApply(mode: "all" | "missing-only") {
    if (!bulkDateValue) return;
    setPreviewItems((prev) =>
      prev.map((item) =>
        mode === "all" || !item.date ? { ...item, date: bulkDateValue } : item
      )
    );
    setBulkDatePickerOpen(false);
    setBulkDateValue("");
    setBulkConfirmNeeded("none");
  }

  function handleBulkApplyClick() {
    if (!bulkDateValue) return;
    const hasExisting = previewItems.some((item) => item.date);
    if (hasExisting) {
      setBulkConfirmNeeded("has-dates");
    } else {
      handleBulkApply("all");
    }
  }

  function resetParsed() {
    setPreviewItems([]);
  }

  // ── Map AI events → PreviewItem[] ─────────────────────────────────────────
  function mapAIEvents(aiEvents: AIEvent[]): {
    previewItems: PreviewItem[];
    primaryLabel: string;
    avgConfidence: number;
  } {
    const ALLOWED = new Set([
      "Course", "Airport Transfer", "Shopping", "Payment", "Medical",
      "Income", "Expense", "Work", "Family", "General", "Pending",
    ]);

    let totalConf = 0;
    let primaryLabel = "一般事項";
    let isFirst = true;

    const items: PreviewItem[] = aiEvents.map((e) => {
      totalConf += typeof e.confidence === "number" ? e.confidence : 50;
      const type = (ALLOWED.has(e.type) ? e.type : "General") as PreviewItem["type"];
      if (isFirst) {
        primaryLabel = TYPE_LABEL[type] ?? "一般事項";
        isFirst = false;
      }
      return {
        ...emptyPreviewItem(type),
        type,
        category: e.category ?? "",
        title: e.title ?? "",
        date: normalizeDate(e.date ?? ""),
        startTime: normalizeTime(e.startTime ?? ""),
        endTime: normalizeTime(e.endTime ?? ""),
        allDay: !e.startTime,

        location: e.location ?? "",
        notes: e.notes ?? "",
        flightNumber: e.flightNumber ?? "",
        transferType: e.transferType ?? "",
        district: e.district ?? "",
        vehicleType: e.vehicleType ?? "",
        price: e.price ?? "",
        shoppingItems:
          Array.isArray(e.items) && e.items.length > 0
            ? e.items
            : e.notes
            ? [e.notes]
            : [],
        amount: e.amount ?? "",
        account: "",
        dueDate: normalizeDate(e.dueDate ?? ""),
        hospital: e.hospital ?? e.location ?? "",
        department: e.department ?? "",
        source: e.source ?? "",
        merchant: e.merchant ?? "",
        pendingText:
          type === "Pending"
            ? [e.title, e.notes, ...(e.items ?? [])].filter(Boolean).join("\n")
            : "",
      };
    });

    return {
      previewItems: items,
      primaryLabel,
      avgConfidence:
        aiEvents.length > 0 ? Math.round(totalConf / aiEvents.length) : 0,
    };
  }

  // ── Rule-based fallback ─────────────────────────────────────────────────────
  function runLocalParsers(trimmed: string) {
    const detection = detectMessageType(trimmed);
    setDetectionResult(detection);

    let items: PreviewItem[] = [];

    switch (detection.type) {
      case "Airport Transfer":
        items = parseAirportTransfers(trimmed).map((t) => ({
          ...emptyPreviewItem("Airport Transfer"),
          type: "Airport Transfer" as const,
          title: [t.type, t.flight].filter(Boolean).join(" ") || "接送機",
          date: normalizeDate(t.date),
          startTime: normalizeTime(t.time),
          flightNumber: t.flight,
          transferType: t.type,
          district: t.district,
          vehicleType: t.vehicle,
          price: t.price,
          notes: t.notes,
        }));
        break;

      case "Course":
        items = parseEvents(trimmed).map((e) => ({
          ...emptyPreviewItem("Course"),
          type: "Course" as const,
          title: e.title,
          date: normalizeDate(e.date),
          startTime: normalizeTime(e.time),
          location: e.location,
        }));
        break;

      case "Medical":
        items = parseMedical(trimmed).map((m) => ({
          ...emptyPreviewItem("Medical"),
          type: "Medical" as const,
          title: [m.hospital, m.department].filter(Boolean).join(" ") || "醫療預約",
          date: normalizeDate(m.date),
          startTime: normalizeTime(m.time),
          hospital: m.hospital,
          department: m.department,
          notes: m.notes,
        }));
        break;

      case "Shopping":
        items = parseShopping(trimmed).map((s) => ({
          ...emptyPreviewItem("Shopping"),
          type: "Shopping" as const,
          title: "購物清單",
          date: normalizeDate(s.date),
          shoppingItems: s.lines,
          amount: s.amount,
        }));
        break;

      case "Payment":
        items = parsePayment(trimmed).map((p) => ({
          ...emptyPreviewItem("Payment"),
          type: "Payment" as const,
          title: p.name || "付款提醒",
          date: normalizeDate(p.dueDate),
          dueDate: normalizeDate(p.dueDate),
          amount: p.amount,
          account: p.account,
          notes: p.notes,
        }));
        break;

      default:
        items = parsePending(trimmed).map((p) => ({
          ...emptyPreviewItem("Pending"),
          type: "Pending" as const,
          pendingText: p.text,
          title: p.text || "待確認事項",
        }));
    }

    setPreviewItems(items);
  }

  async function handleAnalyze() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("請先貼上訊息內容。");
      return;
    }
    setError("");
    resetParsed();
    setAiSource(null);

    // ── AI path (always first) ────────────────────────────────────────────────
    setAiLoading(true);
    try {
      const result = await parseWithAI(trimmed);
      const mapped = mapAIEvents(result.events);
      setPreviewItems(mapped.previewItems);
      setDetectionResult({
        type: mapped.previewItems[0]?.type ?? "General",
        label: mapped.primaryLabel,
        confidence: mapped.avgConfidence,
        color: "blue",
      });
      setAiSource("ai");
      setAnalyzed(true);
      return;
    } catch (err) {
      console.error("AI parsing failed, falling back to local parsers:", err);
      setError("AI 整理暫時無法使用，已改用基本整理模式。");
    } finally {
      setAiLoading(false);
    }

    // ── Rule-based fallback ────────────────────────────────────────────────────
    setAiSource("rule");
    runLocalParsers(trimmed);
    setAnalyzed(true);
  }

  function buildNewReminders(): Reminder[] {
    const now = new Date().toISOString();
    const uid = () => crypto.randomUUID();
    return previewItems.map((item) => ({
      id: uid(),
      type: item.type as Reminder["type"],
      completed: false,
      createdAt: now,
      title: item.title || TYPE_LABEL[item.type] || "事項",
      date: item.date,
      startTime: item.allDay ? "" : item.startTime,
      endTime:   item.allDay ? "" : item.endTime,
      allDay: item.allDay,
      location: item.location,
      notes: item.notes,
      category: item.category,
      flightNumber: item.flightNumber,
      transferType: item.transferType,
      district: item.district,
      vehicleType: item.vehicleType,
      price: item.price,
      shoppingItems: item.shoppingItems,
      amount: item.amount,
      account: item.account,
      dueDate: item.dueDate,
      hospital: item.hospital,
      department: item.department,
      source: item.source,
      merchant: item.merchant,
      reminders: item.reminders?.length ? item.reminders : undefined,
      financialStatus: item.financialStatus !== "none" ? item.financialStatus : undefined,
      expectedAmount: item.expectedAmount,
      financialDueDate: item.financialDueDate || undefined,
    }));
  }

  function doCreate() {
    const newItems = buildNewReminders();
    if (newItems.length === 0) return;
    const updated = addReminders(newItems);
    setSavedReminders(updated);
    setActivePage("reminders");
    setAnalyzed(false);
    setMessage("");
    resetParsed();
    setAiSource(null);
    setBulkDatePickerOpen(false);
    setBulkDateValue("");
    setBulkConfirmNeeded("none");
    setCreateConfirmPending(false);
  }

  function handleCreate() {
    const newItems = buildNewReminders();
    if (newItems.length === 0) return;
    const missing = newItems.filter((r) => !r.date).length;
    if (missing > 0) {
      setMissingDateCount(missing);
      setCreateConfirmPending(true);
      return;
    }
    doCreate();
  }

  // ── Derived counts ──
  const totalCount = previewItems.length;

  const accentColor = detectionResult?.color ?? "blue";

  const PLACEHOLDER = `明天下午3點到桃園榮總看骨科，
回家前買牛奶、雞蛋和衛生紙，
信用卡8月5日前要繳23560元。

也可以直接貼上 LINE 訊息、課程通知、
接送工作、付款資訊或其他生活事項。`;


  return (
    <CategoryProvider>
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <main className="flex-1 overflow-y-auto pb-20">
      {activePage === "add" && (
      <div className="max-w-2xl mx-auto px-6 py-14">
        <div className="mb-10">
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
            LifePilot
          </h1>
          <p className="text-gray-400 text-base">貼上訊息，AI 幫你整理成提醒事項</p>
        </div>

        <div className="mb-2">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setAnalyzed(false);
              setError("");
            }}
            placeholder={PLACEHOLDER}
            rows={8}
            className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 px-5 py-4 text-base resize-none focus:outline-none focus:border-blue-500/60 transition-all duration-200"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

        <button
          onClick={handleAnalyze}
          disabled={aiLoading || !message.trim()}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold text-base transition-all duration-150 shadow-lg shadow-blue-600/20 mt-4 mb-10"
        >
          {aiLoading ? "正在整理…" : "開始整理"}
        </button>

        {analyzed && (
          <>
            {/* ── Compact detection summary ── */}
            {detectionResult && (() => {
              const typeSet = new Set(previewItems.map((i) => i.type));
              const multiTypes = typeSet.size;
              return (
                <div className="mb-5 flex items-center gap-2 flex-wrap">
                  {multiTypes > 1 ? (
                    <span className="text-sm text-gray-300">
                      已整理{" "}
                      <span className="text-blue-300 font-semibold">{multiTypes}</span>{" "}
                      種類型 · 共{" "}
                      <span className="text-blue-300 font-semibold">{totalCount}</span>{" "}
                      個事項
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">
                      {detectionResult.label}
                      {" · "}
                      <span className={accentText(accentColor)}>{detectionResult.confidence}%</span>
                    </span>
                  )}
                  {aiSource === "ai" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-medium">AI</span>
                  )}
                  {aiSource === "rule" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-gray-500">基本模式</span>
                  )}
                </div>
              );
            })()}

            {/* ── Preview section ── */}
            {totalCount > 0 ? (
              <>
                {/* Heading */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">
                    已整理{" "}
                    <span className={accentText(accentColor)}>{totalCount}</span>{" "}
                    個事項
                  </h2>
                </div>

                {/* ── Bulk date apply ── */}
                <div className="mb-4">
                  {!bulkDatePickerOpen ? (
                    <button
                      onClick={() => setBulkDatePickerOpen(true)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-gray-300 transition-all"
                    >
                      📅 全部套用日期
                    </button>
                  ) : (
                    <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/5">
                      <p className="text-sm font-semibold text-white">套用日期到已選取事項</p>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="date"
                          value={bulkDateValue}
                          onChange={(e) => { setBulkDateValue(e.target.value); setBulkConfirmNeeded("none"); }}
                          className="flex-1 text-sm rounded-lg px-3 py-2 bg-white/5 border border-white/15 text-white focus:outline-none focus:border-blue-500/50"
                          style={{ colorScheme: "dark" }}
                        />
                        <button
                          onClick={handleBulkApplyClick}
                          disabled={!bulkDateValue}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all"
                        >
                          套用
                        </button>
                        <button
                          onClick={() => { setBulkDatePickerOpen(false); setBulkConfirmNeeded("none"); }}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm transition-all"
                        >
                          取消
                        </button>
                      </div>
                      {bulkConfirmNeeded === "has-dates" && (
                        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                          <p className="text-sm text-amber-300 mb-2">部分已選事項已有日期，要如何套用？</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleBulkApply("missing-only")}
                              className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-medium"
                            >
                              只套用無日期事項
                            </button>
                            <button
                              onClick={() => handleBulkApply("all")}
                              className="flex-1 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium"
                            >
                              全部覆蓋
                            </button>
                            <button
                              onClick={() => setBulkConfirmNeeded("none")}
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PreviewItemCard — unified card for all types */}
                <div className="flex flex-col gap-3 mb-8">
                  {previewItems.map((item) => (
                    <PreviewItemCard
                      key={item.id}
                      item={item}
                      isEditing={editingId === item.id}
                      onEdit={() => setEditingId(item.id)}
                      onClose={() => setEditingId(null)}
                      onChange={(patch: Partial<PreviewItem>) =>
                        setPreviewItems((prev) =>
                          prev.map((p) => (p.id === item.id ? { ...p, ...patch } : p))
                        )
                      }
                      onDelete={() =>
                        setPreviewItems((prev) => prev.filter((p) => p.id !== item.id))
                      }
                    />
                  ))}
                </div>

                {/* Create All button */}
                <button
                  onClick={handleCreate}
                  disabled={totalCount === 0}
                  className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-150 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed bg-white text-gray-950 hover:bg-gray-100 active:bg-gray-200"
                >
                  建立全部（{totalCount}）
                </button>
                {createConfirmPending && (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <p className="text-sm text-amber-300 font-semibold mb-3">
                      有 {missingDateCount} 個事項尚未設定日期，是否仍要建立？
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCreateConfirmPending(false)}
                        className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm font-medium transition-all"
                      >
                        返回設定日期
                      </button>
                      <button
                        onClick={doCreate}
                        className="flex-1 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium transition-all"
                      >
                        仍然建立
                      </button>
                    </div>
                  </div>
                )}

              </>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                未找到可解析的事項，請確認訊息內容後再試。
              </p>
            )}
          </>
        )}
      </div>
      )}
      {activePage === "reminders" && (
        <RemindersPage
          reminders={savedReminders}
          onDelete={handleDeleteReminder}
          onToggleComplete={handleToggleReminderComplete}
          onEdit={handleOpenEdit}
        />
      )}
      {activePage === "finance" && (
        <FinancePage
          reminders={savedReminders}
          onEditReminder={handleOpenEdit}
          onRemindersChange={setSavedReminders}
        />
      )}
      {activePage === "my" && (
        <MyPage onOpenCategoryMgmt={() => setShowCategoryMgmt(true)} />
      )}
      {editingReminderId !== null &&
        !!savedReminders.find((r) => r.id === editingReminderId) && (
          <div className="fixed inset-0 bg-gray-950 z-40 overflow-y-auto">
            <EditPage
              reminder={savedReminders.find((r) => r.id === editingReminderId)!}
              onSave={handleSaveEdit}
              onCancel={handleCloseEdit}
              onDelete={handleDeleteFromEdit}
            />
          </div>
        )}
      {showCategoryMgmt && (
        <div className="fixed inset-0 bg-gray-950 z-40 overflow-y-auto">
          <CategoryManagementPage
            savedReminders={savedReminders}
            onClose={() => setShowCategoryMgmt(false)}
          />
        </div>
      )}
      </main>
      <BottomNav
        activePage={activePage}
        onNavigate={setActivePage}
        remindersCount={savedReminders.length}
      />
    </div>
    </CategoryProvider>
  );
}
