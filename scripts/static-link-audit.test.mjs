// Static audit of local links and asset paths in every HTML page.
// Fails when a relative link/asset points to a file that is not in the repository,
// or when a root-absolute path (/page.html) is used, because the site is served from
// the project path /nepsis-site/ on GitHub Pages and root-absolute paths break there.
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = /^(https?:|\/\/|mailto:|tel:|data:|javascript:|#|$)/i;

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

test("every relative link and asset in the HTML pages resolves to a repository file", async () => {
  const problems = [];
  const pages = await htmlFiles(repoRoot);
  for (const page of pages) {
    // Inline script bodies are JavaScript, not markup, so they are not scanned.
    const html = (await readFile(page, "utf8")).replace(/<script[\s\S]*?<\/script>/gi, "");
    const pageRel = relative(repoRoot, page);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const raw = match[1].trim();
      if (SKIP.test(raw)) continue;
      const target = raw.split(/[?#]/)[0];
      if (target.startsWith("/")) {
        problems.push(`${pageRel}: root-absolute path "${raw}" (use a relative path)`);
        continue;
      }
      let path = resolve(dirname(page), decodeURI(target));
      if (target.endsWith("/")) path = join(path, "index.html");
      if (!(await exists(path))) problems.push(`${pageRel}: missing target "${raw}"`);
    }
  }
  assert.equal(problems.length, 0, "Broken or root-absolute links:\n" + problems.join("\n"));
});
