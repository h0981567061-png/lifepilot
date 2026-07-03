---
name: Time/date normalization
description: Shared utils for normalizing time and date strings before storing or displaying — prevents the 21::15 double-colon bug.
---

## Rule
Always pass time values through `normalizeTime()` and date values through `normalizeDate()` (from `src/utils.ts`) before displaying or saving to localStorage. Never use raw `slice(0,2):slice(2)` on time strings.

**Why:** The rule parser stores time as "2115" (4-digit HHMM); the AI parser returns "21:15" (already formatted). The card display code originally did `t.time.slice(0,2)}:{t.time.slice(2)}` which produced "21::15" for AI output. Normalizing on both ingest (mapAIEvents) and display (AirportTransferCard) prevents this.

## How to apply
- `normalizeTime(raw)`: "2115"→"21:15", "21:15"→"21:15", "9:00"→"09:00", Chinese time strings. Returns "" if unparseable — never guesses.
- `normalizeDate(raw)`: "7/15"→"2026-07-15", "YYYY-MM-DD"→pass-through, "YYYY/MM/DD"→"YYYY-MM-DD". Uses current year for M/D. Returns raw if unparseable.
- In `buildNewReminders`: wrap all times/dates with these before saving to Reminder.
- In `mapAIEvents`: normalize date on Airport Transfer ingest.
- `<input type="date">` requires YYYY-MM-DD value — always pass `normalizeDate(field)` as the value.
- Use `style={{ colorScheme: "dark" }}` on date inputs for dark-mode browser calendar picker.
