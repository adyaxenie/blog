"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ---------- shared ----------

export const RANGES = [
  { label: "1D", days: 1 },
  { label: "7D", days: 7 },
  { label: "2W", days: 14 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
] as const;

// Module-level caches shared across all useApi callers for the browser session.
// Keyed by request path, which already encodes the timeframe (?days=N), so a new
// timeframe is a cache miss and refetches while tab switches reuse cached data.
const apiCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
let refreshPending = false;

type MetricsRefreshContextValue = {
  refreshTick: number;
  refreshing: boolean;
  refresh: () => void;
};

const MetricsRefreshContext = createContext<MetricsRefreshContextValue>({
  refreshTick: 0,
  refreshing: false,
  refresh: () => {},
});

export function MetricsRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    apiCache.clear();
    inflight.clear();
    refreshPending = true;
    setRefreshing(true);
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!refreshing) return;
    const id = setInterval(() => {
      if (inflight.size === 0) {
        refreshPending = false;
        setRefreshing(false);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [refreshing, refreshTick]);

  return (
    <MetricsRefreshContext.Provider value={{ refreshTick, refreshing, refresh }}>
      {children}
    </MetricsRefreshContext.Provider>
  );
}

export function useMetricsRefresh() {
  return useContext(MetricsRefreshContext);
}

function withRefreshParam(path: string, fresh: boolean): string {
  if (!fresh) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}refresh=1`;
}

async function loadApi<T>(path: string, fresh = false): Promise<T> {
  const r = await fetch(withRefreshParam(path, fresh));
  const json = await r.json();
  if (json.error && !json.configured) throw new Error(json.error);
  if (!r.ok) throw new Error(json.error ?? `Request failed (${r.status})`);
  return json as T;
}

async function loadApiWithRetry<T>(path: string, fresh = false, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await loadApi<T>(path, fresh);
    } catch (e) {
      last = e;
      // Config / not-configured errors won't recover on retry.
      const msg = e instanceof Error ? e.message : String(e);
      if (/not set|REPLACE|configured/i.test(msg)) throw e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

export function useApi<T>(path: string) {
  const { refreshTick, refresh } = useMetricsRefresh();
  const cached = apiCache.get(path) as T | undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(cached === undefined);
  const [retryTick, setRetryTick] = useState(0);

  const retry = useCallback(() => {
    apiCache.delete(path);
    inflight.delete(path);
    setRetryTick((t) => t + 1);
  }, [path]);

  useEffect(() => {
    const hit = apiCache.get(path) as T | undefined;
    if (hit !== undefined) {
      setData(hit);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    const fresh = refreshPending;
    let promise = inflight.get(path) as Promise<T> | undefined;
    if (!promise) {
      promise = loadApiWithRetry<T>(path, fresh);
      inflight.set(path, promise);
      // Cache successful results; leave errors uncached so they retry on remount.
      promise
        .then((json) => apiCache.set(path, json))
        .catch(() => {})
        .finally(() => {
          if (inflight.get(path) === promise) inflight.delete(path);
        });
    }

    promise
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, refreshTick, retryTick]);

  return { data, error, loading, refresh, retry };
}

/**
 * Read an already-fetched API payload from the shared session cache without
 * triggering a network request. Returns undefined on a cache miss (e.g. the
 * corresponding tab/widget hasn't been opened yet). Keyed identically to
 * `useApi`, so callers must pass the exact same path (including `?days=N`).
 */
export function peekApiCache<T = unknown>(path: string): T | undefined {
  return apiCache.get(path) as T | undefined;
}

export function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
        {meta && <span className="text-xs text-zinc-500">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

export function Notice({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/80">
      {message}
    </p>
  );
}

export function ChartSkeleton() {
  return <div className="h-56 animate-pulse rounded-lg bg-zinc-800/50" />;
}

export const fmtMoney = (n: number) => `$${n.toLocaleString()}`;
export const fmtMoney2 = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

type ValueKind = "money" | "money2" | "count" | "pct";

function fmtValue(kind: ValueKind, v: number | null): string {
  if (v == null) return "—";
  if (kind === "money") return fmtMoney(Math.round(v));
  if (kind === "money2") return fmtMoney2(v);
  if (kind === "pct") return fmtPct(v);
  return v.toLocaleString();
}

// Relative delta with direction-aware coloring (subtle text, no backgrounds).
export function Delta({ deltaPct, betterWhen }: { deltaPct: number | null; betterWhen: "up" | "down" }) {
  if (deltaPct == null) return <span className="text-[10px] text-zinc-600">—</span>;
  const good = deltaPct === 0 ? null : (deltaPct > 0) === (betterWhen === "up");
  const color =
    good == null ? "text-zinc-500" : good ? "text-emerald-400/90" : "text-rose-400/90";
  const arrow = deltaPct > 0 ? "▲" : deltaPct < 0 ? "▼" : "·";
  return (
    <span className={`text-[10px] tabular-nums ${color}`}>
      {arrow} {Math.abs(deltaPct * 100).toFixed(0)}%
    </span>
  );
}

export const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#e4e4e7",
} as const;

export const axisProps = {
  stroke: "#52525b",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
} as const;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

// ---------- RevenueCat ----------

type RcMetric = { id: string; name: string; value: number; unit: string; description: string };
type RcData = {
  configured: boolean;
  error?: string;
  metrics?: RcMetric[];
  revenueSeries?: { date: string; label: string; revenue: number; transactions: number }[];
  revenueSummary?: { total: number; average: number } | null;
};

export function RevenueCatKpis({ days }: { days: number }) {
  const { data, error, loading } = useApi<RcData>(`/api/admin/revenuecat?days=${days}`);
  if (error || data?.error) return <Notice message={error || data?.error || ""} />;
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-800/50" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {(data.metrics ?? []).map((m) => (
        <Stat
          key={m.id}
          label={m.name}
          value={m.unit === "$" ? fmtMoney(m.value) : m.value.toLocaleString()}
          sub={m.description}
        />
      ))}
    </div>
  );
}

export function RevenueChart({ days }: { days: number }) {
  const { data, error, loading } = useApi<RcData>(`/api/admin/revenuecat?days=${days}`);
  const series = data?.revenueSeries ?? [];
  const meta =
    data?.revenueSummary != null
      ? `${fmtMoney(Math.round(data.revenueSummary.total))} total · ${fmtMoney(Math.round(data.revenueSummary.average))}/day avg · UTC`
      : "UTC";

  return (
    <Panel title="Revenue" meta={meta}>
      {error || data?.error ? (
        <Notice message={error || data?.error || ""} />
      ) : loading || !data ? (
        <ChartSkeleton />
      ) : series.length < 2 ? (
        // A single day doesn't chart well — show the number instead.
        <div className="flex h-56 flex-col items-center justify-center gap-1">
          <p className="text-4xl font-semibold tabular-nums text-emerald-400">
            {fmtMoney(series[0]?.revenue ?? 0)}
          </p>
          <p className="text-xs text-zinc-500">
            {series[0]?.date ?? "today"} · {series[0]?.transactions ?? 0} transactions
          </p>
        </div>
      ) : (
        <div className="relative h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [fmtMoney(Number(v)), "Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#34d399"
                strokeWidth={1.5}
                fill="#34d399"
                fillOpacity={0.12}
                dot={series.length <= 7 ? { r: 3, fill: "#34d399", strokeWidth: 0 } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

// ---------- PostHog ----------

type PhData = {
  configured: boolean;
  error?: string;
  series?: { label: string; date: string; installs: number; completions: number }[];
  totals?: { installs: number; completions: number };
  conversionRate?: number | null;
};

export function PostHogWidget({ days }: { days: number }) {
  const { data, error, loading } = useApi<PhData>(`/api/admin/posthog?days=${days}`);
  const meta =
    data?.conversionRate != null
      ? `${(data.conversionRate * 100).toFixed(1)}% conversion · ${
          data.totals?.installs.toLocaleString() ?? 0
        } installs · UTC`
      : "UTC";

  return (
    <Panel title="Installs vs onboarding completed" meta={meta}>
      {error || data?.error ? (
        <Notice message={error || data?.error || ""} />
      ) : loading || !data ? (
        <ChartSkeleton />
      ) : (
        <>
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="installs"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dot={false}
                  name="Installs"
                />
                <Line
                  type="monotone"
                  dataKey="completions"
                  stroke="#a78bfa"
                  strokeWidth={1.5}
                  dot={false}
                  name="Onboarding completed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Installs
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Onboarding completed
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------- TikTok Ads (Supermetrics) ----------

type TtData = {
  configured: boolean;
  error?: string;
  series?: { label: string; date: string; spend: number; impressions: number; clicks: number; conversions: number }[];
  totals?: { spend: number; impressions: number; clicks: number; conversions: number; cpa: number | null; ctr: number | null };
};

export function TikTokWidget({ days }: { days: number }) {
  const { data, error, loading } = useApi<TtData>(`/api/admin/tiktok?days=${days}`);
  const t = data?.totals;
  const meta = t
    ? `${fmtMoney(t.spend)} spend${t.cpa != null ? ` · ${fmtMoney(t.cpa)} CPA` : ""}${
        t.ctr != null ? ` · ${(t.ctr * 100).toFixed(2)}% CTR` : ""
      } · UTC`
    : "UTC";

  return (
    <Panel title="TikTok ads" meta={meta}>
      {error || data?.error ? (
        <Notice message={error || data?.error || ""} />
      ) : loading || !data ? (
        <ChartSkeleton />
      ) : (
        <>
          {t && (
            <div className="mb-4 grid grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Spend</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-100">{fmtMoney(t.spend)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Impressions</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-100">
                  {t.impressions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Clicks</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-100">
                  {t.clicks.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Conversions</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-100">
                  {t.conversions.toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [fmtMoney(Number(v)), "Spend"]}
                  cursor={{ fill: "#27272a", opacity: 0.4 }}
                />
                <Bar dataKey="spend" fill="#f472b6" radius={[2, 2, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------- Daily brief (yesterday vs trailing 7-day avg, fixed window) ----------

type BriefItem = {
  key: string;
  label: string;
  kind: ValueKind;
  value: number | null;
  baseline: number | null;
  deltaPct: number | null;
  betterWhen: "up" | "down";
};
type BriefData = {
  configured: boolean;
  error?: string;
  date?: string;
  baselineRange?: string;
  items?: BriefItem[];
};

export function DailyBrief() {
  const { data, error, loading } = useApi<BriefData>("/api/admin/brief");
  if (error || data?.error) return <Notice message={error || data?.error || ""} />;
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-800/50" />
        ))}
      </div>
    );
  }
  return (
    <section className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Daily brief · yesterday {data.date} vs prior 7-day avg · UTC
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(data.items ?? []).map((it) => (
          <div key={it.key} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {it.label}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-xl font-semibold tabular-nums text-zinc-100">
                {fmtValue(it.kind, it.value)}
              </p>
              <Delta deltaPct={it.deltaPct} betterWhen={it.betterWhen} />
            </div>
            <p className="mt-0.5 text-[10px] tabular-nums text-zinc-600">
              7d avg {fmtValue(it.kind, it.baseline)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Economics: spend vs revenue overlay + blended CAC ----------

const ECO_LINES = [
  {
    key: "spend" as const,
    label: "Spend",
    dot: "bg-rose-400",
    stroke: "#fb7185",
    name: "Spend",
  },
  {
    key: "revenue" as const,
    label: "Revenue",
    dot: "bg-emerald-400",
    stroke: "#34d399",
    name: "Revenue (gross)",
    dash: "4 3",
  },
  {
    key: "proceeds" as const,
    label: "Proceeds",
    dot: "bg-violet-400",
    stroke: "#a78bfa",
    name: "Proceeds (after Apple 15%)",
  },
  {
    key: "profit" as const,
    label: "Profit",
    dot: "bg-sky-400",
    stroke: "#38bdf8",
    name: "Profit (after Apple 15% − spend)",
  },
];

type EcoLineKey = (typeof ECO_LINES)[number]["key"];

const DEFAULT_ECO_LINES: Record<EcoLineKey, boolean> = {
  spend: true,
  revenue: true,
  proceeds: false,
  profit: false,
};

/** Hover tooltip row order (independent of toggle / Line render order). */
const ECO_TOOLTIP_ORDER: EcoLineKey[] = ["revenue", "proceeds", "spend", "profit"];

function EcoLineToggles({
  lines,
  onToggle,
}: {
  lines: Record<EcoLineKey, boolean>;
  onToggle: (key: EcoLineKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ECO_LINES.map((line) => {
        const on = lines[line.key];
        return (
          <button
            key={line.key}
            type="button"
            onClick={() => onToggle(line.key)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors ${
              on
                ? "border-zinc-700 bg-zinc-800/80 text-zinc-200"
                : "border-transparent text-zinc-600 hover:border-zinc-800 hover:text-zinc-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${line.dot} ${on ? "opacity-100" : "opacity-30"}`}
            />
            {line.label}
          </button>
        );
      })}
    </div>
  );
}

