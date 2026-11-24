import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, customMigration, edge, practice, bridge] = await Promise.all([
  readFile(new URL("../supabase/migrations/20261119195000_support_custom_focus_timer_durations.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261124130000_coach_ip_rate_limit_and_custom_stage.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/focus-timer/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/practice-1.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/coach-timer-bridge.js", import.meta.url), "utf8")
]);

test("database accepts only bounded custom whole-minute sessions", () => {
  assert.match(migration, /stage_minutes BETWEEN 5 AND 180/);
  assert.match(migration, /duration_minutes BETWEEN 5 AND 180/);
  assert.match(migration, /stage = 'custom' AND duration_minutes NOT IN \(5, 10, 25, 45, 60\)/);
  assert.match(migration, /WHEN 60 THEN 'flow'\s+ELSE 'custom'/);
});

test("server RPC keeps token-bound idempotent sessions and age checks", () => {
  assert.match(migration, /p_token_hash IS NULL OR p_token_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /WHERE id = p_session_id AND token_hash = p_token_hash/);
  assert.match(migration, /created_at < pg_catalog\.clock_timestamp\(\) - INTERVAL '14 days'/);
  assert.match(migration, /completed_at IS NOT NULL/);
});

test("custom-stage marker preserves custom labels for standard and nonstandard durations", () => {
  assert.match(customMigration, /is_custom boolean/);
  assert.match(customMigration, /nepsis_timer_mark_custom/);
  assert.match(customMigration, /stage = 'custom' AND duration_minutes BETWEEN 5 AND 180/);
});

test("Edge Function accepts integers in range and still verifies on the server", () => {
  assert.match(edge, /Number\.isInteger\(stage\) \|\| stage < 5 \|\| stage > 180/);
  assert.match(edge, /admin\.rpc\(rpcName, rpcArgs\)/);
  assert.match(edge, /nepsis_timer_mark_custom/);
  assert.match(edge, /hashToken\(token\)/);
  assert.match(edge, /invalid_session_token/);
});

test("practice adds only bounded custom stages and reuses verified timer actions", () => {
  assert.match(practice, /function isValidFocusMinutes\(value\) \{ return Number\.isInteger\(value\) && value >= 5 && value <= 180; \}/);
  assert.match(practice, /nepsis-timer-session-\(\[0-9\]\+\)/);
  assert.match(practice, /stage_minutes: state\.min/);
  assert.match(bridge, /minutes < 5 \|\| minutes > 180/);
  assert.match(bridge, /start\.click\(\)/);
});
