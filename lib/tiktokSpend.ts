// TikTok Ads fetch layer via Supermetrics.
//
// Field notes:
//   - Supermetrics TikTok (`ds_id: TIK`) spend field is `cost`; other fields
//     use the connector ids below (campaign_name, ad_id, ad_name, etc.).
//   - Supermetrics does NOT expose average watch time, so downstream
//     `avgWatch` stays null (hook/hold rates still come through).

import { ConfigError, upstreamCache } from "./adminSources";

export type TikTokSource = "supermetrics";

export type TikTokRow = {
  date?: string;
  campaign_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  video_play_actions?: number;
  video_watched_2s?: number;
  video_watched_6s?: number;
};

export type TikTokField = keyof TikTokRow;

export type TikTokFetch = { source: TikTokSource; rows: TikTokRow[] };

const NUMERIC_FIELDS: ReadonlySet<TikTokField> = new Set<TikTokField>([
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "video_play_actions",
  "video_watched_2s",
  "video_watched_6s",
]);

// Field sets per consumer.
export const OVERVIEW_FIELDS: TikTokField[] = [
  "date",
  "campaign_name",
  "spend",
  "impressions",
  "clicks",
  "conversions",
];
export const CREATIVE_FIELDS: TikTokField[] = [
  "date",
  "campaign_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "video_play_actions",
  "video_watched_2s",
  "video_watched_6s",
];
const SPEND_FIELDS: TikTokField[] = ["date", "spend"];

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const isConfigured = (key: string | undefined): key is string =>
  !!key && !key.startsWith("REPLACE");

const SM_ENDPOINT = "https://api.supermetrics.com/v2/query/data/json";
const SM_DS_ID = "TIK";

// Our logical field -> Supermetrics TikTok field id. Fields absent from this
// map are unsupported by the connector and dropped from the request.
const SM_FIELD_ID: Partial<Record<TikTokField, string>> = {
  date: "date",
  campaign_name: "campaign_name",
  ad_id: "ad_id",
  ad_name: "ad_name",
  spend: "cost",
  impressions: "impressions",
  clicks: "clicks",
  conversions: "conversions",
  video_play_actions: "video_play_actions",
  video_watched_2s: "video_watched_2s",
  video_watched_6s: "video_watched_6s",
};

async function fetchSupermetrics(
  fields: TikTokField[],
  dateFrom: string,
  dateTo: string,
  fresh: boolean
): Promise<TikTokRow[]> {
  const apiKey = process.env.SUPERMETRICS_API_KEY;
  if (!isConfigured(apiKey)) {
    throw new ConfigError("Set SUPERMETRICS_API_KEY (from the Supermetrics Hub) in .env.local");
  }

  // Keep only supported fields; order is preserved for positional row mapping.
  const supported = fields.filter((f) => SM_FIELD_ID[f]);
  const smFields = supported.map((f) => SM_FIELD_ID[f] as string).join(",");
  const dsAccounts = process.env.SUPERMETRICS_TIKTOK_ACCOUNT?.trim() || "list.all_accounts";

  const res = await fetch(SM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ds_id: SM_DS_ID,
      ds_accounts: dsAccounts,
      start_date: dateFrom,
      end_date: dateTo,
      fields: smFields,
      max_rows: 100000,
      // Rows come back as positional arrays matching `fields` (no header row).
      settings: { no_headers: true },
    }),
    ...upstreamCache(fresh, 600),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supermetrics request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = await res.json();
  if (payload?.error) {
    const code = payload.error.code ?? "UNKNOWN";
    throw new Error(`Supermetrics error ${code}: ${payload.error.message ?? "unknown"}`);
  }
  const data = payload?.data;
  if (!Array.isArray(data)) throw new Error("Supermetrics returned no data array");

  return data.map((cells: unknown[]) => {
    const row: Record<string, unknown> = {};
    supported.forEach((f, i) => {
      const raw = Array.isArray(cells) ? cells[i] : undefined;
      row[f] = NUMERIC_FIELDS.has(f) ? toNum(raw) : raw == null ? undefined : String(raw);
    });
    return row as TikTokRow;
  });
}

async function fetchTikTok(
  fields: TikTokField[],
  dateFrom: string,
  dateTo: string,
  fresh: boolean
): Promise<TikTokFetch> {
  const rows = await fetchSupermetrics(fields, dateFrom, dateTo, fresh);
  return { source: "supermetrics", rows };
}

// Raw creative-level rows (ad_id + ad_name granularity) for /tiktok-creatives.
export function fetchTikTokCreativeRows(
  dateFrom: string,
  dateTo: string,
  fresh = false
): Promise<TikTokFetch> {
  return fetchTikTok(CREATIVE_FIELDS, dateFrom, dateTo, fresh);
}

// Account overview rows (campaign-level daily metrics) for /tiktok.
export function fetchTikTokOverviewRows(
  dateFrom: string,
  dateTo: string,
  fresh = false
): Promise<TikTokFetch> {
  return fetchTikTok(OVERVIEW_FIELDS, dateFrom, dateTo, fresh);
}

// Daily spend map (YYYY-MM-DD -> spend) for the economics/brief/weekly/projections routes.
export async function fetchTikTokSpend(
  dateFrom: string,
  dateTo: string,
  fresh = false
): Promise<Map<string, number>> {
  const { rows } = await fetchTikTok(SPEND_FIELDS, dateFrom, dateTo, fresh);
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const day = String(r.date ?? "").slice(0, 10);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + toNum(r.spend));
  }
  return byDay;
}
