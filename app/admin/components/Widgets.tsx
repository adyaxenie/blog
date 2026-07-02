"use client";

import { useEffect, useState } from "react";
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

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(path)
      .then(async (r) => {
        const json = await r.json();
        if (cancelled) return;
        if (json.error && !json.configured) setError(json.error);
        else if (!r.ok) setError(json.error ?? `Request failed (${r.status})`);
        else setData(json);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path]);
  return { data, error, loading };
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

function Notice({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/80">
      {message}
    </p>
  );
}

function ChartSkeleton() {
  return <div className="h-56 animate-pulse rounded-lg bg-zinc-800/50" />;
}

const fmtMoney = (n: number) => `$${n.toLocaleString()}`;

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#e4e4e7",
} as const;

const axisProps = {
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
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [fmtMoney(Number(v ?? 0)), "Revenue"]}
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
          <div className="h-56">
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

// ---------- TikTok Ads (Windsor) ----------

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
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [fmtMoney(Number(v ?? 0)), "Spend"]}
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
