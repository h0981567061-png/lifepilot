# LifePilot — Product Requirements Document

## Overview

LifePilot is a frontend-only web application that lets users paste raw LINE messages and automatically extract structured event information (title, date, time, location) into interactive cards.

---

## Goals

- Make it effortless to turn informal LINE messages into structured events.
- Require zero setup, no login, no backend.
- Support Traditional Chinese text natively.

---

## Users

- Parents managing children's activity schedules shared via LINE group chats.
- Students tracking class and club schedules forwarded through LINE.
- Anyone who receives event information in unstructured LINE messages.

---

## Core Features

### 1. Message Input
- A large textarea where the user pastes raw LINE message text.
- Placeholder text shows a realistic example of the expected format.

### 2. Analyze Button
- A single "Analyze" button triggers the local parser.
- No network request is made.

### 3. Event Cards
Each parsed event displays as a card with:
- **Title** — the activity name extracted from the header line.
- **Date** — extracted date or date range (e.g. `7/30`, `7/20-7/24`).
- **Time** — extracted time range (e.g. `09點-12點`).
- **Location** — the venue or address following the title line.
- **Checkbox: 保存在 LifePilot** — checked by default.
- **Checkbox: 加入行事曆** — unchecked by default.

### 4. Create Button
- Appears below the cards after analysis.
- Confirms how many events are saved and/or added to calendar.

---

## Non-Goals (v1)

- No AI or external API calls.
- No user accounts or persistence.
- No backend server.
- No calendar integration (export planned for future).

---

## Design

- Dark theme (`bg-gray-950`).
- Single-column layout, max width 2xl, centered.
- Blue primary action button (`bg-blue-600`).
- Cards with subtle border and hover highlight.
- All UI text in Traditional Chinese.
