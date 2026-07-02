import { NextRequest, NextResponse } from "next/server";
import { ConfigError, pickDays, posthogQuery } from "@/lib/adminSources";

export const dynamic = "force-dynamic";

// Paywall funnel: unique persons per step over the selected range (UTC).
const STEPS = [
  { event: "Application Installed", label: "Installed" },
  { event: "onboarding_completed", label: "Onboarding completed" },
  { event: "onboarding_premium_viewed", label: "Paywall viewed" },
  { event: "onboarding_premium_continued", label: "Paywall continued" },
] as const;

export async function GET(req: NextRequest) {
  const days = pickDays(req.nextUrl.searchParams.get("days"));
  const interval = days === 1 ? "INTERVAL 24 HOUR" : `INTERVAL ${days} DAY`;
  const eventList = STEPS.map((s) => `'${s.event}'`).join(", ");
  const selects = STEPS.map(
    (s, i) => `uniqIf(person_id, event = '${s.event}') AS step${i}`
  ).join(",\n      ");
  const query = `
    SELECT
      ${selects}
    FROM events
    WHERE event IN (${eventList})
      AND timestamp >= now() - ${interval}
  `;

  try {
    const rows = await posthogQuery(query);
    const counts = (rows[0] ?? []).map((v) => Number(v) || 0);
    const first = counts[0] ?? 0;
    const steps = STEPS.map((s, i) => {
      const count = counts[i] ?? 0;
      const prev = i === 0 ? null : counts[i - 1] ?? 0;
      return {
        event: s.event,
        label: s.label,
        count,
        // Step-to-step and overall conversion, computed server-side.
        pctOfPrev: prev == null ? null : prev > 0 ? count / prev : null,
        pctOfFirst: first > 0 ? count / first : null,
      };
    });

    return NextResponse.json({ configured: true, days, steps });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ configured: false, error: e.message });
    }
    return NextResponse.json(
      { configured: true, error: `Funnel request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
