---
name: FinancialItem 資料架構
description: Reminder 多筆款項（v2）設計原則：FinancialItem[] 與 Finance Record 分離；舊欄位 backward compat；確認收款/付款流程
---

## 核心概念

- `FinancialItem` = 預計收付款（待收 / 待付）
- `FinanceEntry` = 實際發生的收入 / 支出（在 financeStore 中，用 sourceReminderId 關聯）
- 兩者**完全分離**。FinancialItem 透過「確認收款/付款」流程才會建立對應的 FinanceEntry

## 型別位置

```
artifacts/lifepilot/src/store.ts
```
- `FinancialItem` interface（id / title / type / amount / dueDate? / note? / completed? / completedDate?）
- `Reminder.financialItems?: FinancialItem[]`

```
artifacts/lifepilot/src/financeStore.ts
```
- `FinanceEntry.sourceFinancialItemId?: string` — 追蹤此 FinanceEntry 由哪筆 FinancialItem 觸發

## Backward Compat 策略（`deriveFinancialItems` in EditPage.tsx）

優先順序（由高到低）：
1. `reminder.financialItems` 非空 → 直接使用
2. `financialStatus = receivable/payable` + `expectedAmount > 0` → 產生一筆虛擬 item（記憶體）
3. `type === "Payment"` + `amount` 存在 → 產生一筆 payable item
4. `type === "Airport Transfer"` + `amount` 存在 → 產生一筆 receivable item

**Why:** 避免每次進入 EditPage 都重複 push 新 item；migration 只在使用者點「儲存」或「確認收款/付款」時發生。

## 確認收款/付款流程（防重複記帳）

1. 點擊 FinancialItemRow 左側狀態圓圈 → `handleStartConfirm(item)`
2. Inline 表單展開（實收/實付金額、日期、備註）
3. 按「確認已收款/付款」→ `handleConfirmItem(item)`：
   - 建立 `FinanceEntry`，帶 `sourceFinancialItemId = item.id`
   - 更新 `financialItems`：`item.completed = true`、`item.completedDate`
   - **立即呼叫 `updateReminder(reminder.id, { financialItems })`** 寫入 localStorage（不等使用者按儲存）

防重複雙保險：
- `item.completed === true` → 圓圈不可點擊
- `linkedFinance.some(e => e.sourceFinancialItemId === item.id)` → handler 最前端 guard 退出

## handleSave 行為

儲存時：
- `financialItems: items.length > 0 ? items : undefined`
- 清除舊欄位：`financialStatus: undefined, expectedAmount: undefined, financialDueDate: undefined`
- Payment backward compat：`dueDate` ← 第一個 payable item 的 dueDate
- AirportTransfer backward compat：`amount` ← 第一個 receivable item 的 amount

## RemindersPage 摘要

使用 `getFinancialItemTotals(reminder)` 計算 receivable / payable 合計（也含 legacy compat）。
顯示「待收 NT$X」和「待付 NT$X」分開，不與 Finance Record 合計混合。
