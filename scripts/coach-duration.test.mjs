import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [coachSource, configSource, html, timerBridge, coachCss, coachNav] = await Promise.all([
  readFile(new URL("../assets/js/pages/coach.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/coach-config.js", import.meta.url), "utf8"),
  readFile(new URL("../coach.html", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/coach-timer-bridge.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/css/pages/coach.css", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/coach-nav.js", import.meta.url), "utf8")
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

test("a visitor can choose arbitrary whole focus minutes and sees the break separately", () => {
  const api = loadCoach();
  const plan = api.createPlan({ type: "study", topic: "Biology", energy: 3, available: 35, focusMinutes: 12 }, "en");
  assert.equal(plan.timer.focus, 12);
  assert.equal(plan.timer.rest, 5);
  assert.equal(plan.timer.style, "manual");
  assert.equal(plan.pattern, "12 min focus · then 5 min break");
  assert.match(plan.reason, /You chose 12 minutes/);
  assert.equal(api.createPlan({ type: "task", topic: "Essay", energy: 4, available: 40, focusMinutes: 37 }, "en").timer.focus, 37);
  assert.equal(api.createPlan({ type: "task", topic: "Essay", energy: 4, available: 180, focusMinutes: 180 }, "en").timer.focus, 180);
});

test("manual durations cannot exceed available time or bypass existing stages", () => {
  const api = loadCoach();
  const tooLong = api.createPlan({ type: "task", topic: "Essay", energy: 3, available: 20, focusMinutes: 25 }, "en");
  assert.equal(tooLong.timer.focus, 10);
  assert.equal(tooLong.timer.style, "warmup");
  assert.ok(tooLong.timer.focus + tooLong.timer.rest <= 20);
  assert.equal(api.normalize({ available: 45, focusMinutes: 12 }).focusMinutes, 12);
  assert.equal(api.normalize({ available: 45, focusMinutes: 12.5 }).focusMinutes, 0);
  assert.equal(api.normalize({ available: 45, focusMinutes: 181 }).focusMinutes, 0);
  const customTimer = api.applyFocusChoice({ focus: 25, rest: 5, style: "ai" }, 12, 20, 3);
  assert.equal(customTimer.focus, 12);
  assert.equal(customTimer.style, "manual");
  const safeAiTimer = api.applyFocusChoice({ focus: 25, rest: 5, style: "ai" }, 25, 20, 3);
  assert.equal(safeAiTimer.focus, 10);
  assert.equal(safeAiTimer.style, "warmup");
});

test("duration field accepts a user-entered integer and handoff validates its range", () => {
  assert.match(html, /<label for="coachFocusMinutes"/);
  assert.match(html, /id="coachFocusMinutes"[^>]*type="number"/);
  assert.match(html, /id="coachFocusMinutes"[^>]*min="5"[^>]*max="180"[^>]*step="1"/);
  assert.match(html, /id="coachFocusMinutes"[^>]*aria-describedby="coachFocusHelp"/);
  assert.match(timerBridge, /minutes < 5 \|\| minutes > 180/);
  assert.match(timerBridge, /start\.click\(\)/);
});

test("Coach keeps one accessible input per choice, without injected duplicates", () => {
  assert.match(html, /type="radio" name="coachEnergyChoice"/);
  assert.match(html, /id="coachMinutes"[^>]*type="number"/);
  assert.doesNotMatch(coachNav, /choiceGroup|coach-choices-(type|energy|minutes)/);
});

test("Coach styling has a distinct hierarchy, responsive columns and focus states", () => {
  assert.match(coachCss, /--coach-canvas: var\(--np-canvas/);
  assert.match(coachCss, /grid-template-columns: minmax\(0, 1\.42fr\)/);
  assert.match(coachCss, /max-width: 760px/);
  assert.match(coachCss, /:focus-visible/);
  assert.match(coachCss, /prefers-reduced-motion: reduce/);
});
