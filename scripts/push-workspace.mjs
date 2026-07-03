#!/usr/bin/env node
/**
 * Push todos/actions/formats to the admin workspace.
 * Used by scheduled Claude when curl/browser is blocked.
 *
 * Usage:
 *   TODO_API_KEY=... DASHBOARD_URL=https://dailyglowup.app node scripts/push-workspace.mjs claude-report/pending-push-2026-07-03.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/push-workspace.mjs <payload.json>");
  process.exit(1);
}

const apiKey = process.env.TODO_API_KEY?.trim();
if (!apiKey) {
  console.error("Set TODO_API_KEY in the environment.");
  process.exit(1);
}

const base = (process.env.DASHBOARD_URL || "https://dailyglowup.app").replace(/\/$/, "");
const url = `${base}/api/admin/workspace`;

let body;
try {
  body = JSON.parse(readFileSync(resolve(file), "utf8"));
} catch (e) {
  console.error(`Failed to read ${file}:`, e.message);
  process.exit(1);
}

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

if (!res.ok) {
  console.error(`Push failed (${res.status}):`, json);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, appended: json.appended, url }, null, 2));
