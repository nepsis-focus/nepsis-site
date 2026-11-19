import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [coachSource, configSource, html, timerBridge, coachCss] = await Promise.all([
  readFile(new URL("../assets/js/pages/coach.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/coach-config.js", import.meta.url), "utf8"),
  readFile(new URL("../coach.html", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/coach-timer-bridge.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/css/pages/coach.css", import.meta.url), "utf8")
]);

function loadCoach() {
  const values = new Map();
  const window = { localStorage: {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  } };
  const context = { window, document: null };
  vm.runInNewContext(configSource, context);
  vm.runInNewContext(coachSource, context);
  return window.NepsisCoach;
}

test("a visitor can choose a supported focus duration and sees the break separately", () => {
  const api = loadCoach();
  const plan = api.createPlan({ type: "study", topic: "Biology", energy: 3, available: 35, focusMinutes: 10 }, "en");
  assert.equal(plan.timer.focus, 10);
  assert.equal(plan.timer.rest, 5);
  assert.equal(plan.timer.style, "manual");
  assert.equal(plan.pattern, "10 min focus · then 5 min break");
  assert.match(plan.reason, /You chose 10 minutes/);
});

test("manual durations cannot exceed available time or bypass existing stages", () => {
  const api = loadCoach();
  const tooLong = api.createPlan({ type: "task", topic: "Essay", energy: 3, available: 20, focusMinutes: 25 }, "en");
  assert.equal(tooLong.timer.focus, 10);
  assert.equal(tooLong.timer.style, "warmup");
  assert.ok(tooLong.timer.focus + tooLong.timer.rest <= 20);
  assert.equal(api.normalize({ available: 45, focusMinutes: 12 }).focusMinutes, 0);
  const safeAiTimer = api.applyFocusChoice({ focus: 25, rest: 5, style: "ai" }, 25, 20, 3);
  assert.equal(safeAiTimer.focus, 10);
  assert.equal(safeAiTimer.style, "warmup");
});

test("duration selector exposes only supported Nepsis timer stages", () => {
  assert.match(html, /<label for="coachFocusMinutes"/);
  assert.match(html, /id="coachFocusMinutes" aria-describedby="coachFocusHelp"/);
  const select = html.match(/<select id="coachFocusMinutes"[\s\S]*?<\/select>/)?.[0] || "";
  assert.deepEqual([...select.matchAll(/<option value="(\d+)"/g)].map(match => match[1]), ["0", "5", "10", "25", "45", "60"]);
  assert.match(timerBridge, /\[5, 10, 25, 45, 60\]/);
  assert.match(timerBridge, /start\.click\(\)/);
});

test("Coach styling uses shared theme tokens and stacks for narrow screens", () => {
  assert.match(coachCss, /--coach-canvas: var\(--np-canvas/);
  assert.match(coachCss, /background-image: none/);
  assert.match(coachCss, /max-width: 680px/);
  assert.match(coachCss, /prefers-reduced-motion: reduce/);
});
