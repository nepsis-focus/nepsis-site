import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [practice, dashboard] = await Promise.all([
  readFile(new URL("../assets/js/pages/practice-1.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/my-nepsis-1.js", import.meta.url), "utf8")
]);

function extractGuard(source, variable) {
  const match = source.match(/function isCurrentAuth\(expectedUser,expectedGeneration\)\{[^}]+\}/) ||
    source.match(/function isCurrentAuth\(expectedUser, expectedGeneration\)\s*\{[^}]+\}/);
  assert.ok(match, "production auth guard exists");
  const binding = variable === "practice" ? "sbUser" : "user";
  return new Function(`let ${binding}=null,authGeneration=0;${match[0]};return {set(u,g){${binding}=u;authGeneration=g},check:isCurrentAuth};`)();
}

test("a delayed Account A response is stale after switching to Account B", async () => {
  const guard = extractGuard(practice, "practice");
  const accountA = { id: "account-a" };
  guard.set(accountA, 1);
  let resolve;
  const request = new Promise(r => { resolve = r; });
  const result = request.then(() => guard.check(accountA, 1));
  guard.set({ id: "account-b" }, 2);
  resolve();
  assert.equal(await result, false);
});

test("a delayed response from an earlier session generation is stale after reconnect", () => {
  const guard = extractGuard(practice, "practice");
  const account = { id: "same-account" };
  guard.set(account, 4);
  guard.set(account, 5);
  assert.equal(guard.check(account, 4), false);
  assert.equal(guard.check(account, 5), true);
});

test("remote SELECT errors abort progress merge and write in both pages", () => {
  const pullStart = practice.indexOf("async function sbPull(");
  const pullEnd = practice.indexOf("function renderAcc(", pullStart);
  const pull = practice.slice(pullStart, pullEnd);
  assert.ok(pull.indexOf('.select("data")') < pull.indexOf("if (res.error) throw res.error"));
  assert.ok(pull.indexOf("if (res.error) throw res.error") < pull.indexOf("const merged = mergeProgress(loadProgress(), remote)"));
  assert.ok(pull.indexOf("if (res.error) throw res.error") < pull.indexOf("storeProgress(merged)"));
  const authStart = dashboard.indexOf("if(sb)sb.auth.onAuthStateChange");
  const auth = dashboard.slice(authStart);
  assert.ok(auth.indexOf('select("data")') < auth.indexOf("if(r.error)"));
  assert.ok(auth.indexOf("if(r.error)") < auth.indexOf(".upsert({user_id:activeUser.id,data:progress"));
  assert.match(auth, /if\(r\.error\)\{[\s\S]*?return;\}/);
});

test("local progress storage is isolated by user and guest identity", () => {
  assert.match(practice, /const PROGRESS_KEY = ["']nepsis-progress:guest["']/);
  assert.match(practice, /function progressStorageKey\(\)\s*\{\s*return sbUser && sbUser\.id \? PROGRESS_KEY \+ ["']:user:["'] \+ sbUser\.id : PROGRESS_KEY;\s*\}/);
  assert.match(dashboard, /nepsis-progress:user:/);
  assert.match(dashboard, /nepsis-progress:guest/);
});

test("both sync implementations guard the awaited SELECT response", () => {
  const pull = practice.slice(practice.indexOf("async function sbPull("), practice.indexOf("function renderAcc("));
  assert.match(pull, /await sb\.from\("progress"\)[\s\S]*?if \(!isCurrentAuth\(targetUser, generation\)\) return;/);
  const auth = dashboard.slice(dashboard.indexOf("if(sb)sb.auth.onAuthStateChange"));
  assert.match(auth, /await sb\.from\("progress"\)[\s\S]*?if\(!isCurrentAuth\(activeUser,generation\)\)return;/);
});
