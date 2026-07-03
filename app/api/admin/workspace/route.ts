import { NextRequest, NextResponse } from "next/server";
import {
  WorkspaceStoreError,
  isWorkspaceConfigured,
  loadWorkspace,
  newWorkspaceId,
  saveWorkspace,
  type WorkspaceData,
} from "@/lib/workspaceStore";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 500;
const MAX_TEXT = 1000;
const SEVERITIES = new Set(["kill", "scale", "test", "info"]);

function serialize(ws: WorkspaceData) {
  return {
    configured: isWorkspaceConfigured(),
    todos: ws.todos,
    actions: ws.actions,
    formats: ws.formats,
    updatedAt: ws.updatedAt,
  };
}

function unavailable(e: unknown) {
  if (e instanceof WorkspaceStoreError && !e.configured) {
    return NextResponse.json(
      { configured: false, todos: [], actions: [], formats: [], updatedAt: 0, error: e.message },
      { status: 503 }
    );
  }
  return NextResponse.json(
    { configured: isWorkspaceConfigured(), error: String(e).slice(0, 160) },
    { status: 503 }
  );
}

export async function GET() {
  try {
    return NextResponse.json(serialize(await loadWorkspace()));
  } catch (e) {
    return unavailable(e);
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
    const ws = await loadWorkspace();

    if (Array.isArray(body.todos)) {
      const open = new Set(ws.todos.filter((t) => !t.done).map((t) => t.text));
      for (const raw of body.todos.filter((t: unknown) => typeof t === "string").slice(0, 25)) {
        const text = raw.trim().slice(0, MAX_TEXT);
        if (!text || open.has(text)) continue;
        open.add(text);
        ws.todos.unshift({ id: newWorkspaceId(), text, done: false, source, createdAt: now });
        appended++;
      }
    }

    if (Array.isArray(body.actions)) {
      for (const a of body.actions.filter((x: any) => x && typeof x.title === "string").slice(0, 25)) {
        ws.actions.unshift({
          id: newWorkspaceId(),
          severity: SEVERITIES.has(a.severity) ? a.severity : "info",
          title: String(a.title).slice(0, MAX_TEXT),
          detail: typeof a.detail === "string" ? a.detail.slice(0, MAX_TEXT) : "",
          source: "claude",
          createdAt: now,
        });
        appended++;
      }
    }

    if (Array.isArray(body.formats)) {
      const existing = new Set(ws.formats.map((f) => f.text));
      for (const raw of body.formats.filter((f: unknown) => typeof f === "string").slice(0, 25)) {
        const text = raw.trim().slice(0, MAX_TEXT);
        if (!text || existing.has(text)) continue;
        existing.add(text);
        ws.formats.unshift({ id: newWorkspaceId(), text, done: false, source, createdAt: now });
        appended++;
      }
    }

    if (appended === 0) {
      return NextResponse.json(
        { error: "provide { todos?: string[], actions?: [], formats?: string[] }" },
        { status: 400 }
      );
    }

    return NextResponse.json({ appended, ...serialize(await saveWorkspace(ws)) });
  } catch (e) {
    return unavailable(e);
  }
}

export async function PUT(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const ws = await loadWorkspace();
    const now = Date.now();

    if (Array.isArray(body.todos)) {
      if (body.todos.length > MAX_ITEMS) {
        return NextResponse.json({ error: `todos must be ≤${MAX_ITEMS} items` }, { status: 400 });
      }
      ws.todos = body.todos.map((t: any) => ({
        id: typeof t.id === "string" ? t.id.slice(0, 64) : newWorkspaceId(),
        text: String(t.text ?? "").slice(0, MAX_TEXT),
        done: !!t.done,
        source: t.source === "claude" ? "claude" : "manual",
        createdAt: Number(t.createdAt) || now,
      }));
    }

    if (Array.isArray(body.actions)) {
      if (body.actions.length > MAX_ITEMS) {
        return NextResponse.json({ error: `actions must be ≤${MAX_ITEMS} items` }, { status: 400 });
      }
      ws.actions = body.actions.map((a: any) => ({
        id: typeof a.id === "string" ? a.id.slice(0, 64) : newWorkspaceId(),
        severity: SEVERITIES.has(a.severity) ? a.severity : "info",
        title: String(a.title ?? "").slice(0, MAX_TEXT),
        detail: typeof a.detail === "string" ? a.detail.slice(0, MAX_TEXT) : "",
        source: "claude",
        createdAt: Number(a.createdAt) || now,
      }));
    }

    if (Array.isArray(body.formats)) {
      if (body.formats.length > MAX_ITEMS) {
        return NextResponse.json({ error: `formats must be ≤${MAX_ITEMS} items` }, { status: 400 });
      }
      ws.formats = body.formats.map((f: any) => ({
        id: typeof f.id === "string" ? f.id.slice(0, 64) : newWorkspaceId(),
        text: String(f.text ?? "").slice(0, MAX_TEXT),
        done: !!f.done,
        source: f.source === "claude" ? "claude" : "manual",
        createdAt: Number(f.createdAt) || now,
      }));
    }

    return NextResponse.json(serialize(await saveWorkspace(ws)));
  } catch (e) {
    return unavailable(e);
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
  if (!["todos", "actions", "formats"].includes(section) || typeof body.id !== "string") {
    return NextResponse.json({ error: "provide { section, id }" }, { status: 400 });
  }

  try {
    const ws = await loadWorkspace();
    const list: any[] = (ws as any)[section];
    const item = list.find((x) => x.id === body.id);
    if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

    if (typeof body.done === "boolean" && "done" in item) item.done = body.done;
    if (typeof body.text === "string" && "text" in item) item.text = body.text.slice(0, MAX_TEXT);
    if (typeof body.title === "string" && "title" in item) item.title = body.title.slice(0, MAX_TEXT);
    if (typeof body.detail === "string" && "detail" in item) item.detail = body.detail.slice(0, MAX_TEXT);
    if (typeof body.severity === "string" && SEVERITIES.has(body.severity) && "severity" in item) {
      item.severity = body.severity;
    }

    return NextResponse.json(serialize(await saveWorkspace(ws)));
  } catch (e) {
    return unavailable(e);
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
  if (!["todos", "actions", "formats"].includes(section) || typeof body.id !== "string") {
    return NextResponse.json({ error: "provide { section, id }" }, { status: 400 });
  }

  try {
    const ws = await loadWorkspace();
    const list: any[] = (ws as any)[section];
    const before = list.length;
    (ws as any)[section] = list.filter((x) => x.id !== body.id);
    const removed = before - (ws as any)[section].length;
    return NextResponse.json({ removed, ...serialize(await saveWorkspace(ws)) });
  } catch (e) {
    return unavailable(e);
  }
}
