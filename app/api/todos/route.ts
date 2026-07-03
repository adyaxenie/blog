import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/adminAuth";
import { ensureSchema, isMysqlConfigured, query } from "@/lib/mysql";

export const dynamic = "force-dynamic";

// Public todos JSON. GET is open; PUT requires admin session or x-update-key.

type TodoRow = RowDataPacket & {
  id: string;
  text: string;
  done: number;
  created_at: number;
};

const MAX_ITEMS = 500;
const MAX_TEXT = 1000;

export async function GET() {
  if (!isMysqlConfigured()) {
    return NextResponse.json({ configured: false, todos: [], error: "MySQL not configured" });
  }
  try {
    await ensureSchema();
    const rows = await query<TodoRow[]>(
      "SELECT id, text, done, created_at FROM todos ORDER BY done ASC, created_at DESC LIMIT ?",
      [MAX_ITEMS]
    );
    return NextResponse.json({
      configured: true,
      todos: rows.map((r) => ({
        id: r.id,
        text: r.text,
        done: !!r.done,
        createdAt: Number(r.created_at),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { configured: false, todos: [], error: `Todos store unavailable: ${String(e).slice(0, 160)}` },
      { status: 503 }
    );
  }
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.DASHBOARD_PASSWORD;
  if (!secret) return false;
  const key = req.headers.get("x-update-key") ?? req.nextUrl.searchParams.get("key");
  if (key === secret) return true;
  return verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value, secret);
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { todos?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.todos) || body.todos.length > MAX_ITEMS) {
    return NextResponse.json({ error: `todos must be an array of ≤${MAX_ITEMS} items` }, { status: 400 });
  }

  const items: { id: string; text: string; done: boolean; createdAt: number }[] = [];
  for (const t of body.todos as Record<string, unknown>[]) {
    if (typeof t?.id !== "string" || typeof t?.text !== "string") {
      return NextResponse.json({ error: "each todo needs string id and text" }, { status: 400 });
    }
    items.push({
      id: t.id.slice(0, 64),
      text: t.text.slice(0, MAX_TEXT),
      done: Boolean(t.done),
      createdAt: Number(t.createdAt) || 0,
    });
  }

  try {
    await ensureSchema();
    await query("DELETE FROM todos");
    for (const t of items) {
      await query(
        "INSERT INTO todos (id, text, done, source, created_at) VALUES (?, ?, ?, 'manual', ?)",
        [t.id, t.text, t.done ? 1 : 0, t.createdAt || Date.now()]
      );
    }
    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 503 });
  }
}
