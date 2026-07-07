import { NextRequest, NextResponse } from "next/server";
import { wantsFreshRefresh, upstreamCache } from "@/lib/adminSources";

export const dynamic = "force-dynamic";

const RC_BASE = "https://api.revenuecat.com/v2";
const ALLOWED_DAYS = new Set([1, 7, 14, 30, 90]);

type ChartValue = { cohort: number; incomplete: boolean; measure: number; value: number };

export async function GET(req: NextRequest) {
  const apiKey = process.env.REVENUECAT_API_KEY;
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!apiKey || !projectId) {
    return NextResponse.json({ configured: false, error: "REVENUECAT_API_KEY / REVENUECAT_PROJECT_ID not set" });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;
  const fresh = wantsFreshRefresh(req.nextUrl.searchParams);

  const headers = { Authorization: `Bearer ${apiKey}` };
  try {
    const [overviewRes, chartRes] = await Promise.all([
      fetch(`${RC_BASE}/projects/${projectId}/metrics/overview`, {
        headers,
        ...upstreamCache(fresh, 300),
      }),
      fetch(`${RC_BASE}/projects/${projectId}/charts/revenue`, {
        headers,
        ...upstreamCache(fresh, 300),
      }),
    ]);

    if (!overviewRes.ok) {
      return NextResponse.json(
        { configured: true, error: `RevenueCat overview failed (${overviewRes.status})` },
        { status: 502 }
      );
    }

    const overview = await overviewRes.json();

    // charts/revenue: values are (cohort unix-seconds UTC, measure index, value) triples.
    // Measure 0 = Revenue ($), 1 = Transactions (#). Daily resolution; we window
    // to the requested range server-side.
    let series: { date: string; label: string; revenue: number; transactions: number }[] = [];
    let summary: { total: number; average: number } | null = null;
    if (chartRes.ok) {
      const chart = await chartRes.json();
      const byDay = new Map<number, { revenue: number; transactions: number }>();
      for (const v of (chart.values ?? []) as ChartValue[]) {
        const entry = byDay.get(v.cohort) ?? { revenue: 0, transactions: 0 };
        if (v.measure === 0) entry.revenue = v.value;
        if (v.measure === 1) entry.transactions = v.value;
        byDay.set(v.cohort, entry);
      }
      series = Array.from(byDay.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([cohort, m]) => {
          // toISOString is always UTC — no local timezone drift.
          const iso = new Date(cohort * 1000).toISOString();
          return {
            date: iso.slice(0, 10),
            label: iso.slice(5, 10),
            revenue: Math.round(m.revenue * 100) / 100,
            transactions: m.transactions,
          };
        })
        .slice(-days);

      const total = series.reduce((s, r) => s + r.revenue, 0);
      summary = {
        total: Math.round(total * 100) / 100,
        average: series.length ? Math.round((total / series.length) * 100) / 100 : 0,
      };
    }

    return NextResponse.json({
      configured: true,
      days,
      currency: overview.currency,
      metrics: overview.metrics,
      revenueSeries: series,
      revenueSummary: summary,
    });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: `RevenueCat request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
