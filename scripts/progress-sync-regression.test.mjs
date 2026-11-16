import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [practice, dashboard, queueSource, diary, serviceWorker] = await Promise.all([
  readFile(new URL("../assets/js/pages/practice-1.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/my-nepsis-1.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/offline-sync-queue.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/pages/diary-1.js", import.meta.url), "utf8"),
  readFile(new URL("../sw.js", import.meta.url), "utf8")
]);

function createQueueHarness() {
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const window = { localStorage, crypto: { randomUUID: (() => { let id = 0; return () => `client-${++id}`; })() } };
  const navigator = { onLine: true };
  vm.runInNewContext(queueSource, { window, navigator, Uint8Array, Date, Math, Set, JSON, encodeURIComponent });
  return { queue: window.NepsisOfflineQueue, navigator };
}

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

test("offline queue client_id values are unique and stored per user", () => {
  const { queue } = createQueueHarness();
  const accountA = queue.enqueue("account-a", { type: "progress", data: { days: {} } });
  const accountB = queue.enqueue("account-b", { type: "diary_entry", row: { id: "entry-b" } });
  const nextA = queue.enqueue("account-a", { type: "progress", data: { days: { today: [25] } } });
  assert.notEqual(accountA.client_id, accountB.client_id);
  assert.notEqual(accountA.client_id, nextA.client_id);
  assert.deepEqual(queue.read("account-a").map(item => item.type), ["progress", "progress"]);
  assert.equal(queue.read("account-b")[0].row.id, "entry-b");
  queue.removeThrough("account-a", nextA.client_id, ["progress"]);
  assert.equal(queue.read("account-a").length, 0);
  assert.equal(queue.read("account-b").length, 1);
});

test("offline queue retains failed writes and drains only when online", async () => {
  const { queue, navigator } = createQueueHarness();
  const queued = queue.enqueue("account-a", { type: "progress", data: { days: {} } });
  const failed = await queue.flush("account-a", ["progress"], async () => { throw new Error("expired session"); });
  assert.equal(failed.error.message, "expired session");
  assert.equal(queue.has("account-a", queued.client_id), true);
  navigator.onLine = false;
  const offline = await queue.flush("account-a", ["progress"], async () => true);
  assert.equal(offline.blocked, true);
  assert.equal(queue.has("account-a", queued.client_id), true);
  navigator.onLine = true;
  const sent = await queue.flush("account-a", ["progress"], async () => true);
  assert.equal(sent.sent, 1);
  assert.equal(queue.has("account-a", queued.client_id), false);
});

test("diary drafts autosave only through the encrypted diary envelope", () => {
  assert.match(diary, /DRAFT_STORE="nepsis-diary-draft-encrypted-v1"/);
  assert.match(diary, /seal\(draft,draftKey,un64\(old\.salt\)\)/);
  assert.match(diary, /addEventListener\("input",queueDraftSave\)/);
  assert.match(diary, /await restoreDraft\(key\)/);
  assert.match(diary, /async function openDraft\(box,k\)/);
});

test("calendar and account writes are queued for reconnect under the active user", () => {
  assert.match(practice, /NepsisOfflineQueue\.enqueue\(targetUser\.id/);
  assert.match(practice, /window\.addEventListener\("online"/);
  assert.match(dashboard, /enqueueDashboardWrite\(targetUser,"user_space"/);
  assert.match(dashboard, /enqueueDashboardWrite\(targetUser,"diary_entry"/);
  assert.match(dashboard, /enqueueDashboardWrite\(activeUser,"progress"/);
  assert.match(dashboard, /window\.addEventListener\("online"/);
  assert.match(dashboard, /removeThrough\(activeUser\.id,queuedProgress\.client_id/);
});

test("offline pages and sync scripts are precached", () => {
  assert.match(serviceWorker, /nepsis-v13/);
  assert.match(serviceWorker, /asset\('coach\.html'\)/);
  assert.match(serviceWorker, /asset\('assets\/js\/coach-config\.js'\)/);
  assert.match(serviceWorker, /asset\('assets\/js\/pages\/coach\.js'\)/);
  assert.match(serviceWorker, /asset\('assets\/js\/pages\/coach-timer-bridge\.js'\)/);
  assert.match(serviceWorker, /asset\('assets\/css\/pages\/coach\.css'\)/);
  assert.match(serviceWorker, /asset\('diary\.html'\)/);
  assert.match(serviceWorker, /asset\('my-nepsis\.html'\)/);
  assert.match(serviceWorker, /asset\('assets\/js\/offline-sync-queue\.js'\)/);
});
