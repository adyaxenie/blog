# DailyGlow admin — scheduled Claude instructions

Use the **HTTP API only**. Do not open the dashboard in Chrome. Do not use `localhost`.

## Required env vars

Set these in the automation environment (Cursor Cloud / scheduled agent secrets):

| Variable | Example | Purpose |
|----------|---------|---------|
| `TODO_API_KEY` | (same as Vercel `TODO_API_KEY`) | Bearer auth for all admin APIs |
| `DASHBOARD_URL` | `https://dailyglowup.app` | Production base URL |

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
| Daily brief | `{DASHBOARD_URL}/api/admin/brief` |
| Current workspace | `{DASHBOARD_URL}/api/admin/workspace` |

Use `days=1`, `7`, `14`, or `30` as needed.

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

**Always use `https://dailyglowup.app`** — never `localhost:3000`.

## 3. Fallback (only if push fails)

Write the payload to `claude-report/pending-push-YYYY-MM-DD.json` and report the failure. Do not treat the file as success.

## Analysis rules (TikTok)

- **Kill**: watch time &lt; 2.5s, 0 conversions after meaningful spend, or clearly dead ABO test
- **Scale**: paid CAC well below account average with volume
- **Test**: new creative / hook variations when pipeline is empty or winner fatigues
- **Concentration**: flag when one creative takes &gt;70% of daily spend
- **CPA fatigue**: compare 7d CPA vs historical norm; flag 0-conv days on main spender
