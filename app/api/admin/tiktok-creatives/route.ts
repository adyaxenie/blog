import { NextRequest, NextResponse } from "next/server";
import { ConfigError, fetchRcChart, pickDays, posthogQuery, round2, utcDate } from "@/lib/adminSources";

export const dynamic = "force-dynamic";

// Creative-level TikTok analytics for Daily Glow campaigns only (the ad
// account also runs other products). TikTok "conversions" are PAID purchases
// (the pixel event), not installs — so claimed CPA is compared against actual
// new paying customers from RevenueCat, and spend/installs is reported
// separately as cost-per-install. ATT still makes TikTok undercount paid
// conversions, so the verdict rules lean on watch-time/hook-rate signals,
// which ATT can't hide.

const FIELDS =
  "date,campaign,ad_id,ad_name,spend,impressions,clicks,conversions," +
  "video_play_actions,video_watched_2s,video_watched_6s,average_video_play";

const CAMPAIGN_FILTER = /dailyglowup/i;
const TESTING_CAMPAIGN = /testing/i;
// The account runs ads that bundle several videos under one ad_id (Smart
// Creative). Windsor's rows are inconsistent about it: ad_name may be a video
// title, a title with an "_Ad name2026-06-13 11:43:41" suffix, or just the
// bare "Ad name<created ts>" per-ad fallback — and the same window can come
// back split per video on one call and rolled up per ad on the next. Totals
// are correct either way; the per-video split is best-effort. We key rows by
// ad_id + resolved title, merging title-less rows into an ad's title only
// when the ad has exactly one known title.
const AD_NAME_SUFFIX = / ?_?Ad name\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const AD_NAME_FALLBACK = /^Ad name(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}$/;

// Titles each ad_id has been seen with. Module-scoped so labels survive
// responses where Windsor's title enrichment drops out (warm instances only).
const titlesSeen = new Map<string, Set<string>>();

// Verdict thresholds — from the working playbook: 2.5s+ avg watch time is the
// leading indicator, <2s is an immediate kill, ≤$40 TikTok CPA converts.
const TARGET_CPA = 40;
const EXPENSIVE_CPA = 60;
const SCALE_WATCH = 2.5;
const KILL_WATCH = 2.0;
const MIN_SPEND_FOR_VERDICT = 20;
const NO_CONV_KILL_SPEND = 2 * TARGET_CPA;

type WindsorRow = {
  date: string;
  campaign?: string;
  ad_id?: string | number;
  ad_name?: string;
  spend?: number | string;
  impressions?: number | string;
  clicks?: number | string;
  conversions?: number | string;
  video_play_actions?: number | string;
  video_watched_2s?: number | string;
  video_watched_6s?: number | string;
  average_video_play?: number | string;
};