type EcoData = {
  configured: boolean;
  error?: string;
  bucket?: "day" | "week";
  series?: {
    date: string;
    label: string;
    spend: number;
    revenue: number;
    proceeds: number;
    profit: number;
    transactions: number;
  }[];
  totals?: {
    spend: number;
    revenue: number;
    proceeds: number;
    transactions: number;
    net: number;
    cacProxy: number | null;
  };
  blended?: { spend28d: number; newCustomers28d: number; cac: number | null };
};

export function EconomicsOverlay({ days }: { days: number }) {
  const { data, error, loading } = useApi<EcoData>(`/api/admin/economics?days=${days}`);
  const [lines, setLines] = useState(DEFAULT_ECO_LINES);
  const series = data?.series ?? [];
  const t = data?.totals;
  const meta = t
    ? `net ${t.net < 0 ? "-" : ""}${fmtMoney(Math.abs(Math.round(t.net)))} after Apple 15% − spend${
        data?.bucket === "week" ? " · weekly buckets" : ""
      } · UTC`
    : "UTC";

  function toggleLine(key: EcoLineKey) {
    setLines((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const visibleLines = ECO_LINES.filter((line) => lines[line.key]);
  const singleDay = series[0];
  const singleDayColor: Record<EcoLineKey, string> = {
    spend: "text-rose-400",
    revenue: "text-emerald-400",
    proceeds: "text-violet-400",
    profit: "text-sky-400",
  };

  return (
    <Panel title="Spend vs revenue" meta={meta}>
      {error || data?.error ? (
        <Notice message={error || data?.error || ""} />
      ) : loading || !data ? (
        <ChartSkeleton />
      ) : (
        <>
          {t && data.blended && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Spend</p>
                <p className="text-sm font-semibold tabular-nums text-rose-400">
                  {fmtMoney(Math.round(t.spend))}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Revenue</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-400">
                  {fmtMoney(Math.round(t.revenue))}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Blended CAC · 28d</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-100">
                  {data.blended.cac != null ? fmtMoney2(data.blended.cac) : "—"}
                </p>
                <p className="text-[10px] tabular-nums text-zinc-600">
                  {fmtMoney(Math.round(data.blended.spend28d))} /{" "}
                  {data.blended.newCustomers28d.toLocaleString()} new customers
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Spend per transaction · range
                </p>
                <p className="text-sm font-semibold tabular-nums text-zinc-100">
                  {t.cacProxy != null ? fmtMoney2(t.cacProxy) : "—"}
                </p>
                <p className="text-[10px] tabular-nums text-zinc-600">
                  spend / transactions · incl. renewals
                </p>
              </div>
            </div>
          )}
          {series.length < 2 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2">
              {visibleLines.length > 0 ? (
                <p className="text-2xl font-semibold tabular-nums">
                  {visibleLines.map((line, i) => (
                    <span key={line.key}>
                      {i > 0 && <span className="mx-2 text-zinc-600">·</span>}
                      <span className={singleDayColor[line.key]}>
                        {fmtMoney(Math.round(singleDay?.[line.key] ?? 0))}
                      </span>
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-xs text-zinc-500">Select at least one line</p>
              )}
              <p className="text-xs text-zinc-500">{singleDay?.date ?? "today"}</p>
              <EcoLineToggles lines={lines} onToggle={toggleLine} />
            </div>
          ) : (
            <>
              <div className="mb-2">
                <EcoLineToggles lines={lines} onToggle={toggleLine} />
              </div>
              <div className="relative h-56">
                {visibleLines.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                    Select at least one line
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} tickFormatter={(v: number) => `$${v}`} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v, name) => [fmtMoney(Math.round(Number(v))), String(name)]}
                        itemSorter={(item) =>
                          ECO_TOOLTIP_ORDER.indexOf(item.dataKey as EcoLineKey)
                        }
                      />
                      {ECO_LINES.map(
                        (line) =>
                          lines[line.key] && (
                            <Line
                              key={line.key}
                              type="monotone"
                              dataKey={line.key}
                              stroke={line.stroke}
                              strokeWidth={1.5}
                              strokeDasharray={line.dash}
                              dot={
                                series.length <= 7
                                  ? { r: 3, fill: line.stroke, strokeWidth: 0 }
                                  : false
                              }
                              name={line.name}
                            />
                          )
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <p className="mt-2 text-[10px] text-zinc-600">
                {lines.profit
                  ? "breakeven where profit crosses zero"
                  : lines.spend && lines.proceeds
                    ? "breakeven where proceeds cross spend"
                    : lines.spend && lines.revenue
                      ? "breakeven where revenue crosses spend"
                      : "toggle lines to compare"}
              </p>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------- Paywall funnel (unique persons per step) ----------

type FunnelData = {
  configured: boolean;
  error?: string;
  steps?: {
    event: string;
    label: string;
    count: number;
    pctOfPrev: number | null;
    pctOfFirst: number | null;
  }[];
};

export function PaywallFunnel({ days }: { days: number }) {
  const { data, error, loading } = useApi<FunnelData>(`/api/admin/funnel?days=${days}`);
  const steps = data?.steps ?? [];
  const overall = steps.length ? steps[steps.length - 1].pctOfFirst : null;
  const meta = overall != null ? `${fmtPct(overall)} install → continue · UTC` : "UTC";

  return (
    <Panel title="Paywall funnel" meta={meta}>
      {error || data?.error ? (
        <Notice message={error || data?.error || ""} />
      ) : loading || !data ? (
        <ChartSkeleton />
      ) : (
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.event}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {s.label}
                </span>
                <span className="text-xs tabular-nums text-zinc-300">
                  {s.count.toLocaleString()}
                  {s.pctOfPrev != null && (
                    <span className="text-zinc-500"> · {fmtPct(s.pctOfPrev)} of prev</span>
                  )}
                </span>
              </div>
              <div className="h-5 overflow-hidden rounded bg-zinc-800/60">
                <div
                  className="h-full rounded bg-violet-400/70"
                  style={{
                    width: `${Math.min(100, Math.max((s.pctOfFirst ?? 0) * 100, s.count > 0 ? 1 : 0))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------- Weekly report (last 4 complete UTC weeks, fixed window) ----------

type WeeklyRow = {
  start: string;
  end: string;
  label: string;
  revenue: number;
  spend: number;
  installs: number;
  onboardingPct: number | null;
  paywallPct: number | null;
};
type WeeklyData = {
  configured: boolean;
  error?: string;
  weeks?: WeeklyRow[];
  deltas?: {
    revenue: (number | null)[];
    spend: (number | null)[];
    installs: (number | null)[];
    onboardingPct: (number | null)[];
    paywallPct: (number | null)[];
  };
};

function WeeklyCell({
  value,
  delta,
  betterWhen,
}: {
  value: string;
  delta: number | null;
  betterWhen: "up" | "down";
}) {
  return (
    <td className="py-2 text-right">
      <span className="tabular-nums text-zinc-100">{value}</span>
      {delta != null && (
        <span className="ml-1.5">
          <Delta deltaPct={delta} betterWhen={betterWhen} />
        </span>
      )}
    </td>
  );
}

export function WeeklyReport() {
  const { data, error, loading } = useApi<WeeklyData>("/api/admin/weekly");
  const weeks = data?.weeks ?? [];
  const d = data?.deltas;

  return (
    <Panel title="Weekly report" meta="last 4 complete weeks · Mon–Sun · UTC">
      {error || data?.error ? (
        <Notice message={error || data?.error || ""} />
      ) : loading || !data ? (
        <ChartSkeleton />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                <th className="pb-2 text-left font-medium">Week</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">Spend</th>
                <th className="pb-2 text-right font-medium">Installs</th>
                <th className="pb-2 text-right font-medium">Onboarding</th>
                <th className="pb-2 text-right font-medium">Paywall</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={w.start} className="border-t border-zinc-800/60">
                  <td className="py-2 whitespace-nowrap text-zinc-400">{w.label}</td>
                  <WeeklyCell
                    value={fmtMoney(Math.round(w.revenue))}
                    delta={d?.revenue[i] ?? null}
                    betterWhen="up"
                  />
                  <WeeklyCell
                    value={fmtMoney(Math.round(w.spend))}
                    delta={d?.spend[i] ?? null}
                    betterWhen="down"
                  />
                  <WeeklyCell
                    value={w.installs.toLocaleString()}
                    delta={d?.installs[i] ?? null}
                    betterWhen="up"
                  />
                  <WeeklyCell
                    value={w.onboardingPct != null ? fmtPct(w.onboardingPct) : "—"}
                    delta={d?.onboardingPct[i] ?? null}
                    betterWhen="up"
                  />
                  <WeeklyCell
                    value={w.paywallPct != null ? fmtPct(w.paywallPct) : "—"}
                    delta={d?.paywallPct[i] ?? null}
                    betterWhen="up"
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------- RevenueCat subscription health ----------

type RcHealthData = {
  configured: boolean;
  error?: string;
  refunds?: {
    series: { date: string; label: string; transactions: number; refunded: number; rate: number }[];
    totalRefunded: number;
    overallRate: number | null;
  } | null;
  conversion?: {
    series: { date: string; label: string; newCustomers: number; paying: number; rate: number }[];
    totalPaying: number;
    overallRate: number | null;
  } | null;
};

function RateLine({
  series,
  color,
  name,
}: {
  series: { label: string; rate: number }[];
  color: string;
  name: string;
}) {
  return (
    <div className="relative h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, name]} />
          <Line
            type="monotone"
            dataKey="rate"
            stroke={color}
            strokeWidth={1.5}
            dot={series.length <= 7 ? { r: 3, fill: color, strokeWidth: 0 } : false}
            name={name}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RcHealthPanels({ days }: { days: number }) {
  const { data, error, loading } = useApi<RcHealthData>(`/api/admin/rc-health?days=${days}`);
  if (error || data?.error) return <Notice message={error || data?.error || ""} />;
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl bg-zinc-800/50" />
        ))}
      </div>
    );
  }
  const { refunds, conversion } = data;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {refunds && (
        <Panel
          title="Refund rate"
          meta={`${refunds.totalRefunded.toLocaleString()} refunded${
            refunds.overallRate != null ? ` · ${refunds.overallRate}% overall` : ""
          } · UTC`}
        >
          <RateLine series={refunds.series} color="#f87171" name="Refund rate" />
        </Panel>
      )}
      {conversion && (
        <Panel
          title="Conversion to paying · 7d"
          meta={`${conversion.totalPaying.toLocaleString()} paying${
            conversion.overallRate != null ? ` · ${conversion.overallRate}% overall` : ""
          } · UTC`}
        >
          <RateLine series={conversion.series} color="#34d399" name="Conversion rate" />
        </Panel>
      )}
    </div>
  );
}
