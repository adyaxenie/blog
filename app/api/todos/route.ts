import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/adminAuth";
import {
  WorkspaceStoreError,
  isWorkspaceConfigured,
  loadWorkspace,
  saveWorkspace,
} from "@/lib/workspaceStore";

export const dynamic = "force-dynamic";

// Public todos JSON (backward compat). GET is open; PUT requires admin session
// or x-update-key matching DASHBOARD_PASSWORD.

type Todo = { id: string; text: string; done: boolean; createdAt: number };

const MAX_ITEMS = 500;
const MAX_TEXT = 1000;

export async function GET() {
  if (!isWorkspaceConfigured()) {
    return NextResponse.json({
      configured: false,
      todos: [],
      error: "WORKSPACE_GITHUB_TOKEN not set",
    });
  }
  try {
    const ws = await loadWorkspace();
    const todos: Todo[] = ws.todos.map((t) => ({
      id: t.id,
      text: t.text,
      done: t.done,
      createdAt: t.createdAt,
    }));
    return NextResponse.json({ configured: true, todos });
  } catch (e) {
    return NextResponse.json(
      {
        configured: false,
        todos: [],
        error: `Todos store unavailable: ${String(e).slice(0, 160)}`,
      },
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

  const items: Todo[] = [];
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
    const ws = await loadWorkspace();
    ws.todos = items.map((t) => ({ ...t, source: "manual" as const }));
    await saveWorkspace(ws);
    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    if (e instanceof WorkspaceStoreError && !e.configured) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 503 });
  }
}
