import { NextRequest, NextResponse } from "next/server";
import {
  APPLE_PROCEEDS_RATE,
  ConfigError,
  fetchRcChart,
  round2,
  utcDate,
  wantsFreshRefresh,
  withUpstreamRetry,
} from "@/lib/adminSources";
import { fetchTikTokSpend } from "@/lib/tiktokSpend";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Monthly P&L actuals (calendar months, UTC) plus the run-rate basis the
// Projections tab uses to model scenarios: revenue = spend × ROAS,
// proceeds = revenue × 0.85, gross profit = proceeds − spend.
export async function GET(req: NextRequest) {
  const fresh = wantsFreshRefresh(req.nextUrl.searchParams);
  // First day of the calendar month 5 months back → up to 6 month columns.
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
    .toISOString()
    .slice(0, 10);
  const today = utcDate(0);

  try {
    // Retry each upstream independently — projections is a long Supermetrics
    // window and often loses under the overview load stampede.
    const [spendByDay, revenueChart] = await Promise.all([
      withUpstreamRetry(() => fetchTikTokSpend(from, today, fresh)),
      withUpstreamRetry(() => fetchRcChart("revenue", fresh)),
    ]);
    const revenueByDay = new Map(revenueChart.map((r) => [r.date, r.measures[0] ?? 0]));

    // Walk every day in range, bucket by YYYY-MM.
    const byMonth = new Map<string, { spend: number; revenue: number }>();
    for (
      let t = Date.parse(`${from}T00:00:00Z`);
      t <= Date.parse(`${today}T00:00:00Z`);
      t += 86_400_000
    ) {
      const date = new Date(t).toISOString().slice(0, 10);
      const key = date.slice(0, 7);
      const e = byMonth.get(key) ?? { spend: 0, revenue: 0 };
      e.spend += spendByDay.get(date) ?? 0;
      e.revenue += revenueByDay.get(date) ?? 0;
      byMonth.set(key, e);
    }

    const currentMonth = today.slice(0, 7);
    const months = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([month, m]) => m.spend > 0 || m.revenue > 0 || month === currentMonth)
      .map(([month, m]) => {
        const spend = round2(m.spend);
        const revenue = round2(m.revenue);
        const proceeds = round2(revenue * APPLE_PROCEEDS_RATE);
        const grossProfit = round2(proceeds - spend);
        return {
          month,
          label: `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`,
          partial: month === currentMonth,
          spend,
          revenue,
          proceeds,
          grossProfit,
          margin: spend > 0 ? round2(grossProfit / spend) : null,
          roas: spend > 0 ? round2(revenue / spend) : null,
        };
      });

    // Run-rate basis: recent daily spend + realized ROAS over matched windows.
    const windowSums = (n: number) => {
      let spend = 0;
      let revenue = 0;
      for (let i = n - 1; i >= 0; i--) {
        const date = utcDate(i);
        spend += spendByDay.get(date) ?? 0;
        revenue += revenueByDay.get(date) ?? 0;
      }
      return { spend, revenue };
    };
    const w7 = windowSums(7);
    const w30 = windowSums(30);

    return NextResponse.json({
      configured: true,
      months,
      basis: {
        dailySpend7d: round2(w7.spend / 7),
        dailySpend30d: round2(w30.spend / 30),
        roas7d: w7.spend > 0 ? round2(w7.revenue / w7.spend) : null,
        roas30d: w30.spend > 0 ? round2(w30.revenue / w30.spend) : null,
        appleRate: APPLE_PROCEEDS_RATE,
      },
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ configured: false, error: e.message });
    }
    return NextResponse.json(
      { configured: true, error: `Projections request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
