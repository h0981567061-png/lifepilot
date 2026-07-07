---
name: FinancialItem 資料架構
description: Reminder 多筆款項（v2）設計原則：FinancialItem[] 與 Finance Record 分離；舊欄位 backward compat；確認收款/付款流程；月份過濾規則；刪除確認流程
---

## 核心概念

- `FinancialItem` = 預計收付款（待收 / 待付），存在 `Reminder.financialItems[]` 內
- `FinanceEntry` = 實際發生的收入 / 支出（在 financeStore 中，用 sourceReminderId 關聯）
- 兩者**完全分離**。FinancialItem 透過「確認收款/付款」流程才會建立對應的 FinanceEntry
- **單一資料來源**：RemindersPage（FinancialSummary）和 FinancePage 都讀同一個 `Reminder.financialItems[]`

## 型別位置

```
artifacts/lifepilot/src/store.ts
```
- `FinancialItem` interface（id / title / type / amount / dueDate? / note? / completed? / completedDate?）
- `Reminder.financialItems?: FinancialItem[]`
- `runFinancialItemMigration()` — 一次性把舊 amount/financialStatus 欄位搬到 financialItems[]

```
artifacts/lifepilot/src/financeStore.ts
```
- `FinanceEntry.sourceFinancialItemId?: string` — 追蹤此 FinanceEntry 由哪筆 FinancialItem 觸發

## Backward Compat 策略（`deriveFinancialItems` / `getDisplayFinancialItems`）

優先順序（由高到低）：
1. `reminder.financialItems` 非空 → 直接使用
2. `financialStatus = receivable/payable` + `expectedAmount > 0` → 產生一筆虛擬 item（記憶體）
3. `type === "Payment"` + `amount` 存在 → 產生一筆 payable item
4. `type === "Airport Transfer"` + `amount` 存在 → 產生一筆 receivable item

**Why:** 避免每次進入 EditPage 都重複 push 新 item；新資料全走 financialItems[]。

## Legacy Migration（store.ts: runFinancialItemMigration）

- 版本 key：`lifepilot_migration_fi_v1` in localStorage → 只跑一次
- 在 App.tsx `savedReminders` 的 useState lazy initializer 中呼叫，確保 app 啟動時自動遷移
- 遷移舊 amount/financialStatus → 建立真實 FinancialItem（ID: `migrated-{reminderId}-{suffix}`）

## 月份過濾規則（FinancePage.tsx: monthReceivable / monthPayable）

**Why:** 原本用 `fi.dueDate || reminder.date` 過濾，導致沒有明確收款日的款項只出現在事項當月，
下個月收支頁就看不到（「Reminder Card 顯示待收，收支頁顯示 0」的根因）。

**How to apply:**
```typescript
// 有明確 dueDate → 只出現在該月
if (r.item.dueDate) return r.item.dueDate.startsWith(prefix);
// 無 dueDate → 從事項月份往後「carry forward」直到被確認
const m = r.reminder.date?.substring(0, 7) ?? "";
return !m || m <= prefix;
```

**排序 sortDate 不變**：仍用 `r.item.dueDate || r.reminder.date`（只影響列表排序，不影響月份過濾）。

## AI 解析 → FinancialItem 建立規則（App.tsx: mapAIEvents）

- Airport Transfer：有金額 → `type: "receivable"`，`dueDate = 事項日期`，清空 `item.amount`
- Income / Work / Course：有金額 → `type: "receivable"`
- Payment / Medical / Shopping / Expense：有金額 → `type: "payable"`
- General / Family / Pending：不自動建立（型別不明確）
- 所有新建 FinancialItem 建立後都會清空 `item.amount`，避免 legacy 路徑重複計算

## 確認收款/付款流程（防重複記帳）

FinancePage 的 handleConfirm：
1. 建立 `FinanceEntry`，帶 `sourceFinancialItemId = item.id`
2. 更新 `financialItems`：`item.completed = true`、`item.completedDate`
3. 清除舊欄位（financialStatus / expectedAmount / financialDueDate）

getPendingItems 雙重過濾：
- `!i.completed` — 已完成的不再顯示為 pending
- `!confirmedIds.has(i.id)` — 已有 FinanceEntry 關聯的也排除

## 刪除 Reminder 確認流程（App.tsx: handleDeleteReminder / handleDeleteFromEdit）

觸發條件（**任一**）：
- 有關聯 FinanceEntries（已確認收支，`sourceReminderId === id`）
- 有未完成 FinancialItems（`financialItems.some(fi => !fi.completed)`）

Dialog 行為：
- `linkedCount > 0`（有已確認收支）→ 三選一：一併刪除 / 保留收支僅刪事項 / 取消
- 只有 pending items（`linkedCount === 0`）→ 二選一：確定刪除 / 取消

**刪除 FinancialItem（不刪 Reminder）**：在 EditPage 的 handleDeleteItem 中移除 item 後儲存，Reminder 不受影響。

## handleSave 行為（EditPage）

儲存時：
- `financialItems: items.length > 0 ? items : undefined`
- 清除舊欄位：`financialStatus: undefined, expectedAmount: undefined, financialDueDate: undefined`
- Payment backward compat：`dueDate` ← 第一個 payable item 的 dueDate
- AirportTransfer backward compat：`amount` ← 第一個 receivable item 的 amount
