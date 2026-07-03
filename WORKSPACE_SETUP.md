# Admin Workspace Setup

The admin dashboard now stores todos, actions, and format ideas in a JSON file (`data/admin-workspace.json`) committed directly to this repo via the GitHub Contents API.

## ✅ Setup Checklist

### 1. Create a GitHub Personal Access Token

1. Go to https://github.com/settings/personal-access-tokens/new
2. **Token name:** `blog-admin-workspace`
3. **Expiration:** 90 days (or custom — you'll get renewal reminders)
4. **Repository access:** Select "Only select repositories" → `adyaxenie/blog`
5. **Repository permissions:**
   - **Contents:** Read and write access ✓
6. Click "Generate token"
7. **Copy the token immediately** (you won't see it again)

### 2. Add the Token to Environment Variables

**Local development** (`.env.local`):
```bash
WORKSPACE_GITHUB_TOKEN=github_pat_11A...
```

**Production** (Vercel/your hosting platform):
- Add `WORKSPACE_GITHUB_TOKEN` to your environment variables in the deployment settings
- **Important:** Use the same token in both dev and production, or create separate tokens

### 3. Optional Configuration

If you want to avoid polluting `main` with workspace commits, create a dedicated branch:

```bash
git checkout -b data
git push -u origin data
```

Then set in `.env.local` and production:
```bash
WORKSPACE_GITHUB_BRANCH=data
```

Every workspace save will commit to the `data` branch instead of `main`.

### 4. Verify It Works

1. Restart your dev server: `npm run dev`
2. Visit http://localhost:3000/admin
3. Log in with `DASHBOARD_PASSWORD`
4. The right sidebar should load without 503 errors
5. Add a task → check it off → verify a commit appears in GitHub

## How It Works

- **Storage:** `data/admin-workspace.json` in this repo
- **Read/Write:** GitHub Contents API (`PUT /repos/adyaxenie/blog/contents/data/admin-workspace.json`)
- **Auth:** Fine-grained PAT with Contents: Read+write
- **Concurrency:** Optimistic locking via file SHA (retries once on 409 conflict)
- **Commits:** Every save creates a commit: `chore: update admin workspace`

## Claude Integration

Claude (or any automation) can push todos/actions/formats via the API:

```bash
curl -X POST https://your-domain.com/api/admin/workspace \
  -H "Authorization: Bearer $TODO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "claude",
    "todos": ["Review CAC spike", "Check funnel drop-off"],
    "actions": [
      { "severity": "kill", "title": "Pause creative X", "detail": "0.8s watch" }
    ],
    "formats": ["Same flow — type \"What should I fix first\""]
  }'
```

The `TODO_API_KEY` is already set in your environment (separate from the GitHub token).

## Troubleshooting

### 503 errors on `/api/admin/workspace`
- Token not set or invalid
- Check `.env.local` and restart `npm run dev`

### 403 Forbidden from GitHub
- Token expired (renew at https://github.com/settings/tokens)
- Token doesn't have Contents write permission
- Repo name mismatch (check `WORKSPACE_GITHUB_REPO`)

### Commits not appearing
- Wrong branch (check `WORKSPACE_GITHUB_BRANCH`)
- Token has read-only access
- Network/API error (check dev server logs)

### Sidebar shows "Set WORKSPACE_GITHUB_TOKEN to enable sync"
- Token not set in environment variables
- Restart dev server after adding token
