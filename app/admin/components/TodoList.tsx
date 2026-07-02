"use client";

import { useEffect, useState } from "react";

type Todo = { id: string; text: string; done: boolean; createdAt: number };

const STORAGE_KEY = "admin_todos";

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTodos(JSON.parse(raw));
    } catch {
      // corrupted storage — start fresh
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos, loaded]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setTodos([{ id: crypto.randomUUID(), text: t, done: false, createdAt: Date.now() }, ...todos]);
    setText("");
  }

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-100">To do</h2>
        <span className="text-xs text-zinc-500">{remaining} open</span>
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
              onChange={() =>
                setTodos(todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
              }
            />
            <span
              className={`flex-1 text-sm ${
                t.done ? "text-zinc-600 line-through" : "text-zinc-300"
              }`}
            >
              {t.text}
            </span>
            <button
              className="text-xs text-zinc-600 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
              onClick={() => setTodos(todos.filter((x) => x.id !== t.id))}
              aria-label="Delete"
            >
              ✕
            </button>
          </li>
        ))}
        {loaded && todos.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-zinc-600">Nothing yet — add your first task.</li>
        )}
      </ul>
    </section>
  );
}
