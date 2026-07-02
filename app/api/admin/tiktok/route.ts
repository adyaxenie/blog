import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// TikTok Ads metrics via the Windsor.ai connector REST API.
const FIELDS = "date,campaign,spend,impressions,clicks,conversions";
const ALLOWED_DAYS = new Set([1, 7, 14, 30, 90]);

type WindsorRow = {
  date: string;
  campaign?: string;
  spend?: number | string;
  impressions?: number | string;
  clicks?: number | string;
  conversions?: number | string;
};

const num = (v: number | string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// UTC calendar date, N days back.
function utcDate(daysBack: number): string {
  const d = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey || apiKey.startsWith("REPLACE")) {
    return NextResponse.json({
      configured: false,
      error: "Set WINDSOR_API_KEY (from windsor.ai account settings) in .env.local",
    });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;

  try {
    const url =
      `https://connectors.windsor.ai/tiktok?api_key=${encodeURIComponent(apiKey)}` +
      `&date_from=${utcDate(days - 1)}&date_to=${utcDate(0)}&fields=${FIELDS}`;
    const res = await fetch(url, { next: { revalidate: 600 } });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { configured: true, error: `Windsor request failed (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const payload = await res.json();
    const rows: WindsorRow[] = payload.data ?? [];

    // Daily series + totals across campaigns.
    const byDay = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>();
    for (const r of rows) {
      const day = String(r.date).slice(0, 10);
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
        spend: Math.round(m.spend * 100) / 100,
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
      days,
      series,
      totals: {
        ...totals,
        spend: Math.round(totals.spend * 100) / 100,
        cpa: totals.conversions > 0 ? Math.round((totals.spend / totals.conversions) * 100) / 100 : null,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: `Windsor request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
