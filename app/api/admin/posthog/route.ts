import { NextRequest, NextResponse } from "next/server";
import { upstreamCache, wantsFreshRefresh } from "@/lib/adminSources";

export const dynamic = "force-dynamic";

// Allowed range filters (days). 1 day renders hourly, everything else daily.
const ALLOWED_DAYS = new Set([1, 7, 14, 30, 90]);

// All times UTC: the PostHog project timezone is UTC and HogQL timestamps are UTC.
function buildQuery(days: number): string {
  const bucket = days === 1 ? "toStartOfHour(timestamp)" : "toStartOfDay(timestamp)";
  const interval = days === 1 ? "INTERVAL 24 HOUR" : `INTERVAL ${days} DAY`;
  return `
    SELECT
      ${bucket} AS bucket,
      countIf(event = 'Application Installed') AS installs,
      countIf(event = 'onboarding_completed') AS completions
    FROM events
    WHERE event IN ('Application Installed', 'onboarding_completed')
      AND timestamp >= now() - ${interval}
    GROUP BY bucket
    ORDER BY bucket
  `;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || apiKey.startsWith("REPLACE") || !projectId) {
    return NextResponse.json({
      configured: false,
      error: "Set POSTHOG_API_KEY (personal API key with Query Read scope) in .env.local",
    });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;
  const fresh = wantsFreshRefresh(req.nextUrl.searchParams);

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: buildQuery(days) } }),
      ...upstreamCache(fresh, 300),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { configured: true, error: `PostHog query failed (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const series = (data.results ?? []).map((row: [string, number, number]) => {
      const iso = String(row[0]);
      return {
        // Pre-formatted UTC labels; no client-side Date conversion.
        label: days === 1 ? `${iso.slice(11, 13)}:00` : iso.slice(5, 10),
        date: iso.slice(0, days === 1 ? 16 : 10),
        installs: row[1],
        completions: row[2],
      };
    });

    const totals = series.reduce(
      (acc: { installs: number; completions: number }, r: { installs: number; completions: number }) => ({
        installs: acc.installs + r.installs,
        completions: acc.completions + r.completions,
      }),
      { installs: 0, completions: 0 }
    );

    return NextResponse.json({
      configured: true,
      days,
      series,
      totals,
      conversionRate: totals.installs > 0 ? totals.completions / totals.installs : null,
    });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: `PostHog request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
