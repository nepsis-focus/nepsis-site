import { chromium } from "playwright";

const base = (process.env.SITE_URL || "https://nepsis-focus.github.io/nepsis-site/").replace(/\/$/, "");
const routes = ["/", "/practice.html", "/about.html", "/how.html", "/faq.html", "/privacy.html"];
const failures = [];
const results = [];
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  for (const route of routes) {
    const url = base + route;
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    let status = null;
    let title = "";
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      status = response?.status() ?? null;
      await page.locator("body").waitFor({ state: "visible", timeout: 10000 });
      title = await page.title();

      if (!response || status >= 400) failures.push(`${route}: HTTP ${status ?? "no response"}`);
      if (!(await page.locator("body").innerText()).trim()) failures.push(`${route}: empty page body`);
      if (!title.trim()) failures.push(`${route}: missing document title`);

      for (const message of pageErrors) failures.push(`${route}: JavaScript exception: ${message}`);
      for (const message of consoleErrors) {
        if (!/favicon|third.party|third-party/i.test(message)) failures.push(`${route}: console error: ${message}`);
      }

      const internalLinks = await page.locator("a[href]").evaluateAll(anchors =>
        anchors.map(a => a.getAttribute("href"))
          .filter(href => href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"))
          .filter(href => href.startsWith("/") || href.startsWith(location.origin))
      );
      for (const href of [...new Set(internalLinks)]) {
        const target = href.startsWith("http") ? href : new URL(href, location.href).href;
        try {
          const linkResponse = await context.request.get(target, { timeout: 15000 });
          if (linkResponse.status() >= 400) failures.push(`${route}: broken internal link ${href} (HTTP ${linkResponse.status()})`);
        } catch (error) {
          failures.push(`${route}: internal link request failed ${href}: ${error.message}`);
        }
      }

      results.push({ route, status, title, jsErrors: pageErrors.length, consoleErrors: consoleErrors.length, internalLinks: internalLinks.length });
    } catch (error) {
      failures.push(`${route}: navigation/check failed: ${error.message}`);
      results.push({ route, status, title, error: error.message });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log("NEPSIS LIVE-SITE HEALTH REPORT");
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base, pages: results, failures }, null, 2));

if (failures.length) {
  console.error("\nHEALTH CHECK FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exitCode = 1;
} else {
  console.log("\nAll six pages passed the automated browser health check.");
}
