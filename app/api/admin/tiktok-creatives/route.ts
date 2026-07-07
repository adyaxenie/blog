import { NextRequest, NextResponse } from "next/server";
import { ConfigError, fetchRcChart, pickDays, posthogQuery, round2, utcDate, wantsFreshRefresh } from "@/lib/adminSources";
import { fetchTikTokCreativeRows, TikTokRow } from "@/lib/tiktokSpend";

export const dynamic = "force-dynamic";

// Creative-level TikTok analytics for Daily Glow campaigns only (the ad
// account also runs other products). TikTok "conversions" are PAID purchases
// (the pixel event), not installs — so claimed CPA is compared against actual
// new paying customers from RevenueCat, and spend/installs is reported
// separately as cost-per-install. ATT still makes TikTok undercount paid
// conversions, so the verdict rules lean on watch-time/hook-rate signals,
// which ATT can't hide.
//
// Data comes from Supermetrics (Windsor fallback) at ad_id + ad_name
// granularity. `campaign_name` carries the full "Real Title _Ad name<ts>"
// format from TikTok Smart Creative. Note: average watch time
// (`average_video_play`) is only available via the Windsor fallback; under
// Supermetrics `avgWatch` is null and the verdict leans on hook/hold rates.

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

const num = (v: number | string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type Verdict = "scale" | "watch" | "review" | "kill" | "needs data";

type Creative = {
  id: string;
  name: string;
  campaign: string;
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

type Totals = {
  spend: number;
  conversions: number;
  tiktokCpa: number | null;
  installs: number;
  newPayers: number;
  costPerInstall: number | null;
  paidCac: number | null;
  coverage: number | null;
};

export async function GET(req: NextRequest) {
  const days = pickDays(req.nextUrl.searchParams.get("days"));
  const fresh = wantsFreshRefresh(req.nextUrl.searchParams);
  const campaignParam = req.nextUrl.searchParams.get("campaign");

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
    const [ttFetch, phRows, payingChart] = await Promise.all([
      fetchTikTokCreativeRows(utcDate(days - 1), utcDate(0), fresh),
      posthogQuery(phQuery, fresh),
      fetchRcChart("conversion_to_paying", fresh).catch(() => null),
    ]);

    const cn = (r: TikTokRow) => String(r.campaign_name ?? "");
    // Daily Glow campaigns only (the ad account also runs other products).
    const dgRows = ttFetch.rows.filter((r) => CAMPAIGN_FILTER.test(cn(r)));

    // Campaign summary across all Daily Glow campaigns (drives the UI filter
    // dropdown) — built before applying the per-campaign filter below.
    const campMap = new Map<string, { name: string; spend: number; type: "test" | "main" }>();
    for (const r of dgRows) {
      const name = cn(r) || "(unknown campaign)";
      const e =
        campMap.get(name) ??
        { name, spend: 0, type: TESTING_CAMPAIGN.test(name) ? ("test" as const) : ("main" as const) };
      e.spend += num(r.spend);
      campMap.set(name, e);
    }
    const campaigns = Array.from(campMap.values())
      .map((c) => ({ ...c, spend: round2(c.spend) }))
      .sort((a, b) => b.spend - a.spend);

    // Optional single-campaign filter; ignored if the name isn't recognized.
    const activeCampaign = campaignParam && campMap.has(campaignParam) ? campaignParam : null;
    const rows = activeCampaign ? dgRows.filter((r) => cn(r) === activeCampaign) : dgRows;

    const installsByDay = new Map<string, number>();
    for (const row of phRows as [string, number][]) {
      installsByDay.set(String(row[0]).slice(0, 10), row[1]);
    }

    const spendByDay = new Map<string, number>();
    for (const r of rows) {
      const day = String(r.date ?? "").slice(0, 10);
      if (day) spendByDay.set(day, (spendByDay.get(day) ?? 0) + num(r.spend));
    }

    // First pass: learn which video titles each ad_id carries.
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
      campaign: string;
      type: "test" | "main";
      lastActive: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      plays: number;
      watched2s: number;
      watched6s: number;
      watchSeconds: number; // Σ avg_watch × plays
      hasWatch: boolean; // avg_watch provided by the source (Windsor only)
    };
    const byCreative = new Map<string, Agg>();

    for (const r of rows) {
      const id = String(r.ad_id ?? r.ad_name ?? "(unknown)");
      const day = String(r.date ?? "").slice(0, 10);

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
        campaign: cn(r) || "(unknown campaign)",
        type: TESTING_CAMPAIGN.test(cn(r)) ? ("test" as const) : ("main" as const),
        lastActive: "",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        plays: 0,
        watched2s: 0,
        watched6s: 0,
        watchSeconds: 0,
        hasWatch: false,
      };
      if (num(r.spend) > 0 && day > a.lastActive) a.lastActive = day;
      a.spend += num(r.spend);
      a.impressions += num(r.impressions);
      a.clicks += num(r.clicks);
      a.conversions += num(r.conversions);
      a.plays += num(r.video_play_actions);
      a.watched2s += num(r.video_watched_2s);
      a.watched6s += num(r.video_watched_6s);
      // average_video_play is only present via the Windsor fallback; when the
      // source omits it (Supermetrics), avgWatch stays null instead of 0 so the
      // watch-time kill rule doesn't misfire.
      if (r.average_video_play != null) {
        a.hasWatch = true;
        a.watchSeconds += num(r.average_video_play) * num(r.video_play_actions);
      }
      byCreative.set(key, a);
    }

    const totalSpend = Array.from(byCreative.values()).reduce((s, a) => s + a.spend, 0);

    const creatives: Creative[] = Array.from(byCreative.entries())
      .filter(([, a]) => a.spend > 0)
      .map(([id, a]) => {
        const base = {
          id,
          name: a.name,
          campaign: a.campaign,
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
          avgWatch: a.hasWatch && a.plays > 0 ? round2(a.watchSeconds / a.plays) : null,
        };
        return {
          ...base,
          spendShare: totalSpend > 0 ? base.spend / totalSpend : 0,
          verdict: verdictFor(base),
        };
      })
      // Most recently active first, biggest spender breaking ties; cap at 50.
      .sort((a, b) => b.lastActive.localeCompare(a.lastActive) || b.spend - a.spend)
      .slice(0, 50);

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
    const totals: Totals = {
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
      source: ttFetch.source,
      days,
      campaigns,
      filter: { campaign: activeCampaign },
      creatives,
      daily,
      totals,
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
