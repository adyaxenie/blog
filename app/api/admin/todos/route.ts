import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
const { connect, disconnect } = require("../../../../lib/mongodb");

export const dynamic = "force-dynamic";

const DB = "admin_dashboard";
const COLLECTION = "todos";

type TodoDoc = {
  _id?: ObjectId;
  text: string;
  done: boolean;
  source: "manual" | "claude";
  createdAt: number;
};

function serialize(doc: any) {
  return {
    id: doc._id.toString(),
    text: doc.text,
    done: !!doc.done,
    source: doc.source ?? "manual",
    createdAt: doc.createdAt ?? 0,
  };
}

// GET /api/admin/todos → { todos: [...] }
export async function GET() {
  const client = await connect();
  try {
    const todos = await client
      .db(DB)
      .collection(COLLECTION)
      .find({})
      .sort({ done: 1, createdAt: -1 })
      .limit(200)
      .toArray();
    return NextResponse.json({ todos: todos.map(serialize) });
  } finally {
    await disconnect(client);
  }
}

// POST /api/admin/todos
// Body: { text: string } for a single task, or { tasks: string[] } for a batch
// (batch is used by automated pushes, e.g. Claude's daily report).
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const source: TodoDoc["source"] = body.source === "claude" ? "claude" : "manual";
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
    return NextResponse.json(
      { error: "provide { text } or { tasks: string[] }" },
      { status: 400 }
    );
  }

  const now = Date.now();
  const docs: TodoDoc[] = clean.map((text, i) => ({
    text: text.slice(0, 500),
    done: false,
    source,
    // preserve given order when sorted by createdAt desc
    createdAt: now + (clean.length - i),
  }));

  const client = await connect();
  try {
    const col = client.db(DB).collection(COLLECTION);
    // Skip exact-duplicate open tasks (idempotent daily pushes).
    const existing = await col
      .find({ done: false, text: { $in: docs.map((d) => d.text) } })
      .project({ text: 1 })
      .toArray();
    const existingTexts = new Set(existing.map((d: any) => d.text));
    const toInsert = docs.filter((d) => !existingTexts.has(d.text));
    if (toInsert.length > 0) await col.insertMany(toInsert);
    return NextResponse.json({
      inserted: toInsert.length,
      skippedDuplicates: docs.length - toInsert.length,
    });
  } finally {
    await disconnect(client);
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
  let _id: ObjectId;
  try {
    _id = new ObjectId(body.id);
  } catch {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const client = await connect();
  try {
    const r = await client
      .db(DB)
      .collection(COLLECTION)
      .updateOne({ _id }, { $set: { done: body.done } });
    return NextResponse.json({ updated: r.modifiedCount });
  } finally {
    await disconnect(client);
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
  let _id: ObjectId;
  try {
    _id = new ObjectId(body.id);
  } catch {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const client = await connect();
  try {
    const r = await client.db(DB).collection(COLLECTION).deleteOne({ _id });
    return NextResponse.json({ deleted: r.deletedCount });
  } finally {
    await disconnect(client);
  }
}
