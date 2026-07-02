"use client";

import { useEffect, useState } from "react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  source: "manual" | "claude";
  createdAt: number;
};

const LEGACY_STORAGE_KEY = "admin_todos";
const MIGRATED_KEY = "admin_todos_migrated";

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/todos");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTodos(data.todos ?? []);
      setError(null);
    } catch {
      setError("Couldn't load todos");
    }
    setLoaded(true);
  }

  useEffect(() => {
    (async () => {
      // One-time migration of old localStorage todos into the API.
      try {
        if (!localStorage.getItem(MIGRATED_KEY)) {
          const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (raw) {
            const legacy = JSON.parse(raw) as { text: string; done: boolean }[];
            const open = legacy.filter((t) => t && !t.done && t.text).map((t) => t.text);
            if (open.length > 0) {
              await fetch("/api/admin/todos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tasks: open }),
              });
            }
          }
          localStorage.setItem(MIGRATED_KEY, "1");
        }
      } catch {
        // migration is best-effort
      }
      await refresh();
    })();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await fetch("/api/admin/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    await refresh();
  }

  async function toggle(t: Todo) {
    setTodos(todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await fetch("/api/admin/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, done: !t.done }),
    });
  }

  async function remove(t: Todo) {
    setTodos(todos.filter((x) => x.id !== t.id));
    await fetch("/api/admin/todos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id }),
    });
  }

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-100">To do</h2>
        <span className="text-xs text-zinc-500">
          {error ? error : `${remaining} open`}
        </span>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600"
          placeholder="Add a task…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-40"
          disabled={!text.trim()}
        >
          Add
        </button>
      </form>
      <ul className="mt-3 space-y-0.5">
        {todos.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800/50"
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-500"
              checked={t.done}
              onChange={() => toggle(t)}
            />
            <span
              className={`flex-1 text-sm ${
                t.done ? "text-zinc-600 line-through" : "text-zinc-300"
              }`}
            >
              {t.text}
            </span>
            {t.source === "claude" && (
              <span className="rounded border border-indigo-900 bg-indigo-950/60 px-1.5 py-0.5 text-[10px] text-indigo-400">
                claude
              </span>
            )}
            <button
              className="text-xs text-zinc-600 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
              onClick={() => remove(t)}
              aria-label="Delete"
            >
              ✕
            </button>
          </li>
        ))}
        {loaded && !error && todos.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-zinc-600">Nothing yet — add your first task.</li>
        )}
      </ul>
    </section>
  );
}
