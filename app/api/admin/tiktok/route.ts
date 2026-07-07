import { NextRequest, NextResponse } from "next/server";
import { ConfigError, pickDays, round2, utcDate, wantsFreshRefresh } from "@/lib/adminSources";
import { fetchTikTokOverviewRows, TikTokRow } from "@/lib/tiktokSpend";

export const dynamic = "force-dynamic";

// TikTok Ads account overview: daily spend/impressions/clicks/conversions
// across all campaigns. Sourced via Supermetrics (Windsor fallback).

const num = (v: number | string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(req: NextRequest) {
  const days = pickDays(req.nextUrl.searchParams.get("days"));
  const fresh = wantsFreshRefresh(req.nextUrl.searchParams);

  try {
    const { source, rows } = await fetchTikTokOverviewRows(utcDate(days - 1), utcDate(0), fresh);

    // Daily series + totals across campaigns.
    const byDay = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>();
    for (const r of rows as TikTokRow[]) {
      const day = String(r.date ?? "").slice(0, 10);
      if (!day) continue;
      const e = byDay.get(day) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      e.spend += num(r.spend);
      e.impressions += num(r.impressions);
      e.clicks += num(r.clicks);
      e.conversions += num(r.conversions);
      byDay.set(day, e);
    }
    const series = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, m]) => ({
        date,
        label: date.slice(5, 10),
        ...m,
        spend: round2(m.spend),
      }));

    const totals = series.reduce(
      (acc, r) => ({
        spend: acc.spend + r.spend,
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        conversions: acc.conversions + r.conversions,
      }),
      { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
    );

    return NextResponse.json({
      configured: true,
      source,
      days,
      series,
      totals: {
        ...totals,
        spend: round2(totals.spend),
        cpa: totals.conversions > 0 ? round2(totals.spend / totals.conversions) : null,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : null,
      },
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ configured: false, error: e.message });
    }
    return NextResponse.json(
      { configured: true, error: `TikTok overview request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
