// ─── AI Parser — calls the /api/parse backend endpoint ────────────────────
//
// The frontend never touches OPENAI_API_KEY.
// The API server reads OPENAI_API_KEY from its environment and proxies the call.
// If the server is unavailable, returns 503, or returns malformed JSON,
// the caller (App.tsx) falls back to local rule-based parsers.

export interface AIEvent {
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

export interface AIParseResult {
  events: AIEvent[];
}

/**
 * Always returns true — the frontend no longer checks for an API key.
 * The server handles key presence; if the key is missing the endpoint
 * returns 503 and App.tsx falls back to rule parsers automatically.
 */
export function isAIConfigured(): boolean {
  return true;
}

/**
 * POST /api/parse with the user's text.
 * The server calls OpenAI, validates the JSON, and returns structured events.
 * Throws on any non-2xx response or malformed payload so the caller can
 * fall back to local rule-based parsers.
 */
export async function parseWithAI(text: string): Promise<AIParseResult> {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    let message = `Server returned ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore JSON parse failure, keep status-code message
    }
    throw new Error(message);
  }

  const data: unknown = await response.json();

  if (!validateAIResult(data)) {
    throw new Error("Server response missing required shape (events array)");
  }

  return data;
}

// ─── Validator ──────────────────────────────────────────────────────────────

/** Type-guard: checks that data has the minimum required shape. */
export function validateAIResult(data: unknown): data is AIParseResult {
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
