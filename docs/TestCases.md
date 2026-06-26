# LifePilot — Parser Test Cases

Each test case shows the raw input text and the expected output (array of event objects).

---

## TC-01 — Basic three-event input (canonical example)

**Input:**
```
美術班 7/30
復旦國小
（時間09點-12點）

福爾 7/21
平鎮分局
（時間09點-12點）

桌球7/20-7/24
平興國小
（時間14點-17點）
```

**Expected output:**

| # | Title | Date | Time | Location |
|---|-------|------|------|----------|
| 1 | 美術班 | 7/30 | 09點-12點 | 復旦國小 |
| 2 | 福爾 | 7/21 | 09點-12點 | 平鎮分局 |
| 3 | 桌球 | 7/20-7/24 | 14點-17點 | 平興國小 |

---

## TC-02 — No blank lines between events

**Input:**
```
美術班 7/30
復旦國小
（時間09點-12點）
福爾 7/21
平鎮分局
（時間09點-12點）
```

**Expected output:**

| # | Title | Date | Time | Location |
|---|-------|------|------|----------|
| 1 | 美術班 | 7/30 | 09點-12點 | 復旦國小 |
| 2 | 福爾 | 7/21 | 09點-12點 | 平鎮分局 |

---

## TC-03 — Date range with partial end (no month repeat)

**Input:**
```
游泳課 7/5-10
市立游泳池
（時間10點-12點）
```

**Expected output:**

| # | Title | Date | Time | Location |
|---|-------|------|------|----------|
| 1 | 游泳課 | 7/5-10 | 10點-12點 | 市立游泳池 |

---

## TC-04 — Time in HH:MM format

**Input:**
```
英文課 8/3
康橋補習班
時間14:00-16:00
```

**Expected output:**

| # | Title | Date | Time | Location |
|---|-------|------|------|----------|
| 1 | 英文課 | 8/3 | 14:00-16:00 | 康橋補習班 |

---

## TC-05 — Title immediately adjacent to date (no space)

**Input:**
```
桌球7/20-7/24
平興國小
（時間14點-17點）
```

**Expected output:**

| # | Title | Date | Time | Location |
|---|-------|------|------|----------|
| 1 | 桌球 | 7/20-7/24 | 14點-17點 | 平興國小 |

---

## TC-06 — Single event

**Input:**
```
畫畫課 9/1
社區活動中心
（時間13點-15點）
```

**Expected output:**

| # | Title | Date | Time | Location |
|---|-------|------|------|----------|
| 1 | 畫畫課 | 9/1 | 13點-15點 | 社區活動中心 |

---

## TC-07 — Missing time field

**Input:**
```
親師座談 10/5
中正國小禮堂
```

**Expected output:**

| # | Title | Date | Time | Location |
|---|-------|------|------|----------|
| 1 | 親師座談 | 10/5 | _(empty)_ | 中正國小禮堂 |

---

## TC-08 — Missing location field

**Input:**
```
音樂發表會 11/2
（時間14點-16點）
```

**Expected output:**

| # | Title | Date | Time | Location |
|---|-------|------|------|----------|
| 1 | 音樂發表會 | 11/2 | 14點-16點 | _(empty)_ |

---

## TC-09 — Empty input

**Input:** _(empty string)_

**Expected output:** Error message shown — "請先貼上 LINE 訊息內容。"

---

## TC-10 — Input with no date lines (no valid header)

**Input:**
```
復旦國小
（時間09點-12點）
```

**Expected output:** Zero cards shown — "未找到任何活動，請確認每個活動標題包含日期（如：美術班 7/30）"
