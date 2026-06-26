# LifePilot — Parser Rules

## Overview

The parser is a pure TypeScript function (`parseEvents`) that runs entirely in the browser with no network calls. It converts raw pasted text into an array of structured event objects.

---

## Step 1 — Split into Lines

The input text is split on `\n`. Each line is trimmed. Empty lines are ignored for event-boundary detection but preserved in block grouping.

---

## Step 2 — Detect Event Headers

A line is treated as an **event header** (start of a new event) if it matches the date pattern:

```
\d{1,2}\/\d{1,2}(?:[-–~～]\d{1,2}(?:\/\d{1,2})?)?
```

This matches:
| Input | Matches |
|-------|---------|
| `美術班 7/30` | ✅ `7/30` |
| `福爾 7/21` | ✅ `7/21` |
| `桌球7/20-7/24` | ✅ `7/20-7/24` |
| `活動 7/5-10` | ✅ `7/5-10` |
| `復旦國小` | ❌ no date |

When an event header is found, a new event block begins. All subsequent lines belong to that block until the next header line.

---

## Step 3 — Extract Title

The title is extracted by removing the matched date substring from the header line, then trimming whitespace.

```
"美術班 7/30"  →  title: "美術班",  date: "7/30"
"桌球7/20-7/24" →  title: "桌球",   date: "7/20-7/24"
```

If the entire line is only a date (no preceding text), the title falls back to `（無標題）`.

---

## Step 4 — Extract Time

Body lines are scanned for time patterns in priority order:

| Pattern | Example Match |
|---------|--------------|
| `時間\s*\d{1,2}[點点]\s*[-–~～]\s*\d{1,2}[點点]` | `時間09點-12點` |
| `時間\s*\d{1,2}[點点]` | `時間14點` |
| `時間\s*\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}` | `時間09:00-12:00` |
| `時間\s*\d{1,2}:\d{2}` | `時間14:00` |
| `\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}` | `14:00-17:00` |

The first matching line wins. The extracted value is the content after `時間`, e.g. `09點-12點`.

A line is considered a "time line" if it contains `時間` or `\d{1,2}:\d{2}`.

---

## Step 5 — Extract Location

The **first body line that is not a time line** is treated as the location. Parentheses `（）()` and square brackets `【】` are stripped.

```
"復旦國小"         →  location: "復旦國小"
"（地點：平鎮分局）" →  location: "地點：平鎮分局"
```

---

## Fallback Behaviour

| Field | When Not Found |
|-------|---------------|
| Date | Empty string — card shows "未偵測到日期" |
| Time | Empty string — card shows "未偵測到時間" |
| Location | Empty string — card shows "未偵測到地點" |
| Title | `（無標題）` |

---

## Limitations (v1)

- Requires date to be in the title line to start a new event.
- Does not handle year — assumes current year.
- Does not understand conversational or sentence-form messages.
- No support for recurring events.
