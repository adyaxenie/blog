"use client";

import { useCallback, useEffect, useState } from "react";

type Todo = { id: string; text: string; done: boolean; source: "manual" | "claude"; createdAt: number };
type Action = {
  id: string;
  severity: "kill" | "scale" | "test" | "info";
  title: string;
  detail: string;
  source: "claude";
  createdAt: number;
};
type Format = { id: string; text: string; done: boolean; source: "manual" | "claude"; createdAt: number };

type Workspace = {
  configured?: boolean;
  todos: Todo[];
  actions: Action[];
  formats: Format[];
  updatedAt: number;
  error?: string;
};

const COLLAPSE_KEY = "admin_sidebar_collapsed";

const REC_DOT: Record<Action["severity"], string> = {
  kill: "bg-rose-400",
  scale: "bg-emerald-400",
  test: "bg-sky-400",
  info: "bg-amber-400",
};

function SourceBadge({ source }: { source: "manual" | "claude" }) {
  if (source !== "claude") return null;
  return (
    <span className="shrink-0 rounded border border-violet-500/20 bg-violet-500/10 px-1 py-px text-[9px] uppercase tracking-wider text-violet-300/80">
      claude
    </span>
  );
}

export default function WorkSidebar() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  const fetchWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/workspace");
      const json = await res.json();
      setWs({
        configured: res.ok && json.configured !== false,
        todos: Array.isArray(json.todos) ? json.todos : [],
        actions: Array.isArray(json.actions) ? json.actions : [],
        formats: Array.isArray(json.formats) ? json.formats : [],
        updatedAt: Number(json.updatedAt) || 0,
        error: res.ok ? json.error : json.error ?? `Request failed (${res.status})`,
      });
    } catch {
      setWs({ configured: false, todos: [], actions: [], formats: [], updatedAt: 0 });
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchWorkspace();
    const onFocus = () => void fetchWorkspace();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void fetchWorkspace();
    });
    const id = setInterval(() => void fetchWorkspace(), 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, [fetchWorkspace]);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function patch(section: "todos" | "formats", id: string, done: boolean) {
    if (!ws) return;
    setWs({
      ...ws,
      [section]: ws[section].map((x) => (x.id === id ? { ...x, done } : x)),
    });
    if (section === "todos") {
      await fetch("/api/admin/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done }),
      });
    } else {
      await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, id, done }),
      });
    }
    void fetchWorkspace();
  }

  async function clearActions() {
    if (!ws?.actions.length) return;
    setWs({ ...ws, actions: [] });
    await fetch("/api/admin/workspace", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "actions", clearAll: true }),
    });
    void fetchWorkspace();
  }

  async function remove(section: "todos" | "formats", id: string) {
    if (!ws) return;
    setWs({ ...ws, [section]: ws[section].filter((x) => x.id !== id) });
    if (section === "todos") {
      await fetch("/api/admin/todos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } else {
      await fetch("/api/admin/workspace", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, id }),
      });
    }
    void fetchWorkspace();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const text = taskText.trim();
    if (!text) return;
    setTaskText("");
    await fetch("/api/admin/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    void fetchWorkspace();
  }

  const openTodos = (ws?.todos ?? []).filter((t) => !t.done).length;
  const openFormats = (ws?.formats ?? []).filter((f) => !f.done).length;
  const actionCount = ws?.actions?.length ?? 0;

  if (collapsed) {
    return (
      <aside className="hidden shrink-0 lg:flex lg:w-10">
        <div className="sticky top-6 flex h-[calc(100vh-3rem)] w-10 flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/60 py-3">
          <button
            onClick={toggleCollapse}
            className="text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label="Expand sidebar"
            title="Expand workspace"
          >
            ‹
          </button>
          <div className="mt-4 flex flex-1 flex-col items-center gap-3">
            <span
              className="text-[10px] font-medium uppercase tracking-widest text-zinc-600 [writing-mode:vertical-rl]"
              style={{ transform: "rotate(180deg)" }}
            >
              Work
            </span>
            {openTodos > 0 && (
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
                {openTodos}
              </span>
            )}
            {actionCount > 0 && (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-400/80">
                {actionCount}
              </span>
            )}
            {openFormats > 0 && (
              <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] tabular-nums text-sky-400/80">
                {openFormats}
              </span>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden shrink-0 lg:block lg:w-96">
      <div className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-medium text-zinc-100">Workspace</h2>
          <button
            onClick={toggleCollapse}
            className="text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label="Collapse sidebar"
          >
            ›
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {(ws?.configured === false || ws?.error) && (
            <p className="border-b border-zinc-800 px-4 py-3 text-xs text-amber-400/80">
              {ws?.error ?? "MySQL not configured — check DB_* vars in .env.local"}
            </p>
          )}

          {/* Tasks */}
          <section className="border-b border-zinc-800 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Tasks</h3>
              <span className="text-[10px] text-zinc-600">{openTodos} open</span>
            </div>
            <form onSubmit={addTask} className="mb-3 flex gap-1.5">
              <input
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
                placeholder="Add task…"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
              />
              <button
                type="submit"
                disabled={!taskText.trim()}
                className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
              >
                Add
              </button>
            </form>
            <ul className="space-y-0.5">
              {(ws?.todos ?? []).map((t) => (
                <li
                  key={t.id}
                  className="group flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-800/50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3 w-3 accent-emerald-500"
                    checked={t.done}
                    onChange={() => void patch("todos", t.id, !t.done)}
                  />
                  <span
                    className={`flex-1 text-xs leading-relaxed ${
                      t.done ? "text-zinc-600 line-through" : "text-zinc-300"
                    }`}
                  >
                    {t.text}
                  </span>
                  <SourceBadge source={t.source} />
                  <button
                    className="text-[10px] text-zinc-600 opacity-0 hover:text-zinc-400 group-hover:opacity-100"
                    onClick={() => void remove("todos", t.id)}
                    aria-label="Delete task"
                  >
                    ✕
                  </button>
                </li>
              ))}
              {loaded && (ws?.todos.length ?? 0) === 0 && (
                <li className="px-1.5 py-1 text-xs text-zinc-600">No tasks yet.</li>
              )}
            </ul>
          </section>

          {/* Action queue — Claude-managed */}
          <section className="border-b border-zinc-800 p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Action queue
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600">{actionCount}</span>
                {actionCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void clearActions()}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {(ws?.actions.length ?? 0) === 0 ? (
              <p className="text-xs text-zinc-600">Nothing queued — Claude pushes here.</p>
            ) : (
              <ul className="space-y-2.5">
                {ws!.actions.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${REC_DOT[a.severity]}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200">{a.title}</p>
                      {a.detail && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{a.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Formats to try */}
          <section className="p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Formats to try
              </h3>
              <span className="text-[10px] text-zinc-600">{openFormats} open</span>
            </div>
            <ol className="space-y-2">
              {(ws?.formats ?? []).map((f, i) => (
                <li
                  key={f.id}
                  className="group flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-800/50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3 w-3 accent-emerald-500"
                    checked={f.done}
                    onChange={() => void patch("formats", f.id, !f.done)}
                  />
                  <span
                    className={`flex-1 text-[11px] leading-relaxed ${
                      f.done ? "text-zinc-600 line-through" : "text-zinc-400"
                    }`}
                  >
                    <span className="mr-1 text-zinc-600">{i + 1}.</span>
                    {f.text}
                  </span>
                  <SourceBadge source={f.source} />
                  <button
                    className="text-[10px] text-zinc-600 opacity-0 hover:text-zinc-400 group-hover:opacity-100"
                    onClick={() => void remove("formats", f.id)}
                    aria-label="Delete format"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t border-zinc-800/60 pt-3 text-[10px] leading-relaxed text-zinc-600">
              Film all in one session. Each in its own ABO ad group at $10/day, 48h. Kill under 2.5s
              watch time, promote survivors to the main CBO.
            </p>
          </section>
        </div>
      </div>
    </aside>
  );
}
