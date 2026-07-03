import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ensureSchema, isMysqlConfigured, query } from "@/lib/mysql";

export const dynamic = "force-dynamic";

const MAX_TEXT = 1000;

type TodoRow = RowDataPacket & {
  id: string;
  text: string;
  done: number;
  source: "manual" | "claude";
  created_at: number;
};

function serialize(row: TodoRow) {
  return {
    id: row.id,
    text: row.text,
    done: !!row.done,
    source: row.source ?? "manual",
    createdAt: Number(row.created_at),
  };
}

function dbError(e: unknown) {
  if (!isMysqlConfigured()) {
    return NextResponse.json({ todos: [], error: "MySQL not configured" }, { status: 503 });
  }
  return NextResponse.json({ todos: [], error: String(e).slice(0, 160) }, { status: 503 });
}

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<TodoRow[]>(
      "SELECT id, text, done, source, created_at FROM todos ORDER BY done ASC, created_at DESC LIMIT 200"
    );
    return NextResponse.json({ todos: rows.map(serialize) });
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
  const texts: string[] = Array.isArray(body.tasks)
    ? body.tasks
    : typeof body.text === "string"
      ? [body.text]
      : [];

  const clean = texts
    .filter((t) => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 25);

  if (clean.length === 0) {
    return NextResponse.json({ error: "provide { text } or { tasks: string[] }" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const trimmed = clean.map((t) => t.slice(0, MAX_TEXT));
    const placeholders = trimmed.map(() => "?").join(", ");
    const existing = await query<TodoRow[]>(
      `SELECT text FROM todos WHERE done = 0 AND text IN (${placeholders})`,
      trimmed
    );
    const open = new Set(existing.map((r) => r.text));
    const now = Date.now();
    let inserted = 0;

    for (const text of clean) {
      const t = text.slice(0, MAX_TEXT);
      if (open.has(t)) continue;
      open.add(t);
      await query(
        "INSERT INTO todos (id, text, done, source, created_at) VALUES (?, ?, 0, ?, ?)",
        [crypto.randomUUID(), t, source, now + inserted]
      );
      inserted++;
    }

    return NextResponse.json({
      inserted,
      skippedDuplicates: clean.length - inserted,
    });
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
  if (typeof body.id !== "string" || typeof body.done !== "boolean") {
    return NextResponse.json({ error: "provide { id, done }" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const result = await query<ResultSetHeader>(
      "UPDATE todos SET done = ? WHERE id = ?",
      [body.done ? 1 : 0, body.id]
    );
    return NextResponse.json({ updated: result.affectedRows });
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
  if (typeof body.id !== "string") {
    return NextResponse.json({ error: "provide { id }" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const result = await query<ResultSetHeader>("DELETE FROM todos WHERE id = ?", [body.id]);
    return NextResponse.json({ deleted: result.affectedRows });
  } catch (e) {
    return dbError(e);
  }
}
