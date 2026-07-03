// Workspace store backed by a JSON file committed directly to this repo on
// GitHub (via the Contents API) — no external service, no database. This
// works identically in dev and on serverless hosts (e.g. Vercel) where the
// deployed filesystem is read-only, because writes go to GitHub, not disk.

export type WorkspaceTodo = {
  id: string;
  text: string;
  done: boolean;
  source: "manual" | "claude";
  createdAt: number;
};

export type WorkspaceAction = {
  id: string;
  severity: "kill" | "scale" | "test" | "info";
  title: string;
  detail: string;
  source: "claude";
  createdAt: number;
};

export type WorkspaceFormat = {
  id: string;
  text: string;
  done: boolean;
  source: "manual" | "claude";
  createdAt: number;
};

export type WorkspaceData = {
  todos: WorkspaceTodo[];
  actions: WorkspaceAction[];
  formats: WorkspaceFormat[];
  updatedAt: number;
};

export class WorkspaceStoreError extends Error {
  configured: boolean;
  constructor(message: string, configured = true) {
    super(message);
    this.name = "WorkspaceStoreError";
    this.configured = configured;
  }
}

export const SEED_FORMATS = [
  "Same flow as the top-spend winner, different person's scan. Type “What's my worst feature” — show a scan with one visibly low category score.",
  "Different person's scan. Type “Am I cooked or is there hope” — show overall ~45–50 vs potential 70+, linger on the gap.",
  "Different person's scan. Type “How far am I from my potential” — skip score lingering, go straight to the routine/diet recommendations.",
  "Different person's scan. Type “Rate me honestly” — mid overall score, slow scroll through every category breakdown.",
  "Same scan as the winner. Type “What should I fix first” — reorder to lead with the single lowest category before the full dashboard.",
];

export function newWorkspaceId() {
  return crypto.randomUUID();
}

const REPO = (process.env.WORKSPACE_GITHUB_REPO || "adyaxenie/blog").trim();
const BRANCH = (process.env.WORKSPACE_GITHUB_BRANCH || "main").trim();
const FILE_PATH = (process.env.WORKSPACE_GITHUB_PATH || "data/admin-workspace.json").trim();

function token() {
  return process.env.WORKSPACE_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
}

export function isWorkspaceConfigured() {
  return !!(REPO && token());
}

function contentsUrl() {
  return `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
}

function githubHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function emptyWorkspace(): WorkspaceData {
  return { todos: [], actions: [], formats: [], updatedAt: 0 };
}

function normalize(raw: unknown): WorkspaceData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<WorkspaceData>;
  return {
    todos: Array.isArray(o.todos) ? o.todos : [],
    actions: Array.isArray(o.actions) ? o.actions : [],
    formats: Array.isArray(o.formats) ? o.formats : [],
    updatedAt: Number(o.updatedAt) || 0,
  };
}

function seedFormats(ws: WorkspaceData): WorkspaceData {
  if (ws.formats.length > 0) return ws;
  const now = Date.now();
  return {
    ...ws,
    formats: SEED_FORMATS.map((text, i) => ({
      id: newWorkspaceId(),
      text,
      done: false,
      source: "manual" as const,
      createdAt: now + (SEED_FORMATS.length - i),
    })),
  };
}

async function readFile(): Promise<{ data: WorkspaceData; sha: string | null }> {
  if (!isWorkspaceConfigured()) {
    throw new WorkspaceStoreError(
      "WORKSPACE_GITHUB_TOKEN (or GITHUB_TOKEN) not set — see README for setup",
      false
    );
  }

  const res = await fetch(`${contentsUrl()}?ref=${BRANCH}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });

  if (res.status === 404) {
    return { data: emptyWorkspace(), sha: null };
  }
  if (!res.ok) {
    throw new WorkspaceStoreError(`GitHub read failed (${res.status})`);
  }

  const json = await res.json();
  let parsed: unknown = {};
  try {
    const content = Buffer.from(json.content, "base64").toString("utf-8");
    parsed = JSON.parse(content);
  } catch {
    // corrupt file — start fresh rather than fail hard
  }
  return { data: normalize(parsed), sha: json.sha ?? null };
}

async function writeFile(data: WorkspaceData, sha: string | null): Promise<Response> {
  const body = {
    message: "chore: update admin workspace",
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };
  return fetch(contentsUrl(), {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify(body),
  });
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  const { data, sha } = await readFile();
  const seeded = seedFormats(data);
  if (seeded.formats.length !== data.formats.length) {
    // Persist the seed so it only happens once; best-effort — still return
    // usable data even if the write fails (e.g. transient GitHub API hiccup).
    await writeFile(seeded, sha).catch(() => undefined);
  }
  return seeded;
}

export async function saveWorkspace(ws: WorkspaceData): Promise<WorkspaceData> {
  const payload = { ...ws, updatedAt: Date.now() };
  const { sha } = await readFile();
  let res = await writeFile(payload, sha);

  if (res.status === 409) {
    // Someone else wrote between our read and write — retry once with a fresh sha.
    const { sha: freshSha } = await readFile();
    res = await writeFile(payload, freshSha);
  }

  if (!res.ok) {
    throw new WorkspaceStoreError(`GitHub write failed (${res.status})`);
  }
  return payload;
}
