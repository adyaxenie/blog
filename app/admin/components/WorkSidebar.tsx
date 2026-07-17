"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Maximize2, X } from "lucide-react";
import { peekApiCache } from "./Widgets";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Snapshot sources map cache keys to the exact useApi paths (must match
// verbatim, incl. `?days=N`) so the chat reuses browser-cached payloads and
// never triggers a fresh upstream fetch.
const SNAPSHOT_LABELS: Record<string, string> = {
  brief: "Daily brief",
  economics: "Economics",
  tiktokOverview: "TikTok overview",
  revenuecat: "RevenueCat",
  posthog: "PostHog",
  funnel: "Funnel",
  tiktokCreatives: "TikTok creatives",
  projections: "Projections",
};

// Sections that require opening a specific tab once before they're cached.
const SNAPSHOT_HINT: Record<string, string> = {
  tiktokCreatives: "open TikTok Ads",
  projections: "open Projections",
};

function buildSnapshot(days: number) {
  const sources: { key: keyof typeof SNAPSHOT_LABELS; path: string }[] = [
    { key: "brief", path: "/api/admin/brief" },
    { key: "economics", path: `/api/admin/economics?days=${days}` },
    { key: "tiktokOverview", path: `/api/admin/tiktok?days=${days}` },
    { key: "revenuecat", path: `/api/admin/revenuecat?days=${days}` },
    { key: "posthog", path: `/api/admin/posthog?days=${days}` },
    { key: "funnel", path: `/api/admin/funnel?days=${days}` },
    { key: "tiktokCreatives", path: `/api/admin/tiktok-creatives?days=${days}` },
    { key: "projections", path: "/api/admin/projections" },
  ];
  const snapshot: Record<string, unknown> = {};
  const present: string[] = [];
  const missing: string[] = [];
  for (const s of sources) {
    const hit = peekApiCache(s.path);
    if (hit !== undefined) {
      snapshot[s.key] = hit;
      present.push(s.key);
    } else {
      missing.push(s.key);
    }
  }
  return { snapshot, present, missing };
}

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

// Render inline **bold** spans; everything else stays plain text.
function renderInline(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyBase}-${i}`}>{part}</span>;
  });
}

// Minimal markdown for Gemini replies: #/##/### headings, * or - bullets,
// numbered list lines, blank-line spacing, and inline **bold**.
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
          return (
            <p key={i} className="mt-2 font-semibold text-zinc-100">
              {renderInline(heading[2], `h${i}`)}
            </p>
          );
        }
        const bullet = /^\s*[*-]\s+(.*)$/.exec(line);
        if (bullet) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="select-none text-zinc-600">•</span>
              <span className="flex-1">{renderInline(bullet[1], `b${i}`)}</span>
            </div>
          );
        }
        const numbered = /^\s*(\d+)\.\s+(.*)$/.exec(line);
        if (numbered) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="select-none text-zinc-600">{numbered[1]}.</span>
              <span className="flex-1">{renderInline(numbered[2], `n${i}`)}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        return <p key={i}>{renderInline(line, `p${i}`)}</p>;
      })}
    </div>
  );
}

function ChatThread({
  messages,
  sending,
  error,
  endRef,
  big,
  className,
}: {
  messages: ChatMessage[];
  sending: boolean;
  error: string;
  endRef: React.RefObject<HTMLDivElement>;
  big?: boolean;
  className?: string;
}) {
  const bubble = big ? "px-3 py-2 text-sm" : "px-2.5 py-1.5 text-xs";
  return (
    <div className={`space-y-2 overflow-y-auto pr-1 ${className ?? ""}`}>
      {messages.length === 0 && !sending && (
        <p className={`text-zinc-600 ${big ? "text-sm" : "text-[11px]"} leading-relaxed`}>
          Ask about overview, TikTok ads, or projections.
        </p>
      )}
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div
            key={i}
            className={`ml-6 rounded-lg bg-zinc-800/70 leading-relaxed text-zinc-200 ${bubble}`}
          >
            <span className="whitespace-pre-wrap">{m.content}</span>
          </div>
        ) : (
          <div
            key={i}
            className={`mr-2 rounded-lg border border-zinc-800 bg-zinc-900/70 leading-relaxed text-zinc-300 ${bubble}`}
          >
            <Markdown text={m.content} />
          </div>
        )
      )}
      {sending && (
        <div
          className={`mr-2 rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-500 ${bubble}`}
        >
          Thinking…
        </div>
      )}
      {error && (
        <p className={`text-rose-400/80 leading-relaxed ${big ? "text-xs" : "text-[11px]"}`}>
          {error}
        </p>
      )}
      <div ref={endRef} />
    </div>
  );
}

function ChatComposer({
  value,
  onChange,
  onSubmit,
  sending,
  big,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  sending: boolean;
  big?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex gap-1.5">
      <input
        className={`w-full rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 ${
          big ? "px-3 py-2 text-sm" : "px-2.5 py-1 text-xs"
        }`}
        placeholder="Ask about your metrics…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={sending}
      />
      <button
        type="submit"
        disabled={!value.trim() || sending}
        className={`shrink-0 rounded-lg border border-violet-500/30 bg-violet-500/10 font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-40 ${
          big ? "px-3.5 py-2 text-xs" : "px-2 py-1 text-[10px]"
        }`}
      >
        Send
      </button>
    </form>
  );
}

export default function WorkSidebar({ days }: { days: number }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, chatSending, chatExpanded]);

  useEffect(() => {
    if (!chatExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatExpanded]);

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatSending) return;
    const { snapshot } = buildSnapshot(days);
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatSending(true);
    setChatError("");
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, days, snapshot }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      const content =
        String(json.reply ?? "") + (json.truncated ? "\n\n… (response truncated)" : "");
      setChatMessages((m) => [...m, { role: "assistant", content }]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatSending(false);
    }
  }

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
  const { present: snapshotPresent, missing: snapshotMissing } = buildSnapshot(days);

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
    <>
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

          {/* Ask — operator AI chat over already-loaded dashboard data */}
          <section className="border-b border-zinc-800 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
                <Sparkles className="h-3 w-3 text-violet-300/80" />
                Ask
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600">
                  {snapshotPresent.length}/{snapshotPresent.length + snapshotMissing.length}
                </span>
                <button
                  type="button"
                  onClick={() => setChatExpanded(true)}
                  className="text-zinc-500 transition-colors hover:text-zinc-300"
                  aria-label="Expand chat"
                  title="Expand chat"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {!chatExpanded && (
              <ChatThread
                messages={chatMessages}
                sending={chatSending}
                error={chatError}
                endRef={chatEndRef}
                className="mb-3 max-h-72"
              />
            )}

            <ChatComposer
              value={chatInput}
              onChange={setChatInput}
              onSubmit={sendChat}
              sending={chatSending}
            />

            {snapshotMissing.some((k) => SNAPSHOT_HINT[k]) && (
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
                Missing:{" "}
                {snapshotMissing
                  .filter((k) => SNAPSHOT_HINT[k])
                  .map((k) => `${SNAPSHOT_LABELS[k]} (${SNAPSHOT_HINT[k]})`)
                  .join(", ")}
              </p>
            )}
          </section>

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
                  <button
                    className="text-[10px] text-zinc-600 opacity-0 hover:text-zinc-400 group-hover:opacity-100"
                    onClick={() => void remove("formats", f.id)}
                    aria-label="Delete format"
                  >
                    ✕
                  </button>
                </li>
              ))}
              {loaded && (ws?.formats.length ?? 0) === 0 && (
                <li className="px-1.5 py-1 text-xs text-zinc-600">Nothing queued — Claude pushes here.</li>
              )}
            </ol>
          </section>
        </div>
      </div>
    </aside>

    {chatExpanded && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={() => setChatExpanded(false)}
      >
        <div
          className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-zinc-100">
              <Sparkles className="h-3.5 w-3.5 text-violet-300/80" />
              Ask
              <span className="ml-1 text-[11px] font-normal text-zinc-600">
                {snapshotPresent.length}/{snapshotPresent.length + snapshotMissing.length} loaded ·{" "}
                {days}d
              </span>
            </h2>
            <button
              onClick={() => setChatExpanded(false)}
              className="text-zinc-500 transition-colors hover:text-zinc-300"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ChatThread
            messages={chatMessages}
            sending={chatSending}
            error={chatError}
            endRef={chatEndRef}
            big
            className="min-h-0 flex-1 px-4 py-4"
          />

          <div className="border-t border-zinc-800 p-4">
            <ChatComposer
              value={chatInput}
              onChange={setChatInput}
              onSubmit={sendChat}
              sending={chatSending}
              big
            />
            {snapshotMissing.some((k) => SNAPSHOT_HINT[k]) && (
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                Missing:{" "}
                {snapshotMissing
                  .filter((k) => SNAPSHOT_HINT[k])
                  .map((k) => `${SNAPSHOT_LABELS[k]} (${SNAPSHOT_HINT[k]})`)
                  .join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
