import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});

const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const writes = [];
  const savedProgress = JSON.stringify({
    days: { "2026-11-23": [5, 10] },
    distractions: { "2026-11-23": 2 }
  });

  await context.addInitScript(({ progress }) => {
    localStorage.setItem("nepsis-progress:guest:user:browser-regression-user", progress);
  }, { progress: savedProgress });

  // Replace only the Supabase SDK loader. The fake client returns a failed
  // account read and records any attempted write, exercising the real homepage
  // sync flow in Chromium without touching a live Supabase project.
  await page.route("**/supabase-js/**/supabase.min.js", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: `
      window.__progressSyncWrites = [];
      window.supabase = { createClient: function () {
        return {
          auth: {
            onAuthStateChange: function (callback) {
              setTimeout(function () { callback("INITIAL_SESSION", { user: { id: "browser-regression-user", email: "browser@example.test" } }); }, 0);
              return { data: { subscription: { unsubscribe: function () {} } } };
            },
            getSession: async function () { return { data: { session: { user: { id: "browser-regression-user" } } } }; },
            signOut: async function () { return { error: null }; }
          },
          from: function () {
            return {
              select: function () { return this; },
              eq: function () { return this; },
              maybeSingle: async function () { return { data: null, error: { message: "forced browser regression read failure" } }; },
              upsert: async function (value) { window.__progressSyncWrites.push(value); return { error: null }; }
            };
          }
        };
      } };
    `
  }));

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const message = document.getElementById("syncMsg");
    return message && /Could not read saved progress|Δεν ήταν δυνατή η ανάγνωση της αποθηκευμένης προόδου/.test(message.textContent || "");
  }, { timeout: 10000 });

  const actual = await page.evaluate(() => ({
    progress: localStorage.getItem("nepsis-progress:guest:user:browser-regression-user"),
    writes: window.__progressSyncWrites || []
  }));
  assert.equal(actual.progress, savedProgress, "a failed remote read must leave the saved local progress unchanged");
  assert.deepEqual(actual.writes, [], "a failed remote read must not issue an account progress write");
  await context.close();
  console.log("Browser regression passed: failed Supabase progress read preserved local data and made no upsert.");
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
