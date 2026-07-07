import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ensureSchema, isMysqlConfigured, query } from "@/lib/mysql";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 500;
const MAX_TEXT = 1000;
const SEVERITIES = new Set(["kill", "scale", "test", "info"]);

type TodoRow = RowDataPacket & {
  id: string;
  text: string;
  done: number;
  source: "manual" | "claude";
  created_at: number;
};

type ActionRow = RowDataPacket & {
  id: string;
  severity: "kill" | "scale" | "test" | "info";
  title: string;
  detail: string;
  source: "claude";
  created_at: number;
};

type FormatRow = RowDataPacket & {
  id: string;
  text: string;
  done: number;
  source: "manual" | "claude";
  created_at: number;
};

async function loadAll() {
  await ensureSchema();
  const [todos, actions, formats] = await Promise.all([
    query<TodoRow[]>(
      "SELECT id, text, done, source, created_at FROM todos ORDER BY done ASC, created_at DESC LIMIT ?",
      [MAX_ITEMS]
    ),
    query<ActionRow[]>(
      "SELECT id, severity, title, detail, source, created_at FROM actions ORDER BY created_at DESC LIMIT ?",
      [MAX_ITEMS]
    ),
    query<FormatRow[]>(
      "SELECT id, text, done, source, created_at FROM formats ORDER BY done ASC, created_at DESC LIMIT ?",
      [MAX_ITEMS]
    ),
  ]);
  const updatedAt = Math.max(
    0,
    ...todos.map((r) => Number(r.created_at)),
    ...actions.map((r) => Number(r.created_at)),
    ...formats.map((r) => Number(r.created_at))
  );
  return {
    configured: isMysqlConfigured(),
    todos: todos.map((r) => ({
      id: r.id,
      text: r.text,
      done: !!r.done,
      source: r.source ?? "manual",
      createdAt: Number(r.created_at),
    })),
    actions: actions.map((r) => ({
      id: r.id,
      severity: r.severity,
      title: r.title,
      detail: r.detail,
      source: "claude" as const,
      createdAt: Number(r.created_at),
    })),
    formats: formats.map((r) => ({
      id: r.id,
      text: r.text,
      done: !!r.done,
      source: r.source ?? "manual",
      createdAt: Number(r.created_at),
    })),
    updatedAt,
  };
}

function dbError(e: unknown) {
  if (!isMysqlConfigured()) {
    return NextResponse.json(
      { configured: false, todos: [], actions: [], formats: [], updatedAt: 0, error: "MySQL not configured" },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 503 });
}

export async function GET() {
  try {
    return NextResponse.json(await loadAll());
  } catch (e) {
    return dbError(e);
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const source: "manual" | "claude" = body.source === "claude" ? "claude" : "manual";
  const now = Date.now();
  let appended = 0;

  try {
    await ensureSchema();

    if (Array.isArray(body.todos)) {
      const texts = body.todos
        .filter((t: unknown) => typeof t === "string")
        .map((t: string) => t.trim().slice(0, MAX_TEXT))
        .filter(Boolean)
        .slice(0, 25);
      if (texts.length) {
        const placeholders = texts.map(() => "?").join(", ");
        const existing = await query<TodoRow[]>(
          `SELECT text FROM todos WHERE done = 0 AND text IN (${placeholders})`,
          texts
        );
        const open = new Set(existing.map((r) => r.text));
        for (const text of texts) {
          if (open.has(text)) continue;
          open.add(text);
          await query(
            "INSERT INTO todos (id, text, done, source, created_at) VALUES (?, ?, 0, ?, ?)",
            [crypto.randomUUID(), text, source, now + appended]
          );
          appended++;
        }
      }
    }

    if (Array.isArray(body.actions)) {
      for (const a of body.actions.filter((x: any) => x && typeof x.title === "string").slice(0, 25)) {
        await query(
          "INSERT INTO actions (id, severity, title, detail, source, created_at) VALUES (?, ?, ?, ?, 'claude', ?)",
          [
            crypto.randomUUID(),
            SEVERITIES.has(a.severity) ? a.severity : "info",
            String(a.title).slice(0, MAX_TEXT),
            typeof a.detail === "string" ? a.detail.slice(0, MAX_TEXT) : "",
            now + appended,
          ]
        );
        appended++;
      }
    }

    if (Array.isArray(body.formats)) {
      const texts = body.formats
        .filter((f: unknown) => typeof f === "string")
        .map((f: string) => f.trim().slice(0, MAX_TEXT))
        .filter(Boolean)
        .slice(0, 25);
      if (texts.length) {
        const existing = await query<FormatRow[]>("SELECT text FROM formats");
        const seen = new Set(existing.map((r) => r.text));
        for (const text of texts) {
          if (seen.has(text)) continue;
          seen.add(text);
          await query(
            "INSERT INTO formats (id, text, done, source, created_at) VALUES (?, ?, 0, ?, ?)",
            [crypto.randomUUID(), text, source, now + appended]
          );
          appended++;
        }
      }
    }

    if (appended === 0) {
      return NextResponse.json(
        { error: "provide { todos?: string[], actions?: [], formats?: string[] }" },
        { status: 400 }
      );
    }

    return NextResponse.json({ appended, ...(await loadAll()) });
  } catch (e) {
    return dbError(e);
  }
}

export async function PATCH(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const section = body.section;
  if (!["todos", "formats"].includes(section) || typeof body.id !== "string") {
    return NextResponse.json({ error: "provide { section: todos|formats, id, done? }" }, { status: 400 });
  }
  if (typeof body.done !== "boolean") {
    return NextResponse.json({ error: "provide { done: boolean }" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const table = section as "todos" | "formats";
    const result = await query<ResultSetHeader>(
      `UPDATE ${table} SET done = ? WHERE id = ?`,
      [body.done ? 1 : 0, body.id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "item not found" }, { status: 404 });
    }
    return NextResponse.json(await loadAll());
  } catch (e) {
    return dbError(e);
  }
}

export async function DELETE(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const section = body.section;
  if (section === "actions" && body.clearAll === true) {
    try {
      await ensureSchema();
      const result = await query<ResultSetHeader>("DELETE FROM actions");
      return NextResponse.json({ removed: result.affectedRows, ...(await loadAll()) });
    } catch (e) {
      return dbError(e);
    }
  }

  if (!["todos", "formats"].includes(section) || typeof body.id !== "string") {
    return NextResponse.json(
      { error: "provide { section: todos|formats, id } or { section: actions, clearAll: true }" },
      { status: 400 }
    );
  }

  try {
    await ensureSchema();
    const table = section as "todos" | "formats";
    const result = await query<ResultSetHeader>(`DELETE FROM ${table} WHERE id = ?`, [body.id]);
    return NextResponse.json({ removed: result.affectedRows, ...(await loadAll()) });
  } catch (e) {
    return dbError(e);
  }
}
