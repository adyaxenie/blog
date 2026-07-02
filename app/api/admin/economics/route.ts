import { NextRequest, NextResponse } from "next/server";
import {
  ConfigError,
  fetchRcChart,
  fetchRcOverview,
  fetchWindsorSpend,
  mondayOf,
  pickDays,
  round2,
  utcDate,
} from "@/lib/adminSources";

export const dynamic = "force-dynamic";

// Blended CAC + spend-vs-revenue economics. Windsor TikTok spend merged with
// RevenueCat revenue/transactions per UTC day. Blended CAC uses a matched
// 28-day window because RC's new_customers overview metric is fixed at 28 days;
// the per-range CAC-proxy (spend / transactions) covers the selected range.
export async function GET(req: NextRequest) {
  const days = pickDays(req.nextUrl.searchParams.get("days"));
  // Always fetch at least 28 days of spend so blended CAC has its full window.
  const spendWindow = Math.max(days, 28);

  try {
    const [spendByDay, revenueChart, overview] = await Promise.all([
      fetchWindsorSpend(utcDate(spendWindow - 1), utcDate(0)),
      fetchRcChart("revenue"),
      fetchRcOverview(),
    ]);

    const revenueByDay = new Map(revenueChart.map((r) => [r.date, r]));

    // Daily series across the selected range (missing days → 0).
    const daily: { date: string; spend: number; revenue: number; transactions: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = utcDate(i);
      const rc = revenueByDay.get(date);
      daily.push({
        date,
        spend: round2(spendByDay.get(date) ?? 0),
        revenue: round2(rc?.measures[0] ?? 0),
        transactions: rc?.measures[1] ?? 0,
      });
    }

    // Bucket weekly (Monday UTC) for long ranges so the overlay stays readable.
    const bucket: "day" | "week" = days >= 30 ? "week" : "day";
    let series: { date: string; label: string; spend: number; revenue: number; transactions: number }[];
    if (bucket === "week") {
      const byWeek = new Map<string, { spend: number; revenue: number; transactions: number }>();
      for (const d of daily) {
        const wk = mondayOf(d.date);
        const e = byWeek.get(wk) ?? { spend: 0, revenue: 0, transactions: 0 };
        e.spend += d.spend;
        e.revenue += d.revenue;
        e.transactions += d.transactions;
        byWeek.set(wk, e);
      }
      series = Array.from(byWeek.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, m]) => ({
          date,
          label: date.slice(5, 10),
          spend: round2(m.spend),
          revenue: round2(m.revenue),
          transactions: m.transactions,
        }));
    } else {
      series = daily.map((d) => ({ ...d, label: d.date.slice(5, 10) }));
    }

    const totals = daily.reduce(
      (acc, d) => ({
        spend: acc.spend + d.spend,
        revenue: acc.revenue + d.revenue,
        transactions: acc.transactions + d.transactions,
      }),
      { spend: 0, revenue: 0, transactions: 0 }
    );

    // Blended CAC: last-28d spend / last-28d new customers (matched windows).
    let spend28d = 0;
    for (let i = 27; i >= 0; i--) spend28d += spendByDay.get(utcDate(i)) ?? 0;
    const newCustomers28d = overview.find((m) => m.id === "new_customers")?.value ?? 0;

    return NextResponse.json({
      configured: true,
      days,
      bucket,
      series,
      totals: {
        spend: round2(totals.spend),
        revenue: round2(totals.revenue),
        transactions: totals.transactions,
        net: round2(totals.revenue - totals.spend),
        cacProxy: totals.transactions > 0 ? round2(totals.spend / totals.transactions) : null,
      },
      blended: {
        spend28d: round2(spend28d),
        newCustomers28d,
        cac: newCustomers28d > 0 ? round2(spend28d / newCustomers28d) : null,
      },
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ configured: false, error: e.message });
    }
    return NextResponse.json(
      { configured: true, error: `Economics request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
