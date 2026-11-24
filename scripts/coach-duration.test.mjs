import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../assets/js/coach-core.js");
const [html,custom,practice,css]=await Promise.all([
  readFile(new URL("../practice.html",import.meta.url),"utf8"),
  readFile(new URL("../assets/js/pages/custom-stage.js",import.meta.url),"utf8"),
  readFile(new URL("../assets/js/pages/practice-1.js",import.meta.url),"utf8"),
  readFile(new URL("../assets/css/pages/practice.css",import.meta.url),"utf8")
]);
test("custom focus duration accepts 5 through 180 whole minutes only",()=>{
  for(const value of [5,40,180])assert.doesNotThrow(()=>core.buildBlocks(value,25,5));
  for(const value of [4,181,40.5])assert.throws(()=>core.buildBlocks(value,25,5),RangeError);
  assert.throws(()=>core.buildBlocks(60,25,10),RangeError);
  assert.throws(()=>core.buildBlocks(60,50,5),RangeError);
  assert.match(html,/id="customMinutes" type="number" min="5" max="180" step="1" value="40"/);
});
test("both requested focus and break patterns preview correctly",()=>{
  assert.deepEqual(core.buildBlocks(60,25,5),[{focusMinutes:25,breakAfterMinutes:5},{focusMinutes:25,breakAfterMinutes:5},{focusMinutes:10,breakAfterMinutes:0}]);
  assert.deepEqual(core.buildBlocks(60,50,10),[{focusMinutes:50,breakAfterMinutes:10},{focusMinutes:10,breakAfterMinutes:0}]);
  assert.match(html,/data-custom-pattern="25"/);assert.match(html,/data-custom-pattern="50"/);
  assert.match(custom,/core\.buildBlocks\(total, block, rest\)/);
});
test("custom sessions use the verified timer and record custom stage minutes",()=>{
  assert.match(practice,/customSession: customSessionMode && s\.custom === true/);
  assert.match(practice,/stage_type: state\.customSession \? "custom" : "standard"/);
  assert.match(practice,/stage: state\.customSession \? "custom" : "standard"/);
  assert.match(css,/custom-session-overlay/);
});
