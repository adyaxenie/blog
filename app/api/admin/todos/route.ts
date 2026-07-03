import { NextRequest, NextResponse } from "next/server";
import {
  WorkspaceStoreError,
  loadWorkspace,
  newWorkspaceId,
  saveWorkspace,
} from "@/lib/workspaceStore";

export const dynamic = "force-dynamic";

const MAX_TEXT = 1000;

function serializeTodo(t: { id: string; text: string; done: boolean; source?: string; createdAt: number }) {
  return {
    id: t.id,
    text: t.text,
    done: t.done,
    source: t.source ?? "manual",
    createdAt: t.createdAt,
  };
}

// GET /api/admin/todos → { todos: [...] }  (backward compat for Claude cron jobs)
export async function GET() {
  try {
    const ws = await loadWorkspace();
    return NextResponse.json({ todos: ws.todos.map(serializeTodo) });
  } catch (e) {
    if (e instanceof WorkspaceStoreError && !e.configured) {
      return NextResponse.json({ todos: [], error: e.message }, { status: 503 });
    }
    return NextResponse.json({ todos: [], error: String(e).slice(0, 160) }, { status: 503 });
  }
}

// POST /api/admin/todos — proxy append to workspace todos
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
    const ws = await loadWorkspace();
    const open = new Set(ws.todos.filter((t) => !t.done).map((t) => t.text));
    const now = Date.now();
    let inserted = 0;
    for (const text of clean) {
      const t = text.slice(0, MAX_TEXT);
      if (open.has(t)) continue;
      open.add(t);
      ws.todos.unshift({ id: newWorkspaceId(), text: t, done: false, source, createdAt: now + inserted });
      inserted++;
    }
    await saveWorkspace(ws);
    return NextResponse.json({
      inserted,
      skippedDuplicates: clean.length - inserted,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 503 });
  }
}

// PATCH /api/admin/todos  Body: { id: string, done: boolean }
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
    const ws = await loadWorkspace();
    const item = ws.todos.find((t) => t.id === body.id);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    item.done = body.done;
    await saveWorkspace(ws);
    return NextResponse.json({ updated: 1 });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 503 });
  }
}

// DELETE /api/admin/todos  Body: { id: string }
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
    const ws = await loadWorkspace();
    const before = ws.todos.length;
    ws.todos = ws.todos.filter((t) => t.id !== body.id);
    await saveWorkspace(ws);
    return NextResponse.json({ deleted: before - ws.todos.length });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 503 });
  }
}
