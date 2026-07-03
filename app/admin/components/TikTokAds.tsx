"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Panel,
  useApi,
  Notice,
  ChartSkeleton,
  fmtMoney,
  fmtMoney2,
  fmtPct,
  tooltipStyle,
  axisProps,
} from "./Widgets";

// ---------- TikTok Ads tab: creative-level performance + action queue ----------

type Verdict = "scale" | "watch" | "review" | "kill" | "needs data";

type Creative = {
  id: string;
  name: string;
  type: "test" | "main";
  lastActive: string;
  spend: number;
  spendShare: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number | null;
  ctr: number | null;
  hookRate: number | null;
  holdRate: number | null;
  avgWatch: number | null;
  verdict: Verdict;
};

type Rec = { severity: "kill" | "scale" | "test" | "info"; title: string; detail: string };

type CreativesData = {
  configured: boolean;
  error?: string;
  creatives?: Creative[];
  daily?: { date: string; label: string; spend: number; installs: number; costPerInstall: number | null }[];
  totals?: {
    spend: number;
    conversions: number;
    tiktokCpa: number | null;
    installs: number;
    newPayers: number;
    costPerInstall: number | null;
    paidCac: number | null;
    coverage: number | null;
  };
  recommendations?: Rec[];
  thresholds?: { targetCpa: number; scaleWatch: number; killWatch: number };
};

const VERDICT_STYLE: Record<Verdict, string> = {
  scale: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  watch: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
  review: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  kill: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  "needs data": "border-zinc-800 bg-zinc-900 text-zinc-600",
};

