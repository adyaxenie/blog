"use client";

import { useMemo, useState } from "react";
import { Panel, useApi, Notice, ChartSkeleton, fmtMoney, fmtMoney2 } from "./Widgets";

// ---------- Projections tab: monthly P&L actuals + spend-scaling scenarios ----------

type MonthRow = {
  month: string;
  label: string;
  partial: boolean;
  spend: number;
  revenue: number;
  proceeds: number;
  grossProfit: number;
  margin: number | null;
  roas: number | null;
};

type ProjectionsData = {
  configured: boolean;
  error?: string;
  months?: MonthRow[];
  basis?: {
    dailySpend7d: number;
    dailySpend30d: number;
    roas7d: number | null;
    roas30d: number | null;
    appleRate: number;
  };
};

const SCENARIOS = [1, 2, 5, 10] as const;
type ScaleView = "runrate" | "eom";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

/** UTC calendar progress for anchoring run-rate to the current month. */
function utcMonthProgress(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return {
    dayOfMonth,
    daysInMonth,
    remainingDays: Math.max(0, daysInMonth - dayOfMonth),
  };
}

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const money = (v: number) => fmtMoney(Math.round(v));

function profitClass(v: number) {
  return v >= 0 ? "text-emerald-300" : "text-rose-300";
}

