// Shared upstream fetch helpers for the admin metric API routes.
// All dates are UTC; labels are formatted server-side from ISO strings.

const RC_BASE = "https://api.revenuecat.com/v2";

export const ALLOWED_DAYS = new Set([1, 7, 14, 30, 90]);

/** Gross revenue × this rate ≈ App Store proceeds after Apple's 15% cut. */
export const APPLE_PROCEEDS_RATE = 0.85;

export function pickDays(param: string | null, fallback = 30): number {
  const n = Number(param);
  return ALLOWED_DAYS.has(n) ? n : fallback;
}

/** Client sends `?refresh=1` to bypass Next.js upstream fetch cache. */
export function wantsFreshRefresh(params: URLSearchParams | null | undefined): boolean {
  return params?.get("refresh") === "1";
}

export function upstreamCache(fresh: boolean, revalidate = 300): RequestInit {
  return fresh ? { cache: "no-store" } : { next: { revalidate } };
}

// UTC calendar date, N days back.
export function utcDate(daysBack: number): string {
  return new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);
}

// Monday (UTC) of the week containing the given YYYY-MM-DD date.
export function mondayOf(dateIso: string): string {
  const t = Date.parse(`${dateIso}T00:00:00Z`);
  const dow = new Date(t).getUTCDay(); // 0 Sun .. 6 Sat
  return new Date(t - ((dow + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(dateIso: string, n: number): string {
  return new Date(Date.parse(`${dateIso}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Jun 01–07" or "Jun 29 – Jul 05" from two YYYY-MM-DD strings.
export function fmtDateRange(startIso: string, endIso: string): string {
  const [, m1, d1] = startIso.split("-");
  const [, m2, d2] = endIso.split("-");
  const a = `${MONTHS[Number(m1) - 1]} ${d1}`;
  return m1 === m2 ? `${a}–${d2}` : `${a} – ${MONTHS[Number(m2) - 1]} ${d2}`;
}

// Thrown when required env vars are missing; routes map it to { configured: false }.
export class ConfigError extends Error {}

function rcEnv() {
  const apiKey = process.env.REVENUECAT_API_KEY;
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new ConfigError("REVENUECAT_API_KEY / REVENUECAT_PROJECT_ID not set");
  }
  return { apiKey, projectId };
}

export type RcChartDay = { date: string; incomplete: boolean; measures: number[] };

// RC chart responses: .values is {cohort unix-seconds UTC, measure index, value}
// triples at daily resolution. Returns one row per day, sorted ascending, with
// values indexed by measure.
export async function fetchRcChart(name: string, fresh = false): Promise<RcChartDay[]> {
  const { apiKey, projectId } = rcEnv();
  const res = await fetch(`${RC_BASE}/projects/${projectId}/charts/${name}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    ...upstreamCache(fresh, 300),
  });
  if (!res.ok) throw new Error(`RevenueCat charts/${name} failed (${res.status})`);
  const chart = await res.json();
  const byDay = new Map<number, RcChartDay>();
  for (const v of (chart.values ?? []) as { cohort: number; incomplete: boolean; measure: number; value: number }[]) {
    let row = byDay.get(v.cohort);
    if (!row) {
      row = {
        date: new Date(v.cohort * 1000).toISOString().slice(0, 10),
        incomplete: v.incomplete,
        measures: [],
      };
      byDay.set(v.cohort, row);
    }
    row.incomplete = row.incomplete || v.incomplete;
    row.measures[v.measure] = v.value;
  }
  return Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row);
}

export type RcOverviewMetric = { id: string; name: string; value: number; unit: string; description: string };

export async function fetchRcOverview(fresh = false): Promise<RcOverviewMetric[]> {
  const { apiKey, projectId } = rcEnv();
  const res = await fetch(`${RC_BASE}/projects/${projectId}/metrics/overview`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    ...upstreamCache(fresh, 300),
  });
  if (!res.ok) throw new Error(`RevenueCat overview failed (${res.status})`);
  const data = await res.json();
  return data.metrics ?? [];
}

// Run a HogQL query against the PostHog project; returns raw result rows.
export async function posthogQuery(query: string, fresh = false): Promise<unknown[][]> {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || apiKey.startsWith("REPLACE") || !projectId) {
    throw new ConfigError("Set POSTHOG_API_KEY (personal API key with Query Read scope) in .env.local");
  }
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    ...upstreamCache(fresh, 300),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
