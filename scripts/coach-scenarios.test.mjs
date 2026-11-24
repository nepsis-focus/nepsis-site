import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import core from "../assets/js/coach-core.js";

const scenarios = [
  ["normal study plan", () => {
    const blocks = core.buildBlocks(40, 25, 5);
    assert.deepEqual(blocks, [{ focusMinutes: 25, breakAfterMinutes: 5 }, { focusMinutes: 15, breakAfterMinutes: 0 }]);
    assert.equal(core.isValidLibraryId("article-7"), true);
  }],
  ["very little time", () => {
    const blocks = core.buildBlocks(8, 25, 5);
    assert.deepEqual(blocks, [{ focusMinutes: 8, breakAfterMinutes: 0 }]);
  }],
  ["exam anxiety", () => {
    assert.equal(core.detectCrisis("I feel anxious about tomorrow's exam"), false);
    assert.equal(core.buildBlocks(40, 25, 5).length, 2);
  }],
  ["request to skip breaks", () => {
    const blocks = core.buildBlocks(100, 50, 10);
    assert.deepEqual(blocks, [{ focusMinutes: 50, breakAfterMinutes: 10 }, { focusMinutes: 50, breakAfterMinutes: 0 }]);
  }],
  ["crisis message", () => {
    assert.equal(core.detectCrisis("I want to kill myself"), true);
    assert.equal(core.detectCrisis("Δεν θέλω να ζω"), true);
  }],
  ["off-topic request", () => {
    assert.equal(core.isClearlyOffTopic("Tell me a joke"), true);
    assert.equal(core.isClearlyOffTopic("Review biology chapter four"), false);
  }],
  ["input length and library ID guard", async () => {
    const fn = await readFile(new URL("../supabase/functions/ai-study-coach/index.ts", import.meta.url), "utf8");
    const client = await readFile(new URL("../assets/js/pages/coach.js", import.meta.url), "utf8");
    assert.match(fn, /MAX_DOC = 1000/);
    assert.match(fn, /consume_ai_coach_ip_limit/);
    assert.match(fn, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
    assert.doesNotMatch(client, /GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/);
    assert.equal(core.isValidLibraryId("article-999"), false);
  }]
];

for (const [name, run] of scenarios) {
  await run();
  process.stdout.write("PASS " + name + "\n");
}
process.stdout.write("All " + scenarios.length + " scenario groups passed.\n");
