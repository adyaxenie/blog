import { NextRequest, NextResponse } from "next/server";
import { ConfigError, fetchRcChart, pickDays, round2, type RcChartDay } from "@/lib/adminSources";

export const dynamic = "force-dynamic";

// Subscription health from RevenueCat chart endpoints (all probed 200 with
// data): churn, refund_rate, conversion_to_paying, actives_movement. Any
// endpoint that fails just comes back null and its panel is skipped.

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

  const names = ["churn", "refund_rate", "conversion_to_paying", "actives_movement"] as const;
  let results: PromiseSettledResult<RcChartDay[]>[];
  try {
    results = await Promise.allSettled(names.map((n) => fetchRcChart(n)));
  } catch (e) {
    return NextResponse.json({ configured: false, error: String(e) });
  }
  // Env errors surface identically from every chart — report once.
  const configErr = results.find(
    (r) => r.status === "rejected" && r.reason instanceof ConfigError
  );
  if (configErr && configErr.status === "rejected") {
    return NextResponse.json({ configured: false, error: String(configErr.reason.message) });
  }

  const [churnRes, refundRes, convRes, moveRes] = results;

  // churn measures: 0 actives, 1 churned, 2 churn rate %
  let churn = null;
  if (churnRes.status === "fulfilled" && churnRes.value.length) {
    const rows = windowed(churnRes.value, days);
    const totalChurned = rows.reduce((s, r) => s + (r.measures[1] ?? 0), 0);
    churn = {
      series: rows.map((r) => ({
        date: r.date,
        label: r.label,
        actives: r.measures[0] ?? 0,
        churned: r.measures[1] ?? 0,
        rate: round2(r.measures[2] ?? 0),
      })),
      totalChurned,
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

  // actives_movement measures: 0 new, 1 resubscribed, 2 churned, 3 net movement
  let movement = null;
  if (moveRes.status === "fulfilled" && moveRes.value.length) {
    const rows = windowed(moveRes.value, days);
    movement = {
      series: rows.map((r) => ({
        date: r.date,
        label: r.label,
        newActives: r.measures[0] ?? 0,
        resubscribed: r.measures[1] ?? 0,
        churned: r.measures[2] ?? 0,
        movement: r.measures[3] ?? 0,
      })),
      net: rows.reduce((s, r) => s + (r.measures[3] ?? 0), 0),
    };
  }

  if (!churn && !refunds && !conversion && !movement) {
    return NextResponse.json(
      { configured: true, error: "No RevenueCat health charts returned data" },
      { status: 502 }
    );
  }

  return NextResponse.json({ configured: true, days, churn, refunds, conversion, movement });
}
