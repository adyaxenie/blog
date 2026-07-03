# Data Directory

Static data files for the blog and admin dashboard.

## Files

- `projects.js` / `homepage-projects.ts` — project listings for the portfolio
- `admin-workspace.json` — admin dashboard workspace (todos, action queue, format ideas)

## Admin Workspace (`admin-workspace.json`)

This file stores the admin dashboard's workspace: tasks, Claude-pushed actions, and creative format ideas. It's read/written by `/api/admin/workspace` via the GitHub Contents API, so every change creates a commit to `main`.

**Structure:**

```json
{
  "todos": [
    { "id": "...", "text": "...", "done": false, "source": "manual" | "claude", "createdAt": 0 }
  ],
  "actions": [
    { "id": "...", "severity": "kill" | "scale" | "test" | "info", "title": "...", "detail": "...", "source": "claude", "createdAt": 0 }
  ],
  "formats": [
    { "id": "...", "text": "...", "done": false, "source": "manual" | "claude", "createdAt": 0 }
  ],
  "updatedAt": 0
}
```

**Required env var:** `WORKSPACE_GITHUB_TOKEN` — a fine-grained GitHub PAT with **Contents: Read and write** scoped to this repo only. Create one at https://github.com/settings/personal-access-tokens/new

**Optional env vars (defaults shown):**
- `WORKSPACE_GITHUB_REPO=adyaxenie/blog`
- `WORKSPACE_GITHUB_BRANCH=main`
- `WORKSPACE_GITHUB_PATH=data/admin-workspace.json`

**Why GitHub API instead of a local file?** This dashboard runs as serverless functions (likely on Vercel based on `@vercel/analytics`), where the deployed filesystem is read-only except `/tmp`. Writing to a repo-local file would work in `npm run dev` but silently fail to persist in production. The GitHub Contents API sidesteps that — it works identically everywhere and needs no external database.

**Commit noise:** Every workspace save creates a commit (`chore: update admin workspace`) to the configured branch. To avoid polluting `main`, you can set `WORKSPACE_GITHUB_BRANCH=data` and GitHub Actions will still be able to read from that branch if needed.
