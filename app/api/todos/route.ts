import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Public todos JSON. GET is open; PUT requires either a logged-in admin
// session or ?key= / x-update-key matching DASHBOARD_PASSWORD, e.g.:
//   curl -X PUT /api/todos -H "x-update-key: $DASHBOARD_PASSWORD" \
//        -d '{"todos":[{"id":"1","text":"ship it","done":false,"createdAt":0}]}'

type Todo = { id: string; text: string; done: boolean; createdAt: number };
type TodosDoc = { _id: string; items: Todo[]; updatedAt: number };

const MAX_ITEMS = 500;
const MAX_TEXT = 1000;

// One shared client per warm instance (and across HMR reloads in dev).
declare global {
  // eslint-disable-next-line no-var
  var _todosClient: Promise<MongoClient> | undefined;
}

async function todosCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  if (!global._todosClient) {
    global._todosClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
  }
  const client = await global._todosClient;
  return client.db("dailyglow_admin").collection<TodosDoc>("kv");
}

export async function GET() {
  try {
    const coll = await todosCollection();
    const doc = await coll.findOne({ _id: "todos" });
    return NextResponse.json({ configured: true, todos: doc?.items ?? [] });
  } catch (e) {
    // Reset so a transient failure doesn't poison the cached connection.
    global._todosClient = undefined;
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
    const coll = await todosCollection();
    await coll.updateOne(
      { _id: "todos" },
      { $set: { items, updatedAt: Date.now() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    global._todosClient = undefined;
    return NextResponse.json(
      { error: `Todos store unavailable: ${String(e).slice(0, 160)}` },
      { status: 503 }
    );
  }
}
