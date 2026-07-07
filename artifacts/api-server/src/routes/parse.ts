import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

// ─── Shared types ───────────────────────────────────────────────────────────

interface AIReminderRule {
  type: "before_start" | "at_start" | "day_before";
  value?: number;       // for before_start
  unit?: "minute" | "hour" | "day"; // for before_start
  time?: string;        // HH:MM, only for day_before with specific time
}

interface AIEvent {
  type: string;
  title: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  flightNumber: string | null;
  transferType: string | null;
  district: string | null;
  vehicleType: string | null;
  price: string | null;
  dueDate: string | null;
  amount: string | null;
  hospital: string | null;
  department: string | null;
  items: string[];
  notes: string | null;
  confidence: number;
  category: string | null;
  source: string | null;
  merchant: string | null;
  // ── Airport Transfer passenger fields ──────────────────────────────────────
  passengerName: string | null;   // 乘客姓名（非司機）
  passengerPhone: string | null;  // 乘客電話（非司機）
  passengerCount: number | null;  // 乘客人數（整數）
  luggage: string | null;         // 行李描述
  destination: string | null;     // 目的地地址
  // ── Airport Transfer driver / dispatch fields ────────────────────────────
  driverName: string | null;      // 司機姓名（工作人員）
  driverPhone: string | null;     // 司機電話
  vehiclePlate: string | null;    // 車牌號碼
  orderCodes: string[];           // 訂單識別碼、授權碼等英數字串（多筆）
  paymentMethod: string | null;   // 付款方式（信用卡／現金／轉帳）
  paymentCondition: string | null; // 付款條件（不簽不收、客下後轉帳…）
  // ── Date range ───────────────────────────────────────────────────────────
  dateMode: "single" | "range";   // 單日 or 日期區間
  endDate: string | null;         // M/D 格式；只有 dateMode="range" 時填寫
  // ── Reminder rules ───────────────────────────────────────────────────────
  reminderRules: AIReminderRule[]; // 提醒規則；「提前X分鐘/小時/天提醒」→ 放這裡，不建立獨立事項
}

interface AIParseResult {
  events: AIEvent[];
}

// ─── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `你是 LifePilot 行程助理。請閱讀使用者的中文訊息，根據語意拆分事項，回傳 JSON。

今天的日期（Asia/Taipei）：{TODAY}

支援的事項類型（type 欄位）：
- Course        課程、補習、才藝、運動（未來要去的）
- Airport Transfer  接送機行程（含航班號）
- Medical       醫療、看診、回診（未來的預約）
- Shopping      購物清單、採購（未來要買的東西）
- Payment       付款、繳費、轉帳（未來必須繳納，有截止日期）
- Income        已發生或確定的收入（薪資、接送費、工作收入、退款）
- Expense       已發生的支出（餐飲、交通、日常消費、娛樂）
- Work          工作事項、會議（非課程非接送）
- Family        家庭事項、家事、親子
- Pending       無法分類

類型區分規則（重要）：
1. Payment vs Expense：
   - Payment = 未來必須繳納的費用（截止日期在未來，如信用卡帳單、電費、停車費）
   - Expense = 已發生的消費（今天或過去花的錢，如剛買了東西、剛吃了飯）
2. Airport Transfer vs Income：
   - Airport Transfer = 接機或送機的工作行程（含航班號、時間、地點）
   - Income = 因接送工作取得的報酬（已實際收到的款項）
   - 若訊息同時含有接送行程和費用：
     * 只建立一個 Airport Transfer 事項
     * 若費用描述為「未來將收款」（如「下週四會轉帳」「費用$X 待匯款」），填入 Airport Transfer 的 amount 欄位，不另建 Income
     * 若費用描述為「已實際收到」，另建 Income 事項
     * 不要同時建立 Airport Transfer 和 Income 來描述同一筆行程費用
3. Course vs Work：
   - Course = 有固定時間表的課程、補習班、才藝班、運動班
   - Work = 工作相關的待辦或會議（通常沒有課程名稱）

