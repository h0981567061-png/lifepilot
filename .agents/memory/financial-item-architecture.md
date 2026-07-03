---
name: FinancialItem 資料架構
description: Reminder 多筆款項（v2）設計原則：FinancialItem[] 與 Finance Record 分離；舊欄位 backward compat 處理方式
---

## 核心概念

- `FinancialItem` = 預計收付款（待收 / 待付）
- `FinanceEntry` = 實際發生的收入 / 支出（在 financeStore 中，用 sourceReminderId 關聯）
- 兩者**完全分離**，永遠不要把 FinancialItem 自動轉成 FinanceEntry

## 型別位置

```
artifacts/lifepilot/src/store.ts
```
- `FinancialItem` interface（id / title / type / amount / dueDate? / note? / completed? / completedDate?）
- `Reminder.financialItems?: FinancialItem[]`

## Backward Compat 策略（`deriveFinancialItems` in EditPage.tsx）

優先順序（由高到低）：
1. `reminder.financialItems` 非空 → 直接使用
2. `financialStatus = receivable/payable` + `expectedAmount > 0` → 產生一筆虛擬 item（記憶體，不寫入）
3. `type === "Payment"` + `amount` 存在 → 產生一筆 payable item
4. `type === "Airport Transfer"` + `amount` 存在 → 產生一筆 receivable item

**Why:** 避免每次進入 EditPage 都重複 push 新 item；migration 只在使用者點「儲存」時發生。

## handleSave 行為

儲存時：
- `financialItems: items.length > 0 ? items : undefined`
- 清除舊欄位：`financialStatus: undefined, expectedAmount: undefined, financialDueDate: undefined`
- Payment backward compat：`dueDate` ← 第一個 payable item 的 dueDate
- AirportTransfer backward compat：`amount` ← 第一個 receivable item 的 amount

## RemindersPage 摘要

使用 `getFinancialItemTotals(reminder)` 計算 receivable / payable 合計（也含 legacy compat）。
顯示「待收 NT$X」和「待付 NT$X」分開，不與 Finance Record 合計混合。

## Checkbox 行為（本階段）

FinancialItemRow 左側是裝飾性圓圈，無點擊功能。
下一階段才實作「確認收款/付款 → 建立 FinanceEntry」。
