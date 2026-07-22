import { NextRequest, NextResponse } from "next/server";
import {
  ConfigError,
  fetchRcChart,
  fetchRcOverview,
  pickDays,
  round2,
  wantsFreshRefresh,
  type RcChartDay,
} from "@/lib/adminSources";

export const dynamic = "force-dynamic";

// Unified RevenueCat pull for the dashboard and Claude: overview KPIs plus the
// three charts we track (revenue, refund_rate, conversion_to_paying) in one GET.
// Overview is core (its failure is a 502); each health chart degrades to null so
// a single failing chart never blanks the whole response.

function windowed(rows: RcChartDay[], days: number) {
  return rows.slice(-days).map((r) => ({
    date: r.date,
    label: r.date.slice(5, 10),
    incomplete: r.incomplete,
    measures: r.measures,
  }));
}

export async function GET(req: NextRequest) {
  const days = pickDays(req.nextUrl.searchParams.get("days"));
  const fresh = wantsFreshRefresh(req.nextUrl.searchParams);

  let overview: Awaited<ReturnType<typeof fetchRcOverview>>;
  try {
    overview = await fetchRcOverview(fresh);
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ configured: false, error: e.message });
    }
    return NextResponse.json(
      { configured: true, error: `RevenueCat overview failed: ${String(e)}` },
      { status: 502 }
    );
  }

  const [revenueRes, refundRes, convRes] = await Promise.allSettled([
    fetchRcChart("revenue", fresh),
    fetchRcChart("refund_rate", fresh),
    fetchRcChart("conversion_to_paying", fresh),
  ]);

  // revenue measures: 0 revenue ($), 1 transactions (#)
  let revenueSeries: { date: string; label: string; revenue: number; transactions: number }[] = [];
  let revenueSummary: { total: number; average: number } | null = null;
  if (revenueRes.status === "fulfilled" && revenueRes.value.length) {
    const rows = windowed(revenueRes.value, days);
    revenueSeries = rows.map((r) => ({
      date: r.date,
      label: r.label,
      revenue: round2(r.measures[0] ?? 0),
      transactions: r.measures[1] ?? 0,
    }));
    const total = revenueSeries.reduce((s, r) => s + r.revenue, 0);
    revenueSummary = {
      total: round2(total),
      average: revenueSeries.length ? round2(total / revenueSeries.length) : 0,
    };
  }

  // refund_rate measures: 0 transactions, 1 refunded, 2 refund rate %
  let refunds = null;
  if (refundRes.status === "fulfilled" && refundRes.value.length) {
    const rows = windowed(refundRes.value, days);
    const totalTx = rows.reduce((s, r) => s + (r.measures[0] ?? 0), 0);
    const totalRefunded = rows.reduce((s, r) => s + (r.measures[1] ?? 0), 0);
    refunds = {
      series: rows.map((r) => ({
        date: r.date,
        label: r.label,
        transactions: r.measures[0] ?? 0,
        refunded: r.measures[1] ?? 0,
        rate: round2(r.measures[2] ?? 0),
      })),
      totalRefunded,
      overallRate: totalTx > 0 ? round2((totalRefunded / totalTx) * 100) : null,
    };
  }

  // conversion_to_paying measures: 0 new customers, 1 paying within 7d, 2 rate %
  let conversion = null;
  if (convRes.status === "fulfilled" && convRes.value.length) {
    const rows = windowed(convRes.value, days);
    const totalNew = rows.reduce((s, r) => s + (r.measures[0] ?? 0), 0);
    const totalPaying = rows.reduce((s, r) => s + (r.measures[1] ?? 0), 0);
    conversion = {
      series: rows.map((r) => ({
        date: r.date,
        label: r.label,
        newCustomers: r.measures[0] ?? 0,
        paying: r.measures[1] ?? 0,
        rate: round2(r.measures[2] ?? 0),
      })),
      totalPaying,
      overallRate: totalNew > 0 ? round2((totalPaying / totalNew) * 100) : null,
    };
  }

  return NextResponse.json({
    configured: true,
    days,
    currency: overview.currency,
    metrics: overview.metrics,
    revenueSeries,
    revenueSummary,
    refunds,
    conversion,
  });
}
