---
name: Finance-Reminder 同步關鍵規則
description: FinancialItem.dueDate 必須有值；monthReceivable 篩選邏輯；刪除確認 modal
---

## 規則

### 1. FinancialItem 必須有 dueDate
- `mapAIEvents` 建立 Airport Transfer 的 `FinancialItem` 時，設 `dueDate: _startDateNorm || undefined`
- `buildNewReminders` 保存時，對每個 FinancialItem：`dueDate: fi.dueDate || item.date || undefined`
- 缺少 dueDate 會讓整筆款項在所有月份視圖中消失

### 2. FinancePage monthReceivable/monthPayable 篩選用 effective date
```ts
const eff = r.item.dueDate || r.reminder.date;
return eff?.startsWith(prefix);
```
- 不能只用 `r.item.dueDate?.startsWith(prefix)`——沒有 dueDate 就永遠不出現

### 3. listItems sortDate 同樣用 effective date
```ts
sortDate: r.item.dueDate || r.reminder.date || ""
```

### 4. 刪除 reminder 時若有關聯 FinanceEntry
- 顯示 `deleteFinancePrompt` modal，提供兩個選項：
  - 「一併刪除關聯收支」→ filter out entries
  - 「保留收支紀錄，僅刪除事項」→ unlink only (sourceReminderId = undefined)
- 不可靜默處理

**Why:** FinancialItem 是「待確認款項」，FinanceEntry 是「已確認款項」。待確認款項的月份歸屬取決於事件日期，而非單純的 dueDate 存在與否。
