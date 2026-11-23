// Static guard: PostHog is the only website analytics platform.
// Fails if Umami or the custom Supabase telemetry sender comes back, or if production
// PostHog is switched on without the approval step recorded in ANALYTICS-STAGING.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function sourceFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sourceFiles(full)));
    else if (/\.(js|mjs|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("no Umami script or reference remains in site code", async () => {
  const hits = [];
  for (const file of await sourceFiles(repoRoot)) {
    if (/\.test\.mjs$/.test(file)) continue;
    const text = await readFile(file, "utf8");
    if (/umami/i.test(text)) hits.push(relative(repoRoot, file));
  }
  assert.deepEqual(hits, [], "Umami must not be referenced in site code");
});

test("the custom Supabase telemetry sender is not used by the browser", async () => {
  const text = await readFile(join(repoRoot, "assets/js/analytics.js"), "utf8");
  assert.doesNotMatch(text, /site_telemetry/);
  assert.doesNotMatch(text, /\/rest\/v1\//);
  assert.doesNotMatch(text, /sendTelemetry/);
});

test("production PostHog stays off until separately approved", async () => {
  const text = await readFile(join(repoRoot, "assets/js/analytics.js"), "utf8");
  assert.match(text, /const POSTHOG_PRODUCTION_ENABLED = false;/);
});

test("PostHog session recording and autocapture stay disabled", async () => {
  const text = await readFile(join(repoRoot, "assets/js/analytics.js"), "utf8");
  assert.match(text, /autocapture:false/);
  assert.match(text, /disable_session_recording:true/);
  assert.match(text, /capture_pageview:false/);
});
