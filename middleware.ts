import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "./lib/adminAuth";

const PUBLIC_PATHS = new Set(["/admin/login", "/api/admin/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const secret = process.env.DASHBOARD_PASSWORD;
  if (!secret) {
    return new NextResponse("DASHBOARD_PASSWORD is not configured", { status: 500 });
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (await verifySessionToken(token, secret)) return NextResponse.next();

  // Programmatic access (e.g. Claude pushing daily action items) via bearer key.
  if (pathname === "/api/admin/todos" || pathname === "/api/admin/workspace") {
    const apiKey = process.env.TODO_API_KEY;
    const auth = req.headers.get("authorization") ?? "";
    if (apiKey && auth === `Bearer ${apiKey}`) return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