const num = (v: number | string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type Verdict = "scale" | "watch" | "review" | "kill" | "needs data";

type Creative = {
  id: string;
  name: string;
  type: "test" | "main";
  spend: number;
  spendShare: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number | null;
  ctr: number | null;
  hookRate: number | null; // 2s views / plays
  holdRate: number | null; // 6s views / plays
  avgWatch: number | null; // play-weighted seconds
  verdict: Verdict;
};

function verdictFor(c: Omit<Creative, "verdict" | "spendShare">): Verdict {
  if (c.spend < MIN_SPEND_FOR_VERDICT) return "needs data";
  if (c.avgWatch != null && c.avgWatch < KILL_WATCH) return "kill";
  if (c.conversions === 0 && c.spend >= NO_CONV_KILL_SPEND) return "kill";
  if (
    c.conversions >= 2 &&
    c.cpa != null &&
    c.cpa <= TARGET_CPA &&
    (c.avgWatch == null || c.avgWatch >= SCALE_WATCH)
  ) {
    return "scale";
  }
  if (c.cpa != null && c.cpa > EXPENSIVE_CPA) return "review";
  return "watch";
}

type Rec = { severity: "kill" | "scale" | "test" | "info"; title: string; detail: string };

type Totals = {
  spend: number;
  conversions: number;
  installs: number;
  newPayers: number;
  costPerInstall: number | null;
  paidCac: number | null;
  coverage: number | null;
};

function buildRecommendations(creatives: Creative[], totals: Totals, days: number): Rec[] {
  const recs: Rec[] = [];
  const active = creatives.filter((c) => c.spend > 0);
  const top = active[0];

  if (top && top.spendShare > 0.6) {
    recs.push({
      severity: "info",
      title: `One-creative business: “${top.name}” takes ${Math.round(top.spendShare * 100)}% of spend`,
      detail:
        `Concentration risk — if its delivery dips, everything dips. Film 5–6 variants in one session using it as the exact template ` +
        `(same structure, pacing, audio), put each in its own ABO ad group at $10/day for 48h, keep 2.5s+ watch time survivors.`,
    });
  }

  for (const c of active) {
    if (c.verdict === "kill") {
      recs.push({
        severity: "kill",
        title: `Kill “${c.name}”`,
        detail:
          c.avgWatch != null && c.avgWatch < KILL_WATCH
            ? `Avg watch time ${c.avgWatch.toFixed(2)}s — under the ${KILL_WATCH}s floor. Dead hook; don't wait for conversions.`
            : `${fmt$(c.spend)} spent with 0 claimed conversions (kill line is ${fmt$(NO_CONV_KILL_SPEND)}).`,
      });
    }
    if (c.verdict === "scale" && c.type === "test") {
      recs.push({
        severity: "scale",
        title: `Promote “${c.name}” from ABO into the main CBO`,
        detail: `CPA ${fmt$(c.cpa!)} on ${c.conversions} conversions with ${c.avgWatch?.toFixed(2) ?? "?"}s watch time — proven; let CBO allocate against existing winners.`,
      });
    }
    // High watch time but expensive conversions = content, not an ad.
    if (c.avgWatch != null && c.avgWatch >= 4 && c.cpa != null && c.cpa > TARGET_CPA + 5) {
      recs.push({
        severity: "kill",
        title: `“${c.name}” is content, not an ad`,
        detail: `${c.avgWatch.toFixed(2)}s watch time but ${fmt$(c.cpa)} CPA — it entertains without converting. Retire it unless you can cut a product demo into the format.`,
      });
    }
  }

  // Small-sample winner likely starved by CBO.
  const starved = active.find(
    (c) =>
      c.cpa != null &&
      c.cpa <= TARGET_CPA &&
      c.conversions > 0 &&
      c.conversions <= 2 &&
      c.spendShare < 0.15 &&
      c.verdict !== "kill"
  );
  if (starved) {
    recs.push({
      severity: "test",
      title: `Retest “${starved.name}” in ABO with forced spend`,
      detail: `${fmt$(starved.cpa!)} CPA on only ${starved.conversions} conversion${starved.conversions === 1 ? "" : "s"} and ${Math.round(
        starved.spendShare * 100
      )}% of budget — CBO likely starved it before it could prove out. Give it its own ad group at $10/day for 48–72h.`,
    });
  }

  const testSpend = active.filter((c) => c.type === "test").reduce((s, c) => s + c.spend, 0);
  if (active.length > 0 && testSpend < totals.spend * 0.05) {
    recs.push({
      severity: "test",
      title: "Testing pipeline is nearly empty",
      detail: `ABO test spend is ${fmt$(testSpend)} of ${fmt$(totals.spend)} (${
        totals.spend > 0 ? Math.round((testSpend / totals.spend) * 100) : 0
      }%) over the last ${days}d. Keep a standing batch of 5–6 variants at $10/day — ABO is the pipeline, CBO is the engine.`,
    });
  }

  if (totals.coverage != null && totals.coverage < 0.5 && totals.newPayers > 0) {
    recs.push({
      severity: "info",
      title: `TikTok sees only ${Math.round(totals.coverage * 100)}% of paid conversions (ATT gap)`,
      detail: `TikTok claims ${totals.conversions.toLocaleString()} purchases vs ${totals.newPayers.toLocaleString()} actual new paying customers (RevenueCat). Real paid CAC is ${
        totals.paidCac != null ? fmt$(totals.paidCac) : "—"
      } vs the claimed CPA — and ${
        totals.costPerInstall != null ? fmt$(totals.costPerInstall) : "—"
      }/install. Judge creatives on watch time and hook rate, not TikTok CPA alone.`,
    });
  }

  const order = { kill: 0, scale: 1, test: 2, info: 3 } as const;
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}

const fmt$ = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export async function GET(req: NextRequest) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey || apiKey.startsWith("REPLACE")) {
    return NextResponse.json({
      configured: false,
      error: "Set WINDSOR_API_KEY (from windsor.ai account settings) in .env.local",
    });
  }
  const days = pickDays(req.nextUrl.searchParams.get("days"));

  const phQuery = `
    SELECT
      toStartOfDay(timestamp) AS d,
      uniqIf(person_id, event = 'Application Installed') AS installs
    FROM events
    WHERE event = 'Application Installed'
      AND timestamp >= toStartOfDay(now()) - INTERVAL ${days - 1} DAY
    GROUP BY d
    ORDER BY d
  `;

  try {
    const url =
      `https://connectors.windsor.ai/tiktok?api_key=${encodeURIComponent(apiKey)}` +
      `&date_from=${utcDate(days - 1)}&date_to=${utcDate(0)}&fields=${FIELDS}`;
    // conversion_to_paying measure 1 = customers who paid within 7d of first
    // seen, per cohort day — the "actual purchases" TikTok's pixel undercounts.
    const [windsorRes, phRows, payingChart] = await Promise.all([
      fetch(url, { next: { revalidate: 600 } }),
      posthogQuery(phQuery),
      fetchRcChart("conversion_to_paying").catch(() => null),
    ]);
    if (!windsorRes.ok) {
      const text = await windsorRes.text();
      return NextResponse.json(
        { configured: true, error: `Windsor request failed (${windsorRes.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const payload = await windsorRes.json();
    const rows = ((payload.data ?? []) as WindsorRow[]).filter((r) =>
      CAMPAIGN_FILTER.test(String(r.campaign ?? ""))
    );

    const installsByDay = new Map<string, number>();
    for (const row of phRows as [string, number][]) {
      installsByDay.set(String(row[0]).slice(0, 10), row[1]);
    }

    // First pass: learn which video titles each ad_id carries in this
    // response (feeds the module-level cache used by title-less responses).
    for (const r of rows) {
      const id = String(r.ad_id ?? "");
      const rawName = String(r.ad_name ?? "");
      if (id && rawName && !AD_NAME_FALLBACK.test(rawName)) {
        const title = rawName.replace(AD_NAME_SUFFIX, "").trim();
        if (title) {
          let set = titlesSeen.get(id);
          if (!set) titlesSeen.set(id, (set = new Set()));
          set.add(title);
        }
      }
    }

    // Aggregate per ad_id + resolved title. Watch time is play-weighted.
    type Agg = {
      name: string;
      type: "test" | "main";
      lastActive: string; // latest UTC day with spend
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      plays: number;
      watched2s: number;
      watched6s: number;
      watchSeconds: number; // Σ avg_watch × plays
    };
    const byCreative = new Map<string, Agg>();
    const spendByDay = new Map<string, number>();

    for (const r of rows) {
      const id = String(r.ad_id ?? r.ad_name ?? "(unknown)");
      const day = String(r.date).slice(0, 10);
      spendByDay.set(day, (spendByDay.get(day) ?? 0) + num(r.spend));

      const rawName = String(r.ad_name ?? "");
      const fallback = rawName.match(AD_NAME_FALLBACK);
      const known = titlesSeen.get(id);
      let title: string | null = null;
      if (!fallback) {
        title = rawName.replace(AD_NAME_SUFFIX, "").trim() || null;
      } else if (known && known.size === 1) {
        // Ad has exactly one known video — safe to merge the rolled-up row.
        title = known.values().next().value ?? null;
      }
      const created = fallback ? ` · created ${fallback[1]}` : "";
      const name =
        title ??
        (known && known.size > 1 ? `Multiple videos · ad${created}` : `Untitled ad${created}`);
      const key = title ? `${id}::${title}` : id;

      const a = byCreative.get(key) ?? {
        name,
        type: TESTING_CAMPAIGN.test(String(r.campaign ?? "")) ? ("test" as const) : ("main" as const),
        lastActive: "",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        plays: 0,
        watched2s: 0,
        watched6s: 0,
        watchSeconds: 0,
      };
      if (num(r.spend) > 0 && day > a.lastActive) a.lastActive = day;
      a.spend += num(r.spend);
      a.impressions += num(r.impressions);
      a.clicks += num(r.clicks);
      a.conversions += num(r.conversions);
      a.plays += num(r.video_play_actions);
      a.watched2s += num(r.video_watched_2s);
      a.watched6s += num(r.video_watched_6s);
      a.watchSeconds += num(r.average_video_play) * num(r.video_play_actions);
      byCreative.set(key, a);
    }

    const totalSpend = Array.from(byCreative.values()).reduce((s, a) => s + a.spend, 0);

    const creatives: Creative[] = Array.from(byCreative.entries())
      .filter(([, a]) => a.spend > 0)
      .map(([id, a]) => {
        const base = {
          id,
          name: a.name,
          type: a.type,
          lastActive: a.lastActive,
          spend: round2(a.spend),
          impressions: a.impressions,
          clicks: a.clicks,
          conversions: a.conversions,
          cpa: a.conversions > 0 ? round2(a.spend / a.conversions) : null,
          ctr: a.impressions > 0 ? a.clicks / a.impressions : null,
          hookRate: a.plays > 0 ? a.watched2s / a.plays : null,
          holdRate: a.plays > 0 ? a.watched6s / a.plays : null,
          avgWatch: a.plays > 0 ? round2(a.watchSeconds / a.plays) : null,
        };
        return {
          ...base,
          spendShare: totalSpend > 0 ? base.spend / totalSpend : 0,
          verdict: verdictFor(base),
        };
      })
      // Most recently active first, biggest spender breaking ties; cap at the
      // last 20 creatives.
      .sort((a, b) => b.lastActive.localeCompare(a.lastActive) || b.spend - a.spend)
      .slice(0, 20);

    // Daily cost-per-install series (spend / PostHog installs, both UTC days).
    const daily: { date: string; label: string; spend: number; installs: number; costPerInstall: number | null }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = utcDate(i);
      const spend = round2(spendByDay.get(date) ?? 0);
      const installs = installsByDay.get(date) ?? 0;
      daily.push({
        date,
        label: date.slice(5, 10),
        spend,
        installs,
        costPerInstall: installs > 0 ? round2(spend / installs) : null,
      });
    }

    // Actual new paying customers (RevenueCat) over the same window.
    const payersByDay = new Map((payingChart ?? []).map((r) => [r.date, r.measures[1] ?? 0]));
    let newPayers = 0;
    for (let i = days - 1; i >= 0; i--) newPayers += payersByDay.get(utcDate(i)) ?? 0;

    const totalInstalls = daily.reduce((s, d) => s + d.installs, 0);
    const totalConv = creatives.reduce((s, c) => s + c.conversions, 0);
    const totals: Totals & { tiktokCpa: number | null } = {
      spend: round2(totalSpend),
      conversions: totalConv,
      tiktokCpa: totalConv > 0 ? round2(totalSpend / totalConv) : null,
      installs: totalInstalls,
      newPayers,
      costPerInstall: totalInstalls > 0 ? round2(totalSpend / totalInstalls) : null,
      // TikTok pixel purchases vs actual new payers — like-for-like ATT gap.
      paidCac: newPayers > 0 ? round2(totalSpend / newPayers) : null,
      coverage: newPayers > 0 ? totalConv / newPayers : null,
    };

    return NextResponse.json({
      configured: true,
      days,
      creatives,
      daily,
      totals,
      recommendations: buildRecommendations(creatives, totals, days),
      thresholds: {
        targetCpa: TARGET_CPA,
        scaleWatch: SCALE_WATCH,
        killWatch: KILL_WATCH,
      },
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ configured: false, error: e.message });
    }
    return NextResponse.json(
      { configured: true, error: `TikTok creatives request failed: ${String(e)}` },
      { status: 502 }
    );
  }
}
