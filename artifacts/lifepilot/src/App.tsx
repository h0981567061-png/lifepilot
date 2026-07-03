import { useState } from "react";
import { isAIConfigured, parseWithAI, type AIEvent } from "./aiParser";

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
  type: MessageTypeName;
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
  return detectMessageType(text).type;
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

// ─── Course card ──────────────────────────────────────────────────────────────

function EventCard({
  event,
  onToggle,
}: {
  event: Event;
  onToggle: (id: number) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 select-none ${
        event.keepInLifePilot
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-white/10 bg-white/5 opacity-50"
      }`}
      onClick={() => onToggle(event.id)}
    >
      <input
        type="checkbox"
        checked={event.keepInLifePilot}
        onChange={() => onToggle(event.id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white leading-snug">{event.title}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
          <span className={event.date ? "text-gray-400" : "italic text-gray-600"}>
            {event.date || "無日期"}
          </span>
          <span className={event.time ? "text-gray-400" : "italic text-gray-600"}>
            {event.time || "無時間"}
          </span>
          <span className={event.location ? "text-gray-400" : "italic text-gray-600"}>
            {event.location || "無地點"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Airport Transfer card ────────────────────────────────────────────────────

function Field({ label, value, labelColor = "text-amber-400/70" }: {
  label: string;
  value: string;
  labelColor?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={`${labelColor} shrink-0 w-14 text-right`}>{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}

function AirportTransferCard({
  transfer,
  onToggle,
}: {
  transfer: AirportTransfer;
  onToggle: (id: number) => void;
}) {
  const typeColor =
    transfer.type === "接機"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : transfer.type === "送機"
      ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
      : "bg-white/5 text-gray-400 border-white/10";

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 select-none ${
        transfer.selected
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-white/10 bg-white/5 opacity-50"
      }`}
      onClick={() => onToggle(transfer.id)}
    >
      <input
        type="checkbox"
        checked={transfer.selected}
        onChange={() => onToggle(transfer.id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <span className="text-xl font-bold text-amber-300 tracking-widest">
            {transfer.time.slice(0, 2)}:{transfer.time.slice(2)}
          </span>
          {transfer.type && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${typeColor}`}>
              {transfer.type}
            </span>
          )}
          {transfer.flight && (
            <span className="text-sm font-mono text-gray-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
              {transfer.flight}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Field label="地區" value={transfer.district} />
          <Field label="車型" value={transfer.vehicle} />
          <Field label="費用" value={transfer.price ? `${transfer.price} 元` : ""} />
          <Field label="備註" value={transfer.notes} />
        </div>
        {!transfer.district && !transfer.vehicle && !transfer.price && !transfer.notes && (
          <p className="text-xs text-gray-600 italic">無詳細資料</p>
        )}
      </div>
    </div>
  );
}

// ─── Medical card ─────────────────────────────────────────────────────────────

function MedicalCard({
  item,
  onToggle,
}: {
  item: MedicalItem;
  onToggle: (id: number) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 select-none ${
        item.selected
          ? "border-rose-500/40 bg-rose-500/5"
          : "border-white/10 bg-white/5 opacity-50"
      }`}
      onClick={() => onToggle(item.id)}
    >
      <input
        type="checkbox"
        checked={item.selected}
        onChange={() => onToggle(item.id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 w-4 h-4 rounded accent-rose-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white leading-snug mb-2">
          {item.hospital || "醫療預約"}
          {item.department && (
            <span className="ml-2 text-sm font-normal text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              {item.department}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
          <span className={item.date ? "text-gray-400" : "italic text-gray-600"}>
            {item.date || "無日期"}
          </span>
          <span className={item.time ? "text-gray-400" : "italic text-gray-600"}>
            {item.time || "無時間"}
          </span>
        </div>
        {item.notes && (
          <p className="mt-2 text-xs text-gray-500 whitespace-pre-line leading-relaxed">
            {item.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shopping card ────────────────────────────────────────────────────────────

function ShoppingCard({
  item,
  onToggle,
}: {
  item: ShoppingItem;
  onToggle: (id: number) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 select-none ${
        item.selected
          ? "border-purple-500/40 bg-purple-500/5"
          : "border-white/10 bg-white/5 opacity-50"
      }`}
      onClick={() => onToggle(item.id)}
    >
      <input
        type="checkbox"
        checked={item.selected}
        onChange={() => onToggle(item.id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 w-4 h-4 rounded accent-purple-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <p className="font-semibold text-white leading-snug">購物清單</p>
          {item.date && (
            <span className="text-xs text-purple-300/80 bg-purple-500/10 px-1.5 py-0.5 rounded">
              {item.date}
            </span>
          )}
        </div>
        <ul className="text-sm text-gray-300 space-y-0.5 list-none">
          {item.lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-purple-500/60 mt-0.5">·</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
        {item.amount && (
          <p className="mt-2 text-sm font-semibold text-purple-300">{item.amount}</p>
        )}
      </div>
    </div>
  );
}

// ─── Payment card ─────────────────────────────────────────────────────────────

function PaymentCard({
  item,
  onToggle,
}: {
  item: PaymentItem;
  onToggle: (id: number) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 select-none ${
        item.selected
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-white/10 bg-white/5 opacity-50"
      }`}
      onClick={() => onToggle(item.id)}
    >
      <input
        type="checkbox"
        checked={item.selected}
        onChange={() => onToggle(item.id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 w-4 h-4 rounded accent-emerald-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white leading-snug mb-2">
          {item.name || "付款提醒"}
        </p>
        <div className="flex flex-col gap-1">
          <Field label="到期" value={item.dueDate}  labelColor="text-emerald-400/70" />
          <Field label="金額" value={item.amount}   labelColor="text-emerald-400/70" />
          <Field label="帳號" value={item.account}  labelColor="text-emerald-400/70" />
          <Field label="備註" value={item.notes}    labelColor="text-emerald-400/70" />
        </div>
      </div>
    </div>
  );
}

// ─── Pending card ─────────────────────────────────────────────────────────────

function PendingCard({
  item,
  onToggle,
}: {
  item: PendingItem;
  onToggle: (id: number) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 cursor-pointer transition-all duration-150 select-none ${
        item.selected
          ? "border-white/20 bg-white/5"
          : "border-white/10 bg-white/5 opacity-50"
      }`}
      onClick={() => onToggle(item.id)}
    >
      <input
        type="checkbox"
        checked={item.selected}
        onChange={() => onToggle(item.id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 w-4 h-4 rounded accent-gray-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-400 leading-snug mb-2">待確認</p>
        <p className="text-sm text-gray-500 whitespace-pre-line leading-relaxed">
          {item.text}
        </p>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [transfers, setTransfers] = useState<AirportTransfer[]>([]);
  const [medicalItems, setMedicalItems] = useState<MedicalItem[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [parserType, setParserType] = useState<MessageTypeName>("Course");
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [reminderItems, setReminderItems] = useState<ReminderItem[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState<"ai" | "rule" | null>(null);

  function resetParsed() {
    setEvents([]);
    setTransfers([]);
    setMedicalItems([]);
    setShoppingItems([]);
    setPaymentItems([]);
    setPendingItems([]);
    setReminderItems([]);
    setCalendarItems([]);
  }

  // ── AI type → MessageTypeName ──────────────────────────────────────────────
  function aiTypeToMessageType(type: string): MessageTypeName {
    const map: Record<string, MessageTypeName> = {
      "Course":           "Course",
      "Airport Transfer": "Airport Transfer",
      "Medical":          "Medical",
      "Shopping":         "Shopping",
      "Payment":          "Payment",
      "Work":             "Pending",
      "Family":           "Pending",
      "Pending":          "Pending",
    };
    return map[type] ?? "Pending";
  }

  // ── Map AI events → existing state arrays ──────────────────────────────────
  function mapAIEvents(aiEvents: AIEvent[]): {
    parsedEvents: Event[];
    parsedTransfers: AirportTransfer[];
    parsedMedical: MedicalItem[];
    parsedShopping: ShoppingItem[];
    parsedPayment: PaymentItem[];
    parsedPending: PendingItem[];
    primaryType: MessageTypeName;
    primaryLabel: string;
    avgConfidence: number;
  } {
    const parsedEvents: Event[] = [];
    const parsedTransfers: AirportTransfer[] = [];
    const parsedMedical: MedicalItem[] = [];
    const parsedShopping: ShoppingItem[] = [];
    const parsedPayment: PaymentItem[] = [];
    const parsedPending: PendingItem[] = [];
    let totalConfidence = 0;
    let primaryType: MessageTypeName = "Pending";
    let isFirst = true;

    let evIdx = 1, trIdx = 1, mdIdx = 1, shIdx = 1, pyIdx = 1, pdIdx = 1;

    for (const e of aiEvents) {
      totalConfidence += typeof e.confidence === "number" ? e.confidence : 50;
      const mtype = aiTypeToMessageType(e.type);
      if (isFirst) { primaryType = mtype; isFirst = false; }

      switch (mtype) {
        case "Course":
          parsedEvents.push({
            id: evIdx++,
            title: e.title ?? "（無標題）",
            date: e.date ?? "",
            time: e.startTime ?? "",
            location: e.location ?? "",
            keepInLifePilot: true,
            addToCalendar: false,
          });
          break;
        case "Airport Transfer":
          parsedTransfers.push({
            id: trIdx++,
            time: e.startTime ?? "",
            flight: e.flightNumber ?? "",
            type: e.transferType ?? "",
            district: e.district ?? "",
            vehicle: e.vehicleType ?? "",
            price: e.price ?? "",
            notes: e.notes ?? "",
            selected: true,
          });
          break;
        case "Medical":
          parsedMedical.push({
            id: mdIdx++,
            date: e.date ?? "",
            time: e.startTime ?? "",
            hospital: e.hospital ?? e.location ?? "",
            department: e.department ?? "",
            notes: e.notes ?? "",
            selected: true,
          });
          break;
        case "Shopping":
          parsedShopping.push({
            id: shIdx++,
            date: e.date ?? "",
            lines: e.items?.length ? e.items : (e.notes ? [e.notes] : []),
            amount: e.amount ?? "",
            selected: true,
          });
          break;
        case "Payment":
          parsedPayment.push({
            id: pyIdx++,
            name: e.title ?? "",
            dueDate: e.dueDate ?? "",
            amount: e.amount ?? "",
            account: "",
            notes: e.notes ?? "",
            selected: true,
          });
          break;
        default:
          parsedPending.push({
            id: pdIdx++,
            text: [e.title, e.date, e.notes, ...(e.items ?? [])]
              .filter(Boolean).join("\n"),
            selected: true,
          });
      }
    }

    const LABEL_MAP: Record<MessageTypeName, string> = {
      "Airport Transfer": "接送機",
      "Course":           "課程",
      "Medical":          "醫療",
      "Shopping":         "購物",
      "Payment":          "付款",
      "Pending":          "待確認",
    };

    return {
      parsedEvents, parsedTransfers, parsedMedical,
      parsedShopping, parsedPayment, parsedPending,
      primaryType,
      primaryLabel: LABEL_MAP[primaryType] ?? "待確認",
      avgConfidence: aiEvents.length > 0
        ? Math.round(totalConfidence / aiEvents.length) : 0,
    };
  }

  // ── Rule-based analyze (shared by both paths) ───────────────────────────────
  function runLocalParsers(trimmed: string) {
    const detection = detectMessageType(trimmed);
    setDetectionResult(detection);
    setParserType(detection.type);
    switch (detection.type) {
      case "Airport Transfer":
        setTransfers(parseAirportTransfers(trimmed).map((t) => ({ ...t, selected: true })));
        break;
      case "Course":
        setEvents(parseEvents(trimmed));
        break;
      case "Medical":
        setMedicalItems(parseMedical(trimmed));
        break;
      case "Shopping":
        setShoppingItems(parseShopping(trimmed));
        break;
      case "Payment":
        setPaymentItems(parsePayment(trimmed));
        break;
      case "Pending":
      default:
        setPendingItems(parsePending(trimmed));
    }
  }

  async function handleAnalyze() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("請先貼上 LINE 訊息內容。");
      return;
    }
    setError("");
    resetParsed();
    setAiSource(null);

    // ── AI path ──────────────────────────────────────────────────────────────
    if (aiMode && isAIConfigured()) {
      setAiLoading(true);
      try {
        const result = await parseWithAI(trimmed);
        const mapped = mapAIEvents(result.events);
        setEvents(mapped.parsedEvents);
        setTransfers(mapped.parsedTransfers);
        setMedicalItems(mapped.parsedMedical);
        setShoppingItems(mapped.parsedShopping);
        setPaymentItems(mapped.parsedPayment);
        setPendingItems(mapped.parsedPending);
        setParserType(mapped.primaryType);
        setDetectionResult({
          type: mapped.primaryType,
          label: mapped.primaryLabel,
          confidence: mapped.avgConfidence,
          color: "blue",
        });
        setAiSource("ai");
        setAnalyzed(true);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("AI parsing failed, falling back to local parsers:", msg);
        setError(`AI 解析失敗，已改用規則模式：${msg.slice(0, 80)}`);
      } finally {
        setAiLoading(false);
      }
    }

    // ── Rule-based fallback (also default when aiMode is off) ─────────────────
    setAiSource("rule");
    runLocalParsers(trimmed);
    setAnalyzed(true);
  }

  function handleToggleEvent(id: number) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, keepInLifePilot: !e.keepInLifePilot } : e)));
  }
  function handleToggleTransfer(id: number) {
    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)));
  }
  function handleToggleMedical(id: number) {
    setMedicalItems((prev) => prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m)));
  }
  function handleToggleShopping(id: number) {
    setShoppingItems((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
  }
  function handleTogglePayment(id: number) {
    setPaymentItems((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }
  function handleTogglePending(id: number) {
    setPendingItems((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }

  function handleSelectAll() {
    if (aiSource === "ai") {
      setTransfers((p) => p.map((t) => ({ ...t, selected: true })));
      setEvents((p) => p.map((e) => ({ ...e, keepInLifePilot: true })));
      setMedicalItems((p) => p.map((m) => ({ ...m, selected: true })));
      setShoppingItems((p) => p.map((s) => ({ ...s, selected: true })));
      setPaymentItems((p) => p.map((x) => ({ ...x, selected: true })));
      setPendingItems((p) => p.map((x) => ({ ...x, selected: true })));
      return;
    }
    switch (parserType) {
      case "Airport Transfer": setTransfers((p) => p.map((t) => ({ ...t, selected: true }))); break;
      case "Course":           setEvents((p) => p.map((e) => ({ ...e, keepInLifePilot: true }))); break;
      case "Medical":          setMedicalItems((p) => p.map((m) => ({ ...m, selected: true }))); break;
      case "Shopping":         setShoppingItems((p) => p.map((s) => ({ ...s, selected: true }))); break;
      case "Payment":          setPaymentItems((p) => p.map((x) => ({ ...x, selected: true }))); break;
      case "Pending":          setPendingItems((p) => p.map((x) => ({ ...x, selected: true }))); break;
    }
  }

  function handleClearAll() {
    if (aiSource === "ai") {
      setTransfers((p) => p.map((t) => ({ ...t, selected: false })));
      setEvents((p) => p.map((e) => ({ ...e, keepInLifePilot: false })));
      setMedicalItems((p) => p.map((m) => ({ ...m, selected: false })));
      setShoppingItems((p) => p.map((s) => ({ ...s, selected: false })));
      setPaymentItems((p) => p.map((x) => ({ ...x, selected: false })));
      setPendingItems((p) => p.map((x) => ({ ...x, selected: false })));
      return;
    }
    switch (parserType) {
      case "Airport Transfer": setTransfers((p) => p.map((t) => ({ ...t, selected: false }))); break;
      case "Course":           setEvents((p) => p.map((e) => ({ ...e, keepInLifePilot: false }))); break;
      case "Medical":          setMedicalItems((p) => p.map((m) => ({ ...m, selected: false }))); break;
      case "Shopping":         setShoppingItems((p) => p.map((s) => ({ ...s, selected: false }))); break;
      case "Payment":          setPaymentItems((p) => p.map((x) => ({ ...x, selected: false }))); break;
      case "Pending":          setPendingItems((p) => p.map((x) => ({ ...x, selected: false }))); break;
    }
  }

  function handleCreate() {
    if (parserType === "Course") {
      setReminderItems(buildReminderItems(events));
      setCalendarItems(buildCalendarItems(events));
    } else if (parserType === "Airport Transfer") {
      const n = transfers.filter((t) => t.selected).length;
      alert(`已建立 ${n} 筆接送機行程到 LifePilot。`);
    } else {
      // For Medical / Shopping / Payment / Pending: just confirm
      const label = detectionResult?.label ?? "項目";
      alert(`已確認 1 筆${label}資料。`);
    }
  }

  // ── Derived counts ──
  const totalCount = (() => {
    if (aiSource === "ai") {
      return transfers.length + events.length + medicalItems.length +
        shoppingItems.length + paymentItems.length + pendingItems.length;
    }
    switch (parserType) {
      case "Airport Transfer": return transfers.length;
      case "Course":           return events.length;
      case "Medical":          return medicalItems.length;
      case "Shopping":         return shoppingItems.length;
      case "Payment":          return paymentItems.length;
      case "Pending":          return pendingItems.length;
      default: return 0;
    }
  })();

  const selectedCount = (() => {
    if (aiSource === "ai") {
      return transfers.filter((t) => t.selected).length +
        events.filter((e) => e.keepInLifePilot).length +
        medicalItems.filter((m) => m.selected).length +
        shoppingItems.filter((s) => s.selected).length +
        paymentItems.filter((p) => p.selected).length +
        pendingItems.filter((p) => p.selected).length;
    }
    switch (parserType) {
      case "Airport Transfer": return transfers.filter((t) => t.selected).length;
      case "Course":           return events.filter((e) => e.keepInLifePilot).length;
      case "Medical":          return medicalItems.filter((m) => m.selected).length;
      case "Shopping":         return shoppingItems.filter((s) => s.selected).length;
      case "Payment":          return paymentItems.filter((p) => p.selected).length;
      case "Pending":          return pendingItems.filter((p) => p.selected).length;
      default: return 0;
    }
  })();

  const accentColor = detectionResult?.color ?? "blue";

  const PLACEHOLDER = `美術班 7/30
復旦國小
（時間09點-12點）

福爾 7/21
平鎮分局
（時間09點-12點）

桌球7/20-7/24
平興國小
（時間14點-17點）`;

  // ── Labels per type ──
  const typeLabel: Record<MessageTypeName, string> = {
    "Airport Transfer": "筆接送機行程",
    "Course":           "個課程活動",
    "Medical":          "筆醫療預約",
    "Shopping":         "張購物清單",
    "Payment":          "筆付款提醒",
    "Pending":          "筆待確認事項",
  };

  const emptyHint: Record<MessageTypeName, string> = {
    "Airport Transfer": "未找到接送機行程，請確認每筆資料以四位數時間開頭（如：2100）",
    "Course":           "未找到任何課程活動，請確認訊息不為空白",
    "Medical":          "未找到醫療資訊，請確認訊息包含醫院或科別",
    "Shopping":         "未找到購物清單內容",
    "Payment":          "未找到付款資訊",
    "Pending":          "無內容",
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-14">
        <div className="mb-10">
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
            LifePilot
          </h1>
          <p className="text-gray-400 text-base">貼上 LINE 訊息，自動分析行程活動</p>
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

        {/* ── AI mode toggle ── */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setAiMode((m) => !m)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 ${
              aiMode
                ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/5"
            }`}
          >
            <span>⚡ AI 解析</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${aiMode ? "bg-blue-500/20 text-blue-300" : "bg-white/10 text-gray-500"}`}>
              {aiMode ? "開啟" : "關閉"}
            </span>
            {aiMode && !isAIConfigured() && (
              <span className="text-amber-400/70 text-xs ml-1">（需設定）</span>
            )}
          </button>
        </div>

        {aiMode && !isAIConfigured() && (
          <div className="mt-3 text-sm text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
            <p className="font-medium mb-1">啟用 AI 解析需要設定 API 金鑰</p>
            <p className="text-amber-400/60 text-xs leading-relaxed">
              在 Replit Secrets 新增{" "}
              <code className="bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">VITE_OPENAI_API_KEY</code>，
              重新載入頁面後即可啟用真正的 AI 解析。
            </p>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={aiLoading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold text-base transition-all duration-150 shadow-lg shadow-blue-600/20 mt-4 mb-10"
        >
          {aiLoading ? "AI 解析中…" : "Analyze"}
        </button>

        {analyzed && (
          <>
            {/* ── Detection result card ── */}
            {detectionResult && (
              <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">偵測類型</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-2xl font-bold ${accentText(accentColor)}`}>
                    {detectionResult.label}
                  </span>
                  {aiSource === "ai" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-medium">
                      AI 解析
                    </span>
                  )}
                  {aiSource === "rule" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-gray-500">
                      規則解析
                    </span>
                  )}
                  {aiSource !== "ai" && (
                    <span className="text-sm text-gray-500">({detectionResult.type})</span>
                  )}
                </div>
                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mt-1">信心度</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${accentBg(accentColor)}`}
                      style={{ width: `${detectionResult.confidence}%` }}
                    />
                  </div>
                  <span className={`text-lg font-bold tabular-nums ${accentText(accentColor)}`}>
                    {detectionResult.confidence}%
                  </span>
                </div>
              </div>
            )}

            {/* ── Preview section ── */}
            {totalCount > 0 ? (
              <>
                {/* Heading + Select All / Clear All */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      找到{" "}
                      <span className={accentText(accentColor)}>{totalCount}</span>{" "}
                      {aiSource === "ai" ? "個事項" : typeLabel[parserType]}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      已選取 {selectedCount} / {totalCount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 ${accentText(accentColor)} border-white/10 hover:bg-white/5`}
                    >
                      全選
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:bg-white/5 transition-all duration-150"
                    >
                      清除
                    </button>
                  </div>
                </div>

                {/* Cards — in AI mode render every populated type */}
                <div className="flex flex-col gap-3 mb-8">
                  {(parserType === "Airport Transfer" || aiSource === "ai") && transfers.length > 0 && transfers.map((t) => (
                    <AirportTransferCard key={t.id} transfer={t} onToggle={handleToggleTransfer} />
                  ))}
                  {(parserType === "Course" || aiSource === "ai") && events.length > 0 && events.map((e) => (
                    <EventCard key={e.id} event={e} onToggle={handleToggleEvent} />
                  ))}
                  {(parserType === "Medical" || aiSource === "ai") && medicalItems.length > 0 && medicalItems.map((m) => (
                    <MedicalCard key={m.id} item={m} onToggle={handleToggleMedical} />
                  ))}
                  {(parserType === "Shopping" || aiSource === "ai") && shoppingItems.length > 0 && shoppingItems.map((s) => (
                    <ShoppingCard key={s.id} item={s} onToggle={handleToggleShopping} />
                  ))}
                  {(parserType === "Payment" || aiSource === "ai") && paymentItems.length > 0 && paymentItems.map((p) => (
                    <PaymentCard key={p.id} item={p} onToggle={handleTogglePayment} />
                  ))}
                  {(parserType === "Pending" || aiSource === "ai") && pendingItems.length > 0 && pendingItems.map((p) => (
                    <PendingCard key={p.id} item={p} onToggle={handleTogglePending} />
                  ))}
                </div>

                {/* Create Selected button */}
                <button
                  onClick={handleCreate}
                  disabled={selectedCount === 0}
                  className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-150 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed bg-white text-gray-950 hover:bg-gray-100 active:bg-gray-200"
                >
                  建立所選（{selectedCount}）
                </button>

                {/* ── Apple Reminders preview (Course only) ── */}
                {reminderItems.length > 0 && (
                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-4">
                      已準備 {reminderItems.length} 筆提醒資料
                    </p>
                    <div className="flex flex-col gap-3">
                      {reminderItems.map((item) => (
                        <div
                          key={item.sourceEventId}
                          className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-1"
                        >
                          <p className="font-semibold text-white text-sm">{item.title}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400">
                            <span className="text-gray-600">到期</span>
                            <span>{formatReminderDate(item.dueDate)}</span>
                            <span className="text-gray-600">提醒</span>
                            <span>{formatReminderDate(item.reminderDate)}</span>
                          </div>
                          {item.notes && (
                            <p className="mt-1 text-xs text-gray-500 whitespace-pre-line leading-relaxed">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-4 italic">
                      資料已準備完成，尚未同步至 Apple 提醒事項。
                    </p>
                  </div>
                )}

                {/* ── Apple Calendar preview (Course only) ── */}
                {calendarItems.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-4">
                      已準備 {calendarItems.length} 筆行事曆資料
                    </p>
                    <div className="flex flex-col gap-3">
                      {calendarItems.map((item) => (
                        <div
                          key={item.sourceEventId}
                          className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-1"
                        >
                          <p className="font-semibold text-white text-sm">{item.title}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400">
                            <span className="text-gray-600">開始</span>
                            <span>{formatReminderDate(item.startDate)}</span>
                            <span className="text-gray-600">結束</span>
                            <span>{formatReminderDate(item.endDate)}</span>
                            {item.location && (
                              <>
                                <span className="text-gray-600">地點</span>
                                <span>{item.location}</span>
                              </>
                            )}
                          </div>
                          {item.notes && (
                            <p className="mt-1 text-xs text-gray-500 whitespace-pre-line leading-relaxed">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-4 italic">
                      資料已準備完成，尚未同步至 Apple 行事曆。
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                {aiSource === "ai" ? "AI 未找到任何可解析的事項。" : emptyHint[parserType]}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
