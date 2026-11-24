import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../assets/js/coach-core.js");
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [coach, html, edge, custom, practice, library, reset, migration, libraryJs] = await Promise.all([
  read("assets/js/pages/coach.js"), read("coach.html"), read("supabase/functions/ai-study-coach/index.ts"),
  read("assets/js/pages/custom-stage.js"), read("assets/js/pages/practice-1.js"),
  read("library.html"), read("reset.html"),
  read("supabase/migrations/20261124130000_coach_ip_rate_limit_and_custom_stage.sql"),
  read("assets/js/pages/library-1.js")
]);
test("1. normal study plan uses 25/5 blocks and a real Library ID", () => {
  assert.deepEqual(core.buildBlocks(40, 25, 5), [{focusMinutes:25,breakAfterMinutes:5},{focusMinutes:15,breakAfterMinutes:0}]);
  assert.match(edge, /researchReason/); assert.match(edge, /10\.3389\/fpsyg\.2025\.1589411/);
  assert.equal(core.isValidLibraryId("article-7"), true);
});
test("2. very little time never exceeds the available eight minutes", () => {
  assert.deepEqual(core.buildBlocks(8, 25, 5), [{focusMinutes:8,breakAfterMinutes:0}]);
  assert.match(edge, /focusRaw <= available/);
});
test("3. exam anxiety is not misclassified as a crisis and gets a gentle plan", () => {
  assert.equal(core.detectCrisis("I feel anxious about tomorrow's exam"), false);
  assert.match(coach, /exam_anxiety/); assert.match(edge, /Prefer a manageable plan for exam anxiety/);
  assert.match(edge, /Never give medical advice or diagnose/);
});
test("4. requests to skip breaks still retain the selected break protocol", () => {
  assert.deepEqual(core.buildBlocks(100, 50, 10), [{focusMinutes:50,breakAfterMinutes:10},{focusMinutes:50,breakAfterMinutes:0}]);
  assert.match(edge, /Never suggest skipping breaks, removing breaks, or reducing sleep/);
});
test("5. crisis messages stop locally and server-side before Gemini is called", () => {
  assert.equal(core.detectCrisis("I want to kill myself"), true); assert.equal(core.detectCrisis("Δεν θέλω να ζω"), true);
  assert.match(coach, /function stopForCrisis\(\)/); assert.match(coach, /coachCrisis\)\.hidden=false/);
  assert.match(edge, /CRISIS_PATTERN\.test\(combinedInput\)/);
  assert.ok(edge.indexOf("CRISIS_PATTERN.test(combinedInput)") < edge.indexOf("await adapter(prompt)"));
  assert.match(html, /tel:1018/); assert.match(html, /tel:10306/); assert.match(html, /tel:112/);
});
test("6. off-topic requests are redirected without answering the unrelated request", () => {
  assert.equal(core.isClearlyOffTopic("Tell me a joke"), true); assert.equal(core.isClearlyOffTopic("Review biology chapter four"), false);
  assert.match(coach, /function stopOffTopic\(\)/); assert.match(edge, /return kind=off_topic/);
});
test("7. input length, server-only Gemini secret and per-IP limits are enforced", () => {
  assert.equal(core.isWithinInputLimit("a".repeat(1000)), true); assert.equal(core.isWithinInputLimit("a".repeat(1001)), false);
  assert.match(coach, /maxlength/); assert.match(edge, /MAX_INPUT_CHARS = 1000/);
  assert.match(edge, /Deno\.env\.get\("GEMINI_API_KEY"\)/); assert.match(edge, /consume_ai_coach_ip_limit/);
  assert.match(edge, /p_request_limit: 8/); assert.match(edge, /windowMs = 10 \* 60 \* 1000/);
});
test("conversation order, bilingual prompts and reflection are present", () => {
  const q1=coach.indexOf("What are you working on today?"), q2=coach.indexOf("How much time do you have?"), q3=coach.indexOf("What is getting in the way?");
  assert.ok(q1>=0 && q2>q1 && q3>q2); assert.match(coach,/Πόσο χρόνο έχεις διαθέσιμο/);
  assert.match(coach,/initReflection/); assert.match(html,/data-set-lang/);
});
test("custom stage, break reset hook and exact Library IDs are wired", () => {
  assert.match(practice,/stage_type: state\.customSession \? "custom" : "standard"/);
  assert.match(custom,/customTotal/); assert.match(custom,/reset\.searchParams\.set\("customNext"/);
  assert.match(reset,/custom-reset\.js/); assert.match(migration,/case when new\.is_custom then 'custom'/);
  const actualIds=[...library.matchAll(/data-save-id=["']([^"']+)["']/g)].map(m=>m[1]).sort();
  assert.deepEqual(actualIds,[...core.LIBRARY_IDS].sort()); assert.match(libraryJs,/coach-library-highlight/);
});
