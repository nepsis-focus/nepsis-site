import assert from "node:assert/strict";
import core from "../assets/js/coach-core.js";

const scenarios = [
  ["normal study plan", () => {
    assert.deepEqual(core.buildBlocks(40,25,5),[
      {focusMinutes:25,breakAfterMinutes:5},
      {focusMinutes:15,breakAfterMinutes:0}
    ]);
    assert.equal(core.isValidLibraryId("article-7"),true);
  }],
  ["very little time", () => {
    assert.deepEqual(core.buildBlocks(8,25,5),[{focusMinutes:8,breakAfterMinutes:0}]);
  }],
  ["exam anxiety", () => {
    assert.equal(core.detectCrisis("I feel anxious about tomorrow's exam"),false);
    assert.equal(core.buildBlocks(40,25,5).length,2);
  }],
  ["request to skip breaks", () => {
    assert.deepEqual(core.buildBlocks(100,50,10),[
      {focusMinutes:50,breakAfterMinutes:10},
      {focusMinutes:50,breakAfterMinutes:0}
    ]);
  }],
  ["crisis message", () => {
    assert.equal(core.detectCrisis(["I want to","kill","myself"].join(" ")),true);
    assert.equal(core.detectCrisis(["Δεν θέλω να","ζω"].join(" ")),true);
  }],
  ["off-topic request", () => {
    assert.equal(core.isClearlyOffTopic("Tell me a joke"),true);
    assert.equal(core.isClearlyOffTopic("Review biology chapter four"),false);
  }],
  ["1000-character input and Library ID guard", () => {
    assert.equal(core.isWithinInputLimit("a".repeat(1000)),true);
    assert.equal(core.isWithinInputLimit("a".repeat(1001)),false);
    assert.equal(core.isValidLibraryId("article-13"),true);
    assert.equal(core.isValidLibraryId("article-999"),false);
  }]
];

for(const [name,run] of scenarios){run();process.stdout.write("PASS "+name+"\\n");}
process.stdout.write("All "+scenarios.length+" scenario groups passed.\\n");
