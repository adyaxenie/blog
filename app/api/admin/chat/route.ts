import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Operator AI chat for the admin dashboard. This route deliberately does NOT
// fetch from any upstream (Supermetrics/RevenueCat/PostHog/MySQL). The client
// passes a `snapshot` built from data already cached in the browser, so asking
// a question never triggers extra metrics calls. The route only runs the LLM
// over the provided JSON.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.5-flash";
const MAX_SNAPSHOT_CHARS = 60_000;
const MAX_MESSAGES = 20;

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are the operator co-pilot embedded in the DailyGlow admin dashboard.
You answer questions about the app's paid-acquisition and revenue performance using ONLY the JSON snapshot provided in the first user message. The snapshot contains whatever the operator has already loaded: an overview (daily brief, economics, TikTok overview, RevenueCat, PostHog, funnel), TikTok creatives, and projections. If a section is missing from the snapshot, say so plainly and tell the operator to open that tab once — never invent numbers.

Style: concise, numbers-first, operator-friendly. Prefer short paragraphs or tight bullet lists. Round money to whole dollars unless precision matters. Always state the time range (days) you are reasoning over.

TikTok attribution context (July 2026): MMP real-time reporting is live — TikTok reports estimated TOTAL conversions, so reported CPA is roughly accurate and about 4-5x lower than the old SKAN era. Never compare against obsolete SKAN benchmarks. Current MMP-era norms: account avg CPA ~$10-11, winner range $7-10, standout under $6.

Decision rules when asked what to kill/scale/test:
- Kill: watch time < 2.5s; 0 conversions after ~$15-20 spend; CPA > $20 (~2x account avg) with 3+ conversions; or a clearly dead ABO test.
- Scale: CPA < $7 with 2+ conversions and real volume.
- Test: new creative/hook variations when the pipeline is empty or a winner fatigues.
- Concentration risk: flag when one creative takes >70% of daily spend.
- CPA fatigue: flag a creative drifting above $15 or having 0-conversion days.

Cross-check TikTok's reported conversions against PostHog installs (blended CAC) when both are present. If the data can't support a claim, say what's missing rather than guessing.`;

function clampSnapshot(snapshot: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(snapshot ?? {});
  } catch {
    json = "{}";
  }
  if (json.length > MAX_SNAPSHOT_CHARS) {
    json = json.slice(0, MAX_SNAPSHOT_CHARS) + '…"[truncated]"';
  }
  return json;
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim();
    if (!text) continue;
    cleaned.push({ role, content: text });
  }
  return cleaned.slice(-MAX_MESSAGES);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: { messages?: unknown; days?: unknown; snapshot?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Expected a non-empty messages array ending with a user message" },
      { status: 400 }
    );
  }

  const days = Number(body.days);
  const daysLabel = Number.isFinite(days) && days > 0 ? `${days} days` : "the selected range";
  const snapshotJson = clampSnapshot(body.snapshot);

  // Prepend the data snapshot as context to the first user message so the model
  // grounds every answer in the operator's already-loaded numbers. Gemini uses
  // "model" for assistant turns.
  const contents = messages.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      {
        text:
          i === 0
            ? `Dashboard data snapshot (time range: ${daysLabel}). Answer using only this data:\n\n${snapshotJson}\n\n---\n\nQuestion: ${m.content}`
            : m.content,
      },
    ],
  }));

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[admin/chat] Gemini ${res.status}: ${detail.slice(0, 1000)}`);
      return NextResponse.json(
        { error: `Gemini request failed (${res.status})`, detail: detail.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      return NextResponse.json(
        { error: `Blocked by safety filter: ${data.promptFeedback.blockReason}` },
        { status: 502 }
      );
    }

    const candidate = data.candidates?.[0];
    const truncated = candidate?.finishReason === "MAX_TOKENS";
    const reply =
      (candidate?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim() || "(no response)";

    return NextResponse.json({ reply, truncated });
  } catch (e) {
    console.error(`[admin/chat] request failed: ${String(e)}`);
    return NextResponse.json(
      { error: `Chat request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