解析規則：
1. 不要捏造原文沒有提供的資訊，無法確定的欄位請用 null。
2. 一段訊息可能包含多個不同類型的事項，每個事項獨立一筆。
3. 購物清單中的多個商品合併為一個 Shopping event，商品名稱放入 items 陣列。
4. 同一個醫療預約（日期、時間、醫院、科別、備註）合併為一個 Medical event。
5. 同一筆付款（名稱、截止日期、金額）合併為一個 Payment event。
6. 相對日期（今天、明天、下星期三）請根據上方日期解析，格式為 M/D（例如 7/9）。
7. 時間格式：HH:MM（例如 10:00）。
8. 每個 event 的 confidence 為 0–100 整數。
9. category 欄位：請根據事項內容推測合適的分類，可為 null。
   - Expense 建議分類：餐飲、交通、購物、醫療、娛樂、家庭、工作、帳單
   - Income 建議分類：薪資、接送收入、工作收入、獎金、退款
   - 其他類型建議分類：工作、家庭、小孩、個人、重要、生活
10. source 欄位：僅 Income 類型填寫，表示收入來源（如「接送費」「薪資」）。
11. merchant 欄位：僅 Expense 類型填寫，表示商家或地點名稱。
12. Airport Transfer 詳細解析規則：
    a. passengerName：被接送的「乘客」姓名（非司機）。若原文有「司機 X」，X 是司機工作人員，絕對不是乘客，不得放入 passengerName。
    b. passengerPhone：乘客的聯絡電話（非司機電話）。
    c. passengerCount：乘客人數（整數，如「1人」→ 1），原文無明確資訊則為 null。
    d. luggage：行李描述（如「1件」「2件行李」），原文無則為 null。
    e. location：出發地或機場名稱（如「臺灣桃園國際機場」）。
    f. destination：目的地地址（如「新北市新店區安和路三段111巷7弄1號」）。若原文有「→ 地址」格式，取箭頭右方的地址。
    g. vehicleType：乘客要求的車型（如「舒適五人座」），原文無則為 null。
    h. 司機姓名（如「司機 陳彥翔」）→ 放入 driverName，絕不放入 passengerName。
    i. 司機電話（如「司機電話 0912345678」）→ 放入 driverPhone。
    j. 車牌號碼（如「車牌 RFH-7077」）→ 放入 vehiclePlate。
    k. 訂單識別碼、授權碼等英數字串（如 AR87260623601O、AB8830）→ 全部放入 orderCodes 陣列。
    l. 付款方式（如「信用卡」「現金」「轉帳」）→ 放入 paymentMethod。
    m. 付款條件、簽收條件（如「不簽不收」「客下後轉帳」「下週四會轉帳」）→ 放入 paymentCondition。
    n. amount：若原文明確描述「未來將收到款項」（如「下週四會轉帳，費用$1200」），填入金額數字字串（如 "1200"）。
    o. 條件式現金提醒（如「如客戶有給現金，確認是否為小費」）= 不是財務事項，不得填入 amount，amount 保持 null。
    p. price 欄位：只用於既有報價參考顯示，不用來建立財務事項。若 amount 已填，price 保持 null。
    q. notes 欄位：只保留無對應正式欄位的其他資訊（如作業提醒「出發抵達需回報」、特殊注意「現金可能為小費」）。凡已填入 driverName/vehiclePlate/orderCodes/paymentMethod/paymentCondition 的資訊，不得重複出現在 notes。
13. 日期區間解析規則：
    a. 若訊息包含明確日期範圍，如 7/20-7/24、7/20～7/24、7/20~7/24、7月20日到7月24日、7月20日至7月24日、7/20 到 7/24、7/20 至 7/24 等，則：
       dateMode = "range"，date = 開始日期（M/D），endDate = 結束日期（M/D）
    b. 一般單日事項：dateMode = "single"，endDate = null
    c. 絕對不要將日期範圍文字放入 notes，也不要只取開始日期而忽略結束日期。
    d. 跨年：若結束日期月份顯然早於開始日期月份（如開始 12/30，結束 1/2），仍以原始 M/D 格式回傳，前端會自動處理年份。
    e. 時間區間（如 14:00-17:00）與日期區間是獨立的，分別解析，互不混淆。
    f. 每個 event 的 dateMode 欄位必填，無論是否為範圍。
