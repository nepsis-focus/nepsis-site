import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [coach, html, core, edge, legacyEdge, timer, migration, library, reset, sw, home, scenarios, practice, customStage, customReset, practiceJs, libraryJs, googleOauth] = await Promise.all([
  read("assets/js/pages/coach.js"), read("coach.html"), read("assets/js/coach-core.js"),
  read("supabase/functions/ai-study-coach-v2/index.ts"), read("supabase/functions/ai-study-coach/index.ts"), read("supabase/functions/focus-timer/index.ts"),
  read("supabase/migrations/20261124130000_coach_ip_rate_limit_and_custom_stage.sql"),
  read("library.html"), read("reset.html"), read("sw.js"), read("index.html"), read("tests/coach-scenarios.md"),
  read("practice.html"), read("assets/js/pages/custom-stage.js"), read("assets/js/pages/custom-reset.js"),
  read("assets/js/pages/practice-1.js"), read("assets/js/pages/library-1.js"), read("assets/js/google-oauth.js")
]);

test("Coach is enabled and reachable from the existing Nepsis navigation", () => {
  assert.ok(html.includes("assets/js/coach-config.js"));
  assert.ok(html.includes("assets/js/pages/coach.js"));
  assert.ok(home.includes('href="coach.html" data-coach-nav'));
});

test("the AI Coach asks the three required questions in order, one at a time", () => {
  const task = coach.indexOf("What are you working on today?");
  const time = coach.indexOf("How much time do you have?");
  const obstacle = coach.indexOf("What is getting in the way?");
  assert.ok(task >= 0 && task < time && time < obstacle);
  assert.ok(html.includes('id="coachChoices"'));
  assert.ok(html.includes('id="coachInput"'));
  assert.ok(!coach.includes('$("coachInput").type='));
  assert.ok(libraryJs.includes("article.card[data-save-id]"));
});

test("the page identifies AI and requires consent before sending answers", () => {
  assert.ok(html.includes("artificial intelligence (AI)"));
  assert.ok(html.includes('id="coachConsent"'));
  assert.ok(coach.includes('coachConsent").checked'));
  assert.ok(edge.includes("body.consent !== true"));
});

test("client code contains no Gemini provider key or endpoint", () => {
  const clientFiles = [coach, html, core, library, reset, practice, customStage, customReset, practiceJs, libraryJs, googleOauth, sw];
  for (const source of clientFiles) {
    assert.ok(!source.includes("GEMINI_API_KEY"));
    assert.ok(!source.includes("AIza"));
    assert.ok(!source.includes("x-goog-api-key"));
    assert.ok(!source.includes("generativelanguage.googleapis.com"));
  }
  assert.ok(edge.includes('Deno.env.get("GEMINI_API_KEY")'));
  assert.ok(edge.includes("const PROVIDERS"));
  assert.ok(edge.includes('Deno.env.get("AI_PROVIDER") || "gemini"'));
  assert.ok(!edge.toLowerCase().includes("grok"));
});

test("the server enforces 1000 characters and per-IP rate limiting", () => {
  assert.ok(edge.includes("MAX_INPUT_CHARS = 1000"));
  assert.ok(edge.includes("consume_ai_coach_ip_limit"));
  assert.ok(edge.includes("p_request_limit: 8"));
  assert.ok(legacyEdge.includes("MAX_DOC = 1000"));
  assert.ok(legacyEdge.includes("consume_ai_coach_ip_limit"));
  assert.ok(edge.includes('const requestIp = (req.headers.get("cf-connecting-ip") || "").trim() || "unknown"'));
  assert.ok(!edge.includes("x-forwarded-for"));
  assert.ok(legacyEdge.includes("MAX_DOC = 1000"));
  assert.ok(legacyEdge.includes("consume_ai_coach_ip_limit"));
  assert.ok(legacyEdge.includes('const requestIp = (req.headers.get("cf-connecting-ip") || "").trim() || "unknown"'));
  assert.ok(!legacyEdge.includes("x-forwarded-for"));
  assert.ok(migration.includes("ai_coach_ip_limits"));
  assert.ok(migration.toLowerCase().includes("enable row level security"));
  assert.ok(migration.includes("grant execute on function public.consume_ai_coach_ip_limit"));
});

test("crisis detection stops the study flow and presents Greece support contacts", () => {
  assert.ok(core.includes("CRISIS"));
  assert.ok(edge.includes("CRISIS_PATTERN"));
  assert.ok(html.includes("tel:1018"));
  assert.ok(html.includes("tel:10306"));
  assert.ok(html.includes("tel:112"));
  assert.ok(html.includes("someone you trust"));
});

test("Coach safety rules cover breaks, sleep, medical advice and off-topic requests", () => {
  assert.ok(edge.includes("Never suggest skipping breaks"));
  assert.ok(edge.includes("Never give medical advice"));
  assert.ok(edge.includes("reducing sleep"));
  assert.ok(edge.includes("kind=off_topic"));
  assert.ok(core.includes("isClearlyOffTopic"));
});

test("the plan includes a research reason and a source link", () => {
  assert.ok(edge.includes("researchReason"));
  assert.ok(edge.includes("10.3389/fpsyg.2025.1589411"));
  assert.ok(coach.includes("researchSource"));
  assert.ok(coach.includes("adjustOffer"));
});

test("Library suggestions are restricted to existing article IDs", () => {
  assert.ok(core.includes("article-13"));
  assert.ok(edge.includes("LIBRARY_IDS.includes"));
  assert.ok(coach.includes("isValidLibraryId"));
  assert.ok(library.includes("coach.html"));
  assert.ok(libraryJs.includes("coach-library-highlight"));
});

test("Google account sessions and Premium usage remain supported", () => {
  assert.ok(html.includes("assets/js/google-oauth.js"));
  assert.ok(coach.includes("authClient.auth.getSession"));
  assert.ok(edge.includes("PREMIUM_MONTHLY_LIMIT = 50"));
  assert.ok(edge.includes("WHOP_API_KEY"));
});

test("custom timer sessions are recorded as stage=custom with real block minutes", () => {
  assert.ok(timer.includes("nepsis_timer_mark_custom"));
  assert.ok(migration.includes("is_custom boolean"));
  assert.ok(migration.includes("stage = 'custom' AND duration_minutes BETWEEN 5 AND 180"));
  assert.ok(migration.includes("private.sync_completed_focus_timer"));
});

test("reset return flow waits for the planned break and offline assets are refreshed", () => {
  assert.ok(reset.includes("custom-reset.js"));
  assert.ok(customReset.includes("customBreakUntil"));
  assert.ok(customReset.includes("Continue the custom session"));
  assert.ok(sw.includes("nepsis-v28"));
  assert.ok(sw.includes("assets/js/coach-core.js"));
  assert.ok(sw.includes("assets/js/pages/custom-stage.js"));
  assert.ok(sw.includes("assets/js/pages/custom-reset.js"));
});

test("scenario documentation contains all required cases", () => {
  for (const name of ["Normal study plan","Very little time","Exam anxiety","Request to skip breaks","Crisis message","Off-topic request"]) assert.ok(scenarios.toLowerCase().includes(name.toLowerCase()));
});
