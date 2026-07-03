import { NextRequest } from "next/server";

/** Paths that never accept TODO_API_KEY bearer auth. */
const BEARER_EXCLUDED = new Set(["/api/admin/login", "/api/admin/logout"]);

export function isBearerAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.TODO_API_KEY;
  if (!apiKey) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${apiKey}`;
}

export function allowsBearerAuth(pathname: string): boolean {
  return pathname.startsWith("/api/admin/") && !BEARER_EXCLUDED.has(pathname);
}