14. 提醒規則解析（關鍵——必須正確遵守）：
    a. 「提前X分鐘提醒我」「提前X小時通知我」「提前X天提醒」「到時候提醒我」
       「提前半小時提醒」「前一天晚上提醒」等語句，是主事項的附屬提醒設定，
       絕對不得建立成獨立第二個事項。
    b. 提醒語句資料必須放入主事項的 reminderRules 陣列，格式如下：
       提前10分鐘提醒  → {"type":"before_start","value":10,"unit":"minute"}
       提前半小時提醒  → {"type":"before_start","value":30,"unit":"minute"}
       提前1小時提醒   → {"type":"before_start","value":1,"unit":"hour"}
       提前2小時提醒   → {"type":"before_start","value":2,"unit":"hour"}
       提前1天提醒     → {"type":"before_start","value":1,"unit":"day"}
       到時候/事項開始時提醒 → {"type":"at_start"}
       前一天晚上8點提醒 → {"type":"day_before","time":"20:00"}
    c. 提醒觸發時間（如16:00事項提前1小時通知＝觸發時間15:00）是 computed
       notification time，絕對不要把它當成另一個事項的 startTime 或建立獨立事項。
    d. reminderRules 中的提醒語義已結構化，不要在 notes 欄位重複填寫提醒文字。
    e. 例外：若整句主要意圖是「提醒我買X」「提醒我做Y」（沒有附帶的主要事件），
       則整句仍建立事項（title=X），reminderRules = []。
    f. 每個 event 的 reminderRules 欄位必填，無提醒時填 []。

回傳格式（純 JSON，不含說明文字）：
{
  "events": [
    {
      "type": "Medical",
      "title": "帶媽媽看骨科",
      "date": "7/9",
      "startTime": "10:00",
      "endTime": null,
      "location": "桃園榮總",
      "flightNumber": null,
      "transferType": null,
      "district": null,
      "vehicleType": null,
      "price": null,
      "dueDate": null,
      "amount": null,
      "hospital": "桃園榮總",
      "department": "骨科",
      "items": [],
      "notes": "帶媽媽",
      "confidence": 95,
      "category": "家庭",
      "source": null,
      "merchant": null,
      "passengerName": null,
      "passengerPhone": null,
      "passengerCount": null,
      "luggage": null,
      "destination": null,
      "driverName": null,
      "driverPhone": null,
      "vehiclePlate": null,
      "orderCodes": [],
      "paymentMethod": null,
      "paymentCondition": null,
      "dateMode": "single",
      "endDate": null,
      "reminderRules": []
    }
  ]
}`;

// ─── Validator ───────────────────────────────────────────────────────────────

function validateAIResult(data: unknown): data is AIParseResult {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.events)) return false;
  for (const e of d.events) {
    if (!e || typeof e !== "object") return false;
    const ev = e as Record<string, unknown>;
    if (typeof ev.type !== "string") return false;
    if (!Array.isArray(ev.items)) {
      (ev as Record<string, unknown>).items = [];
    }
    if (!Array.isArray(ev.reminderRules)) {
      (ev as Record<string, unknown>).reminderRules = [];
    }
  }
  return true;
}

// ─── Route ───────────────────────────────────────────────────────────────────

const router: IRouter = Router();

router.post("/parse", async (req: Request, res: Response) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "GROQ_API_KEY is not configured on the server" });
    return;
  }

  const { text } = req.body as { text?: unknown };
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text is required and must be a non-empty string" });
    return;
  }

  const todayStr = new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const systemContent = SYSTEM_PROMPT.replace("{TODAY}", todayStr);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const openaiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text().catch(() => "unknown error");
      res.status(502).json({ error: `OpenAI API ${openaiRes.status}: ${errorText}` });
      return;
    }

    const data: unknown = await openaiRes.json();
    const content =
      (data as { choices?: { message?: { content?: string } }[] })
        ?.choices?.[0]?.message?.content;

    if (!content) {
      res.status(502).json({ error: "OpenAI returned empty content" });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      res.status(502).json({ error: "OpenAI returned non-JSON content" });
      return;
    }

    if (!validateAIResult(parsed)) {
      res.status(502).json({ error: "OpenAI JSON missing required shape (events array)" });
      return;
    }

    res.json(parsed);
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: `AI parse failed: ${message}` });
  }
});

export default router;
