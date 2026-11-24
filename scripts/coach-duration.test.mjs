import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../assets/js/coach-core.js");

const [practiceHtml, coachJs, customJs, practiceJs] = await Promise.all([
  readFile(new URL("../practice.html", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/coach.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/custom-stage.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/practice-1.js", import.meta.url), "utf8")
]);

test("custom stage accepts whole-minute durations from 5 through 180", () => {
  assert.deepEqual(core.buildBlocks(5,25,5),[{focusMinutes:5,breakAfterMinutes:0}]);
  assert.equal(core.buildBlocks(180,25,5).reduce((sum,b)=>sum+b.focusMinutes,0),180);
  assert.throws(()=>core.buildBlocks(4,25,5),/invalid_total_minutes/);
  assert.throws(()=>core.buildBlocks(181,25,5),/invalid_total_minutes/);
});

test("default 40-minute plan uses 25 focus, 5 break, then 15 focus", () => {
  assert.deepEqual(core.buildBlocks(40,25,5),[
    {focusMinutes:25,breakAfterMinutes:5},
    {focusMinutes:15,breakAfterMinutes:0}
  ]);
});

test("the alternative pattern uses 50-minute focus blocks and 10-minute breaks", () => {
  assert.deepEqual(core.buildBlocks(100,50,10),[
    {focusMinutes:50,breakAfterMinutes:10},
    {focusMinutes:50,breakAfterMinutes:0}
  ]);
});

test("the Practice UI exposes the custom stage with the requested defaults", () => {
  assert.match(practiceHtml,/id="customMinutes"[^>]*min="5"[^>]*max="180"[^>]*value="40"/);
  assert.match(practiceHtml,/data-custom-pattern="25"/);
  assert.match(practiceHtml,/data-custom-pattern="50"/);
  assert.match(practiceHtml,/id="customPlanPreview"/);
  assert.match(practiceHtml,/id="customStart"/);
  assert.match(customJs,/querySelectorAll\("\.lang button"\)/);
});

test("custom timer blocks are sent to the verified timer as stage=custom", () => {
  assert.match(practiceJs,/customSessionMode/);
  assert.match(practiceJs,/stage_type: state\.customSession \? "custom" : "standard"/);
  assert.match(practiceJs,/state\.customSession \? "custom:"/);
  assert.match(practiceJs,/stage: state\.customSession \? "custom" : "standard"/);
  assert.match(customJs,/reset\.html/);
  assert.match(customJs,/showReflection/);
});

test("the AI Coach starts the same custom stage flow and offers adjustment", () => {
  assert.match(coachJs,/coachPlanStart/);
  assert.match(coachJs,/customTotal/);
  assert.match(coachJs,/coachAdjustForm/);
  assert.match(coachJs,/reflect/);
});