function ScaleViewToggle({
  view,
  onChange,
}: {
  view: ScaleView;
  onChange: (view: ScaleView) => void;
}) {
  return (
    <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
      {(
        [
          { id: "runrate", label: "30d run rate" },
          { id: "eom", label: "EOM projection" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
            view === opt.id
              ? "bg-zinc-700 font-medium text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ProjectionsTab() {
  // Retries only kick in if the first fetch fails — other tabs stay single-shot.
  const { data, error, loading, retry } = useApi<ProjectionsData>("/api/admin/projections", {
    retries: 3,
  });
  const [roasBasis, setRoasBasis] = useState<"7d" | "30d">("30d");
  const [spendOverride, setSpendOverride] = useState<string>("");
  const [scaleView, setScaleView] = useState<ScaleView>("runrate");

  const basis = data?.basis;
  const dailySpendDefault = basis?.dailySpend7d ?? 0;
  const dailySpend = spendOverride === "" ? dailySpendDefault : Number(spendOverride) || 0;
  const roas = (roasBasis === "7d" ? basis?.roas7d : basis?.roas30d) ?? null;
  const appleRate = basis?.appleRate ?? 0.85;
  const { dayOfMonth, daysInMonth, remainingDays } = useMemo(() => utcMonthProgress(), []);

  const months = data?.months ?? [];
  const current = months.find((m) => m.partial);
  const mtdSpend = current?.spend ?? 0;

  const scenarios = useMemo(() => {
    if (roas == null) return [];
    return SCENARIOS.map((mult) => {
      const daily = dailySpend * mult;
      // 30d run-rate P&L (fixed 30-day month).
      const spend30 = daily * 30;
      const revenue30 = spend30 * roas;
      const proceeds30 = revenue30 * appleRate;
      const profit30 = proceeds30 - spend30;
      // EOM: actual MTD spend + remaining days at this daily rate.
      const spendEom = mtdSpend + daily * remainingDays;
      const revenueEom = spendEom * roas;
      const proceedsEom = revenueEom * appleRate;
      const profitEom = proceedsEom - spendEom;
      return {
        mult,
        daily,
        runrate: {
          spend: spend30,
          revenue: revenue30,
          proceeds: proceeds30,
          grossProfit: profit30,
          margin: spend30 > 0 ? profit30 / spend30 : null,
        },
        eom: {
          spend: spendEom,
          revenue: revenueEom,
          proceeds: proceedsEom,
          grossProfit: profitEom,
          margin: spendEom > 0 ? profitEom / spendEom : null,
        },
      };
    });
  }, [dailySpend, roas, appleRate, mtdSpend, remainingDays]);

  if (error || data?.error) {
    return (
      <div className="space-y-2">
        <Notice message={error || data?.error || ""} />
        <button
          type="button"
          onClick={retry}
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Retry
        </button>
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-800/50" />
          ))}
        </div>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  const pnl = scaleView === "runrate" ? "runrate" : "eom";
  const panelMeta =
    scaleView === "runrate"
      ? `30-day months · revenue = spend × ${roasBasis} ROAS${roas != null ? ` (${roas.toFixed(2)}×)` : ""} · assumes ROAS holds at scale`
      : `day ${dayOfMonth}/${daysInMonth} UTC · MTD spend ${money(mtdSpend)} + ${remainingDays}d left at scenario rate · revenue = EOM spend × ${roasBasis} ROAS`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Daily spend (7d avg)"
          value={fmtMoney2(basis?.dailySpend7d ?? 0)}
          sub={`30d avg ${fmtMoney2(basis?.dailySpend30d ?? 0)}`}
        />
        <Tile
          label="ROAS (7d)"
          value={basis?.roas7d != null ? `${basis.roas7d.toFixed(2)}×` : "—"}
          sub={basis?.roas7d != null ? `${(basis.roas7d * 100).toFixed(0)}% of spend` : "revenue / spend"}
        />
        <Tile
          label="ROAS (30d)"
          value={basis?.roas30d != null ? `${basis.roas30d.toFixed(2)}×` : "—"}
          sub={basis?.roas30d != null ? `${(basis.roas30d * 100).toFixed(0)}% of spend` : "revenue / spend"}
        />
        <Tile
          label="Margin (mo. to date)"
          value={current ? pct(current.margin) : "—"}
          sub="gross profit / spend, after Apple 15%"
        />
      </div>

      <Panel title="Monthly P&L" meta="calendar months · UTC · Apple 15% applied to gross revenue">
        {months.length === 0 ? (
          <p className="text-xs text-zinc-500">No spend or revenue recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 text-left font-medium" />
                  {months.map((m) => (
                    <th key={m.month} className="pb-2 pl-4 text-right font-medium">
                      {m.label}
                      {m.partial && <span className="ml-1 normal-case text-zinc-600">(MTD)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">TikTok ad spend</td>
                  {months.map((m) => (
                    <td key={m.month} className="py-2 pl-4 text-right text-rose-300">
                      {money(m.spend)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">Revenue (gross)</td>
                  {months.map((m) => (
                    <td key={m.month} className="py-2 pl-4 text-right text-zinc-100">
                      {money(m.revenue)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">After Apple 15%</td>
                  {months.map((m) => (
                    <td key={m.month} className="py-2 pl-4 text-right text-sky-300">
                      {money(m.proceeds)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">Gross profit</td>
                  {months.map((m) => (
                    <td
                      key={m.month}
                      className={`py-2 pl-4 text-right font-medium ${profitClass(m.grossProfit)}`}
                    >
                      {money(m.grossProfit)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">Profit margin</td>
                  {months.map((m) => (
                    <td key={m.month} className="py-2 pl-4 text-right text-zinc-300">
                      {pct(m.margin)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">ROAS</td>
                  {months.map((m) => (
                    <td key={m.month} className="py-2 pl-4 text-right text-zinc-300">
                      {m.roas != null ? `${m.roas.toFixed(2)}×` : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Spend scaling projections" meta={panelMeta}>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <ScaleViewToggle view={scaleView} onChange={setScaleView} />
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Daily spend
            <span className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1">
              <span className="text-zinc-500">$</span>
              <input
                type="number"
                min="0"
                step="10"
                value={spendOverride === "" ? dailySpendDefault.toFixed(0) : spendOverride}
                onChange={(e) => setSpendOverride(e.target.value)}
                className="w-20 bg-transparent text-right tabular-nums text-zinc-100 outline-none"
              />
            </span>
            {spendOverride !== "" && (
              <button
                onClick={() => setSpendOverride("")}
                className="text-[10px] text-zinc-500 underline hover:text-zinc-300"
              >
                reset to 7d avg
              </button>
            )}
          </label>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            ROAS basis
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
              {(["7d", "30d"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setRoasBasis(b)}
                  className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                    roasBasis === b
                      ? "bg-zinc-700 font-medium text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        {roas == null ? (
          <p className="text-xs text-zinc-500">No spend in the selected ROAS window yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 text-left font-medium" />
                  {scenarios.map((s) => (
                    <th key={s.mult} className="pb-2 pl-4 text-right font-medium">
                      {s.mult === 1 ? "Current run rate" : `×${s.mult} spend`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">Daily spend</td>
                  {scenarios.map((s) => (
                    <td key={s.mult} className="py-2 pl-4 text-right text-zinc-300">
                      {fmtMoney2(s.daily)}
                    </td>
                  ))}
                </tr>
                {scaleView === "eom" && (
                  <tr className="border-t border-zinc-800/60">
                    <td className="py-2 pr-3 text-zinc-400">Actual MTD spend</td>
                    {scenarios.map((s) => (
                      <td key={s.mult} className="py-2 pl-4 text-right text-zinc-500">
                        {money(mtdSpend)}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">
                    {scaleView === "runrate"
                      ? "Monthly ad spend (30d)"
                      : `Projected EOM spend (${remainingDays}d left)`}
                  </td>
                  {scenarios.map((s) => (
                    <td key={s.mult} className="py-2 pl-4 text-right text-rose-300">
                      {money(s[pnl].spend)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">
                    {scaleView === "runrate" ? "Revenue (gross)" : "Projected EOM revenue"}
                  </td>
                  {scenarios.map((s) => (
                    <td key={s.mult} className="py-2 pl-4 text-right text-zinc-100">
                      {money(s[pnl].revenue)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">After Apple 15%</td>
                  {scenarios.map((s) => (
                    <td key={s.mult} className="py-2 pl-4 text-right text-sky-300">
                      {money(s[pnl].proceeds)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">
                    {scaleView === "runrate" ? "Gross profit / mo" : "Projected EOM profit"}
                  </td>
                  {scenarios.map((s) => (
                    <td
                      key={s.mult}
                      className={`py-2 pl-4 text-right font-medium ${profitClass(s[pnl].grossProfit)}`}
                    >
                      {money(s[pnl].grossProfit)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400">Profit margin</td>
                  {scenarios.map((s) => (
                    <td key={s.mult} className="py-2 pl-4 text-right text-zinc-300">
                      {pct(s[pnl].margin)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[10px] text-zinc-600">
          {scaleView === "eom"
            ? "EOM keeps actual MTD spend fixed and applies the scenario rate only to remaining days. Revenue/profit use the selected ROAS on total EOM spend."
            : "Margin is constant across multipliers by construction — real ROAS typically decays as spend scales, so treat ×5/×10 as upper bounds."}
        </p>
      </Panel>
    </div>
  );
}
