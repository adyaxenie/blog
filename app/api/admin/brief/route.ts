import { NextRequest, NextResponse } from "next/server";
import {
  ConfigError,
  fetchRcChart,
  posthogQuery,
  round2,
  utcDate,
  wantsFreshRefresh,
} from "@/lib/adminSources";
import { fetchTikTokSpend } from "@/lib/tiktokSpend";

export const dynamic = "force-dynamic";

// Daily brief: yesterday (full UTC day) vs the trailing 7-day average
// (the 7 full days before yesterday). Fixed window — ignores the range selector.

type DayNums = { installs: number; viewed: number; continued: number };

export async function GET(req: NextRequest) {
  const fresh = wantsFreshRefresh(req.nextUrl.searchParams);
  const yesterday = utcDate(1);
  // Baseline: utcDate(8) .. utcDate(2), 7 full UTC days.
  const baselineDates = Array.from({ length: 7 }, (_, i) => utcDate(8 - i));

  const phQuery = `
    SELECT
      toStartOfDay(timestamp) AS d,
      uniqIf(person_id, event = 'Application Installed') AS installs,
      uniqIf(person_id, event = 'onboarding_premium_viewed') AS viewed,
      uniqIf(person_id, event = 'onboarding_premium_continued') AS continued
    FROM events
    WHERE event IN ('Application Installed', 'onboarding_premium_viewed', 'onboarding_premium_continued')
      AND timestamp >= toStartOfDay(now()) - INTERVAL 8 DAY
      AND timestamp < toStartOfDay(now())
    GROUP BY d
    ORDER BY d
  `;

  try {
    const [spendByDay, revenueChart, phRows] = await Promise.all([
      fetchTikTokSpend(utcDate(8), yesterday, fresh),
      fetchRcChart("revenue", fresh),
      posthogQuery(phQuery, fresh),
    ]);

    const rcByDay = new Map(revenueChart.map((r) => [r.date, r]));
    const phByDay = new Map<string, DayNums>();
    for (const row of phRows as [string, number, number, number][]) {
      phByDay.set(String(row[0]).slice(0, 10), {
        installs: row[1],
        viewed: row[2],
        continued: row[3],
      });
    }

    const dayStats = (date: string) => {
      const ph = phByDay.get(date);
      const rc = rcByDay.get(date);
      return {
        revenue: rc?.measures[0] ?? 0,
        transactions: rc?.measures[1] ?? 0,
        spend: spendByDay.get(date) ?? 0,
        installs: ph?.installs ?? 0,
        viewed: ph?.viewed ?? 0,
        continued: ph?.continued ?? 0,
      };
    };

    const y = dayStats(yesterday);
    const base = baselineDates.map(dayStats);
    const sum = (f: (d: ReturnType<typeof dayStats>) => number) =>
      base.reduce((s, d) => s + f(d), 0);

    const ratio = (num: number, den: number) => (den > 0 ? num / den : null);
    const delta = (val: number | null, ref: number | null) =>
      val != null && ref != null && ref > 0 ? (val - ref) / ref : null;

    const baseRevenueAvg = sum((d) => d.revenue) / 7;
    const baseSpendAvg = sum((d) => d.spend) / 7;
    const baseInstallsAvg = sum((d) => d.installs) / 7;
    // Rates are aggregated over the whole baseline week (more stable than
    // averaging 7 daily rates).
    const basePaywallPct = ratio(sum((d) => d.continued), sum((d) => d.viewed));
    const baseCac = ratio(sum((d) => d.spend), sum((d) => d.transactions));

    const yPaywallPct = ratio(y.continued, y.viewed);
    const yCac = ratio(y.spend, y.transactions);

    const items = [
      {
        key: "revenue",
        label: "Revenue",
        kind: "money",
        value: round2(y.revenue),
        baseline: round2(baseRevenueAvg),
        deltaPct: delta(y.revenue, baseRevenueAvg),
        betterWhen: "up",
      },
      {
        key: "spend",
        label: "Spend",
        kind: "money",
        value: round2(y.spend),
        baseline: round2(baseSpendAvg),
        deltaPct: delta(y.spend, baseSpendAvg),
        betterWhen: "down",
      },
      {
        key: "installs",
        label: "Installs",
        kind: "count",
        value: y.installs,
        baseline: Math.round(baseInstallsAvg),
        deltaPct: delta(y.installs, baseInstallsAvg),
        betterWhen: "up",
      },
      {
        key: "paywall",
        label: "Paywall view → continue",
        kind: "pct",
        value: yPaywallPct,
        baseline: basePaywallPct,
        deltaPct: delta(yPaywallPct, basePaywallPct),
        betterWhen: "up",
      },
      {
        key: "cac",
        label: "Spend / txn",
        kind: "money2",
        value: yCac != null ? round2(yCac) : null,
        baseline: baseCac != null ? round2(baseCac) : null,
        deltaPct: delta(yCac, baseCac),
        betterWhen: "down",
      },
    ];

    return NextResponse.json({
      configured: true,
      date: yesterday,
      baselineRange: `${baselineDates[0]} → ${baselineDates[6]}`,
      items,
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ configured: false, error: e.message });
    }
    return NextResponse.json(
      { configured: true, error: `Daily brief request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
