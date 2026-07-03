import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

// ─── Shared types ───────────────────────────────────────────────────────────

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
}

interface AIParseResult {
  events: AIEvent[];
}

// ─── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `你是 LifePilot 行程助理。請閱讀使用者的中文訊息，根據語意拆分事項，回傳 JSON。

今天的日期（Asia/Taipei）：{TODAY}

支援的事項類型（type 欄位）：
- Course        課程、補習、才藝、運動
- Airport Transfer  接送機行程（含航班號）
- Medical       醫療、看診、回診
- Shopping      購物清單、採購
- Payment       付款、繳費、轉帳
- Work          工作、會議
- Family        家庭、家事
- Pending       無法分類

解析規則：
1. 不要捏造原文沒有提供的資訊，無法確定的欄位請用 null。
2. 一段訊息可能包含多個不同類型的事項，每個事項獨立一筆。
3. 購物清單中的多個商品合併為一個 Shopping event，商品名稱放入 items 陣列。
4. 同一個醫療預約（日期、時間、醫院、科別、備註）合併為一個 Medical event。
5. 同一筆付款（名稱、截止日期、金額）合併為一個 Payment event。
6. 相對日期（今天、明天、下星期三）請根據上方日期解析，格式為 M/D（例如 7/9）。
7. 時間格式：HH:MM（例如 10:00）。
8. 每個 event 的 confidence 為 0–100 整數。

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
      "confidence": 95
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
  }
  return true;
}

// ─── Route ───────────────────────────────────────────────────────────────────

const router: IRouter = Router();

router.post("/parse", async (req: Request, res: Response) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "OPENAI_API_KEY is not configured on the server" });
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
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
