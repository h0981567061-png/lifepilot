# LifePilot — Roadmap

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔄 | In Progress |
| 📋 | Planned |
| 💡 | Idea / Under Consideration |

---

## v1 — Local Parser (Current)

- ✅ Dark-theme UI with title, textarea, Analyze button
- ✅ Local parser: splits events by detecting date-in-title lines
- ✅ Extracts title, date, time, location
- ✅ Displays one card per event with checkboxes
- ✅ 建立 button with confirmation alert
- ✅ Placeholder shows realistic sample input
- ✅ All UI in Traditional Chinese

---

## v2 — Export & Calendar

- 📋 Export selected events as `.ics` file (Apple Calendar / Google Calendar compatible)
- 📋 Copy individual event as formatted text
- 📋 "Select All / Deselect All" toggle for cards

---

## v3 — AI-Enhanced Parsing

- 📋 Optional OpenAI integration for freeform, unstructured messages
- 📋 Fallback to local parser when no API key is configured
- 📋 Detect events from conversational text (e.g. "我們下週三在體育館打球")

---

## v4 — Persistence

- 💡 LocalStorage-based event history
- 💡 Saved events list / inbox view
- 💡 Edit individual event fields inline on card

---

## v5 — Sharing & Sync

- 💡 Generate a shareable link for a parsed event set
- 💡 LINE bot integration (receive messages directly, no paste needed)
