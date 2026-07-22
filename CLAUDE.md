# DailyGlow admin — Claude Code scheduled routine

Use the **HTTP API only**. Do not open the dashboard in Chrome. Do not use `localhost`.

## Network allowlist (required)

Remote scheduled routines run in Anthropic's sandbox. Outbound `curl` to the dashboard host returns **HTTP 000** or **403 host_not_allowed** unless the domain is allowlisted.

**Fix in Claude (not Cursor):**

1. Open [claude.ai/code → Scheduled](https://claude.ai/code/scheduled)
2. Edit your routine → **Environment** (e.g. Default cloud env)
3. **Network access** → **Custom**
4. Add to **Allowed domains**:
 - `vercel-test-mu-bay.vercel.app` (dashboard API — **not** dailyglowup.app)
 - `*.vercel.app` (optional wildcard)
 - `api.supermetrics.com` (TikTok ads data)
 - `us.posthog.com`, `api.revenuecat.com` (optional, if not using dashboard APIs)

Also set **environment secrets** on that same routine:

| Variable | Value |
|----------|-------|
| `TODO_API_KEY` | Same as Vercel production |
| `DASHBOARD_URL` | `https://vercel-test-mu-bay.vercel.app` |

Verify at the start of each run:

```bash
curl -sf -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TODO_API_KEY" \
  "$DASHBOARD_URL/api/admin/workspace"
```

- `200` → push will work
- `401` → wrong/missing `TODO_API_KEY` on the routine env
- `000` / `403` → domain still blocked; fix allowlist above

Repo `.claude/settings.json` pre-allows these domains for **local** Claude Code sessions only. **Remote scheduled runs use the routine's cloud environment settings**, not repo files.

## Required env vars

Set on the **scheduled routine's cloud environment** (not just `.env.local`):

| Variable | Example | Purpose |
|----------|---------|---------|
| `TODO_API_KEY` | (same as Vercel `TODO_API_KEY`) | Bearer auth for all admin APIs |
| `DASHBOARD_URL` | `https://vercel-test-mu-bay.vercel.app` | Production base URL |

## 1. Pull TikTok / metrics

All requests use:

```http
Authorization: Bearer $TODO_API_KEY
```

| Data | GET |
|------|-----|
| TikTok overview | `{DASHBOARD_URL}/api/admin/tiktok?days=7` |
| TikTok creatives (main) | `{DASHBOARD_URL}/api/admin/tiktok-creatives?days=7` |
| Economics / spend | `{DASHBOARD_URL}/api/admin/economics?days=7` |
| RevenueCat (all) | `{DASHBOARD_URL}/api/admin/revenuecat?days=7` |
| Daily brief | `{DASHBOARD_URL}/api/admin/brief` |
| Current workspace | `{DASHBOARD_URL}/api/admin/workspace` |

Use `days=1`, `7`, `14`, or `30` as needed.

The RevenueCat pull returns everything we track in one response: overview `metrics` (KPIs), `revenueSeries` + `revenueSummary`, `refunds` (refund rate), and `conversion` (conversion-to-paying). No need to hit `api.revenuecat.com` directly.

## 2. Push todos, actions, formats

**POST** `{DASHBOARD_URL}/api/admin/workspace`

```json
{
  "source": "claude",
  "todos": ["actionable task strings"],
  "actions": [
    {
      "severity": "kill",
      "title": "Short headline",
      "detail": "1-2 sentences with numbers"
    }
  ],
  "formats": ["creative idea to film"]
}
```

- `severity`: `kill` | `scale` | `test` | `info`
- Max 25 items per array; skip duplicate open todos / existing format text
- Must include at least one new item

### Preferred push command (when shell is available)

```bash
node scripts/push-workspace.mjs claude-report/pending-push-$(date +%Y-%m-%d).json
```

Or curl:

```bash
curl -sf -X POST "$DASHBOARD_URL/api/admin/workspace" \
  -H "Authorization: Bearer $TODO_API_KEY" \
  -H "Content-Type: application/json" \
  -d @claude-report/pending-push-YYYY-MM-DD.json
```

**Always use `https://vercel-test-mu-bay.vercel.app`** — not `dailyglowup.app` (that domain is the app landing page; it has no `/api/admin/*` routes).

## 3. Fallback (only if push fails)

Write the payload to `claude-report/pending-push-YYYY-MM-DD.json` and report the failure. Do not treat the file as success.

## Analysis rules (TikTok)

**Attribution context (July 2026):** MMP real-time reporting is live — TikTok now reports *estimated total* conversions, not SKAN's guaranteed ≤20% subset. Reported CPA is therefore ~4-5x lower than the SKAN era and near-accurate. Old SKAN-era benchmarks (winner ~$32 CPA, healthy = sub-$40) are obsolete — never compare against them. Current MMP-era norms: account avg CPA ~$10-11, winner range $7-10, standout &lt;$6. Still crosscheck against PostHog installs (blended CAC) for Spark-ad organic spillover.

- **Kill**: watch time &lt; 2.5s; 0 conversions after ~$15-20 spend (real-time reporting = judge faster, no SKAN delay); CPA &gt; $20 (≈2x account avg) with 3+ conversions; or clearly dead ABO test
- **Scale**: CPA &lt; $7 with 2+ conversions and volume (well below the ~$10-11 account average)
- **Test**: new creative / hook variations when pipeline is empty or winner fatigues
- **Concentration**: flag when one creative takes &gt;70% of daily spend
- **CPA fatigue**: compare 7d CPA vs the ~$10-11 MMP-era norm; flag a creative drifting above $15 or 0-conv days on the main spender