const REC_DOT: Record<Rec["severity"], string> = {
  kill: "bg-rose-400",
  scale: "bg-emerald-400",
  test: "bg-sky-400",
  info: "bg-amber-400",
};

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${VERDICT_STYLE[verdict]}`}
    >
      {verdict}
    </span>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

// Format ideas seeded from the current winning template — the playbook is:
// clone the winner's structure/pacing/audio, vary only the coach question and
// the scan shown.
const FORMAT_IDEAS = [
  "Same flow as the top-spend winner, different person's scan. Type “What's my worst feature” — show a scan with one visibly low category score.",
  "Different person's scan. Type “Am I cooked or is there hope” — show overall ~45–50 vs potential 70+, linger on the gap.",
  "Different person's scan. Type “How far am I from my potential” — skip score lingering, go straight to the routine/diet recommendations.",
  "Different person's scan. Type “Rate me honestly” — mid overall score, slow scroll through every category breakdown.",
  "Same scan as the winner. Type “What should I fix first” — reorder to lead with the single lowest category before the full dashboard.",
];

export function TikTokAdsTab({ days }: { days: number }) {
  const { data, error, loading } = useApi<CreativesData>(`/api/admin/tiktok-creatives?days=${days}`);
  if (error || data?.error) return <Notice message={error || data?.error || ""} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-800/50" />
          ))}
        </div>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  const t = data.totals;
  const creatives = data.creatives ?? [];
  const recs = data.recommendations ?? [];
  const daily = data.daily ?? [];
  const cacSeries = daily.filter((d) => d.costPerInstall != null);

  return (
    <div className="space-y-4">
      {t && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="Spend" value={fmtMoney(Math.round(t.spend))} sub="Daily Glow campaigns" />
          <Tile
            label="Cost / install"
            value={t.costPerInstall != null ? fmtMoney2(t.costPerInstall) : "—"}
            sub={`spend / ${t.installs.toLocaleString()} PostHog installs`}
          />
          <Tile
            label="Paid CAC"
            value={t.paidCac != null ? fmtMoney2(t.paidCac) : "—"}
            sub={`spend / ${t.newPayers.toLocaleString()} new payers (RC, 7d window)`}
          />
          <Tile
            label="TikTok CPA"
            value={t.tiktokCpa != null ? fmtMoney2(t.tiktokCpa) : "—"}
            sub={`${t.conversions.toLocaleString()} claimed purchases`}
          />
          <Tile
            label="Attribution coverage"
            value={t.coverage != null ? fmtPct(t.coverage) : "—"}
            sub="claimed / actual purchases"
          />
          <Tile label="Installs" value={t.installs.toLocaleString()} sub="PostHog, unique persons" />
        </div>
      )}

      <Panel title="Action queue" meta={`rules: kill <${data.thresholds?.killWatch}s watch · scale ≤$${data.thresholds?.targetCpa} CPA at ${data.thresholds?.scaleWatch}s+ · UTC`}>
        {recs.length === 0 ? (
          <p className="text-xs text-zinc-500">Nothing actionable in this range — keep the current setup running.</p>
        ) : (
          <ul className="space-y-3">
            {recs.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${REC_DOT[r.severity]}`} />
                <div>
                  <p className="text-xs font-medium text-zinc-100">{r.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Creative performance" meta={`last ${creatives.length} creatives with spend · newest first · UTC`}>
        {creatives.length === 0 ? (
          <p className="text-xs text-zinc-500">No creative spend in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 text-left font-medium">Creative</th>
                  <th className="pb-2 text-right font-medium">Last active</th>
                  <th className="pb-2 text-right font-medium">Spend</th>
                  <th className="pb-2 text-right font-medium">Conv</th>
                  <th className="pb-2 text-right font-medium">CPA</th>
                  <th className="pb-2 text-right font-medium">CTR</th>
                  <th className="pb-2 text-right font-medium">Hook 2s</th>
                  <th className="pb-2 text-right font-medium">Hold 6s</th>
                  <th className="pb-2 text-right font-medium">Avg watch</th>
                  <th className="pb-2 text-right font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {creatives.map((c) => (
                  <tr key={c.id} className="border-t border-zinc-800/60 align-top">
                    <td className="max-w-[16rem] py-2 pr-3">
                      <p className="truncate text-zinc-200" title={c.name}>
                        {c.name}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                          {c.type === "test" ? "ABO test" : "Main"}
                        </span>
                        <span className="h-1 w-16 overflow-hidden rounded bg-zinc-800">
                          <span
                            className="block h-full bg-pink-400/70"
                            style={{ width: `${Math.min(100, c.spendShare * 100)}%` }}
                          />
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {Math.round(c.spendShare * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-zinc-400">{c.lastActive.slice(5)}</td>
                    <td className="py-2 text-right text-zinc-100">{fmtMoney(Math.round(c.spend))}</td>
                    <td className="py-2 text-right text-zinc-100">{c.conversions.toLocaleString()}</td>
                    <td className="py-2 text-right text-zinc-100">
                      {c.cpa != null ? fmtMoney2(c.cpa) : "—"}
                    </td>
                    <td className="py-2 text-right text-zinc-400">
                      {c.ctr != null ? `${(c.ctr * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-2 text-right text-zinc-400">
                      {c.hookRate != null ? fmtPct(c.hookRate) : "—"}
                    </td>
                    <td className="py-2 text-right text-zinc-400">
                      {c.holdRate != null ? fmtPct(c.holdRate) : "—"}
                    </td>
                    <td className="py-2 text-right text-zinc-100">
                      {c.avgWatch != null ? `${c.avgWatch.toFixed(2)}s` : "—"}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <VerdictBadge verdict={c.verdict} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Cost per install per day"
          meta={`spend / PostHog installs${t?.costPerInstall != null ? ` · ${fmtMoney2(t.costPerInstall)} blended` : ""} · UTC`}
        >
          {cacSeries.length < 2 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-1">
              <p className="text-3xl font-semibold tabular-nums text-zinc-100">
                {cacSeries[0]?.costPerInstall != null ? fmtMoney2(cacSeries[0].costPerInstall) : "—"}
              </p>
              <p className="text-xs text-zinc-500">{cacSeries[0]?.date ?? "today"} · spend / installs</p>
            </div>
          ) : (
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cacSeries} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [fmtMoney2(Number(v)), "Cost / install"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="costPerInstall"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    dot={cacSeries.length <= 7 ? { r: 3, fill: "#38bdf8", strokeWidth: 0 } : false}
                    name="Cost / install"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Formats to try next" meta="clone the winner, vary one variable">
          <ol className="list-decimal space-y-2.5 pl-4 text-xs leading-relaxed text-zinc-400 marker:text-zinc-600">
            {FORMAT_IDEAS.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ol>
          <p className="mt-3 border-t border-zinc-800/60 pt-3 text-[10px] leading-relaxed text-zinc-600">
            Film all in one session. Each in its own ABO ad group at $10/day, 48h. Kill under{" "}
            {"2.5s"} watch time, promote survivors to the main CBO. Keep hook copy fixed — the
            variable is the coach question, not the overlay text.
          </p>
        </Panel>
      </div>
    </div>
  );
}
