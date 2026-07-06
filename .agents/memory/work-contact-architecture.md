---
name: WorkProfile 聯絡人與自訂欄位架構
description: WorkContact 型別存放位置、Reminder 關聯方式、WorkProfilesPage 新區段設計
---

## WorkContact 存放位置
- `WorkProfile.contacts?: WorkContact[]` — 聯絡人直接存在 WorkProfile 物件內（非獨立 store）
- LocalStorage key 不變：`lifepilot_work_profiles_v1`

## WorkContact 型別（workProfileStore.ts）
- `WorkContactType`: "客戶" | "聯絡人" | "供應商" | "合作夥伴" | "其他"
- `WorkContactField`: `{ id, label, value }` — 聯絡人自訂欄位（成對結構）
- `WorkContact`: `{ id, type, name, company?, role?, phone?, address?, note?, customFields?, createdAt }`

## Reminder 關聯方式
- `Reminder.contactId?: string` — 儲存 WorkContact.id
- 切換工作資料板時，contactId 自動清除（在 handleWorkProfileChange 中）
- EditPage.tsx：當選定工作資料板有 contacts 時，自動顯示聯絡人 dropdown

## WorkProfilesPage.tsx 四個區段
1. **基本資料** — system_suggested WorkFields，`SystemFieldRow`（label 唯讀）
2. **自訂欄位** — user_custom WorkFields，`CustomFieldRow`（含明確「標題」/「內容」label）
3. **聯絡人/客戶** — `ContactCard`（列表） + `ContactEditForm`（inline add/edit）
4. **啟用狀態** — toggle

## SavePayload 型別
`type SavePayload = Omit<WorkProfile, "id" | "createdAt" | "updatedAt">`
— 自動包含 contacts（因為 WorkProfile 有 contacts 欄位），不需額外修改

## 向後相容
- `legacyDataToFields` 與 `initFieldsForProfile` 完全保留
- 現有機場接送資料不受影響

**Why:**
contacts 存在 WorkProfile 內（而非獨立 store）讓資料自包含，
一次 save/load 即可取得完整工作資料，不需 join 操作。
