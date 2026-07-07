import { NextRequest, NextResponse } from "next/server";
import {
  ConfigError,
  addDays,
  fetchRcChart,
  fmtDateRange,
  mondayOf,
  posthogQuery,
  round2,
  utcDate,
  wantsFreshRefresh,
} from "@/lib/adminSources";
import { fetchTikTokSpend } from "@/lib/tiktokSpend";

export const dynamic = "force-dynamic";

// Weekly report: last 4 complete UTC weeks (Mon–Sun). Fixed window — ignores
// the range selector.
export async function GET(req: NextRequest) {
  const fresh = wantsFreshRefresh(req.nextUrl.searchParams);
  const currentMonday = mondayOf(utcDate(0)); // Monday of the in-progress week
  const weekStarts = [4, 3, 2, 1].map((i) => addDays(currentMonday, -7 * i));
  const firstDay = weekStarts[0];
  const lastDay = addDays(weekStarts[3], 6); // last complete Sunday
  const endExclusive = addDays(lastDay, 1);

  const phQuery = `
    SELECT
      toMonday(timestamp) AS wk,
      uniqIf(person_id, event = 'Application Installed') AS installs,
      uniqIf(person_id, event = 'onboarding_completed') AS completed,
      uniqIf(person_id, event = 'onboarding_premium_viewed') AS viewed,
      uniqIf(person_id, event = 'onboarding_premium_continued') AS continued
    FROM events
    WHERE event IN ('Application Installed', 'onboarding_completed', 'onboarding_premium_viewed', 'onboarding_premium_continued')
      AND timestamp >= toDateTime('${firstDay} 00:00:00')
      AND timestamp < toDateTime('${endExclusive} 00:00:00')
    GROUP BY wk
    ORDER BY wk
  `;

  try {
    const [spendByDay, revenueChart, phRows] = await Promise.all([
      fetchTikTokSpend(firstDay, lastDay, fresh),
      fetchRcChart("revenue", fresh),
      posthogQuery(phQuery, fresh),
    ]);

    const phByWeek = new Map<string, { installs: number; completed: number; viewed: number; continued: number }>();
    for (const row of phRows as [string, number, number, number, number][]) {
      phByWeek.set(String(row[0]).slice(0, 10), {
        installs: row[1],
        completed: row[2],
        viewed: row[3],
        continued: row[4],
      });
    }

    const rcByDay = new Map(revenueChart.map((r) => [r.date, r.measures[0] ?? 0]));

    const pct = (num: number, den: number) => (den > 0 ? num / den : null);

    const weeks = weekStarts.map((start) => {
      const end = addDays(start, 6);
      let revenue = 0;
      let spend = 0;
      for (let d = start; d <= end; d = addDays(d, 1)) {
        revenue += rcByDay.get(d) ?? 0;
        spend += spendByDay.get(d) ?? 0;
      }
      const ph = phByWeek.get(start) ?? { installs: 0, completed: 0, viewed: 0, continued: 0 };
      return {
        start,
        end,
        label: fmtDateRange(start, end),
        revenue: round2(revenue),
        spend: round2(spend),
        installs: ph.installs,
        onboardingPct: pct(ph.completed, ph.installs),
        paywallPct: pct(ph.continued, ph.viewed),
      };
    });

    // Week-over-week relative deltas per metric (null for the first week).
    const wow = (get: (w: (typeof weeks)[number]) => number | null) =>
      weeks.map((w, i) => {
        if (i === 0) return null;
        const cur = get(w);
        const prev = get(weeks[i - 1]);
        return cur != null && prev != null && prev > 0 ? (cur - prev) / prev : null;
      });

    return NextResponse.json({
      configured: true,
      weeks,
      deltas: {
        revenue: wow((w) => w.revenue),
        spend: wow((w) => w.spend),
        installs: wow((w) => w.installs),
        onboardingPct: wow((w) => w.onboardingPct),
        paywallPct: wow((w) => w.paywallPct),
      },
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ configured: false, error: e.message });
    }
    return NextResponse.json(
      { configured: true, error: `Weekly report request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
