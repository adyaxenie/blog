import { NextRequest, NextResponse } from "next/server";
import { ConfigError, fetchRcChart, pickDays, round2, wantsFreshRefresh, type RcChartDay } from "@/lib/adminSources";

export const dynamic = "force-dynamic";

// Subscription health from RevenueCat chart endpoints (all probed 200 with
// data): refund_rate, conversion_to_paying. Any endpoint that fails just comes
// back null and its panel is skipped.

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

  const names = ["refund_rate", "conversion_to_paying"] as const;
  let results: PromiseSettledResult<RcChartDay[]>[];
  try {
    results = await Promise.allSettled(names.map((n) => fetchRcChart(n, fresh)));
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

  const [refundRes, convRes] = results;

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

  if (!refunds && !conversion) {
    return NextResponse.json(
      { configured: true, error: "No RevenueCat health charts returned data" },
      { status: 502 }
    );
  }

  return NextResponse.json({ configured: true, days, refunds, conversion });
}
