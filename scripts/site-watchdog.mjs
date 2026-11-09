import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const base = (process.env.SITE_URL || "https://nepsis-focus.github.io/nepsis-site/").replace(/\/$/, "");
const routes = [
  "/", "/practice.html", "/my-nepsis.html", "/reset.html", "/library.html",
  "/diary.html", "/about.html", "/how.html", "/faq.html", "/privacy.html", "/terms.html"
];
const viewports = [
  { name: "desktop", width: 1440, height: 1000, isMobile: false, hasTouch: false },
  { name: "mobile-390", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "mobile-320", width: 320, height: 740, isMobile: true, hasTouch: true }
];
const failures = [];
const results = [];
const checkedLinks = new Set();
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch
    });

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
      let internalLinks = [];
      let documentWidth = null;

      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        status = response?.status() ?? null;
        await page.locator("body").waitFor({ state: "visible", timeout: 10000 });
        await page.waitForTimeout(700);
        title = await page.title();

        if (!response || status >= 400) failures.push(`${viewport.name} ${route}: HTTP ${status ?? "no response"}`);
        if (!(await page.locator("body").innerText()).trim()) failures.push(`${viewport.name} ${route}: empty page body`);
        if (!title.trim()) failures.push(`${viewport.name} ${route}: missing document title`);

        const layout = await page.evaluate(() => {
          const drawer = document.getElementById("drawer");
          const drawerIsClosed = drawer && !drawer.classList.contains("open");
          const previousDisplay = drawer?.style.display;
          if (drawerIsClosed) drawer.style.display = "none";

          const viewportWidth = document.documentElement.clientWidth;
          const documentWidth = document.documentElement.scrollWidth;
          const overflowElements = Array.from(document.querySelectorAll("body *")).map(el => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return {
              tag: el.tagName.toLowerCase(),
              id: el.id || "",
              className: typeof el.className === "string" ? el.className : "",
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              scrollWidth: el.scrollWidth,
              overflowX: style.overflowX,
              position: style.position
            };
          }).filter(el => el.width > 0 && (el.right > viewportWidth + 2 || el.left < -2))
            .sort((a, b) => (b.right - viewportWidth) - (a.right - viewportWidth))
            .slice(0, 12);

          if (drawerIsClosed) drawer.style.display = previousDisplay || "";
          return { viewportWidth, documentWidth, overflowElements };
        });
        documentWidth = layout.documentWidth;
        if (layout.documentWidth > layout.viewportWidth + 2) {
          failures.push(`${viewport.name} ${route}: horizontal overflow (${layout.documentWidth}px content in ${layout.viewportWidth}px viewport); elements: ${JSON.stringify(layout.overflowElements)}`);
        }

                for (const message of pageErrors) failures.push(`${viewport.name} ${route}: JavaScript exception: ${message}`);
        for (const message of consoleErrors) {
          if (!/favicon|third.party|third-party/i.test(message)) {
            failures.push(`${viewport.name} ${route}: console error: ${message}`);
          }
        }

        internalLinks = await page.locator("a[href]").evaluateAll(anchors =>
          anchors.map(anchor => anchor.href)
            .filter(href => {
              try {
                const target = new URL(href);
                return target.origin === location.origin &&
                  target.pathname.startsWith(new URL(location.href).pathname.replace(/[^/]*$/, ""));
              } catch {
                return false;
              }
            })
        );

        if (viewport.name === "desktop") {
          const pendingLinks = [...new Set(internalLinks)].filter(href => !checkedLinks.has(href));
          pendingLinks.forEach(href => checkedLinks.add(href));

          for (let offset = 0; offset < pendingLinks.length; offset += 8) {
            const batch = pendingLinks.slice(offset, offset + 8);
            await Promise.all(batch.map(async href => {
              try {
                const linkResponse = await context.request.get(href, { timeout: 10000 });
                if (linkResponse.status() >= 400) {
                  failures.push(`${route}: broken internal link ${href} (HTTP ${linkResponse.status()})`);
                }
              } catch (error) {
                failures.push(`${route}: internal link request failed ${href}: ${error.message}`);
              }
            }));
          }
        }

                results.push({
          viewport: viewport.name, route, status, title,
          jsErrors: pageErrors.length, consoleErrors: consoleErrors.length,
          internalLinks: internalLinks.length, documentWidth
        });
      } catch (error) {
        failures.push(`${viewport.name} ${route}: navigation/check failed: ${error.message}`);
        results.push({ viewport: viewport.name, route, status, title, error: error.message });
      } finally {
        await page.close();
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  checkedAt: new Date().toISOString(),
  base,
  viewports: viewports.map(({ name, width, height }) => ({ name, width, height })),
  pagesChecked: results.length,
  pages: results,
  failures
};
await writeFile("nepsis-watchdog-report.json", JSON.stringify(report, null, 2), "utf8");

console.log("NEPSIS RESPONSIVE HEALTH REPORT");
console.log(JSON.stringify(report, null, 2));

if (failures.length) {
  console.error("\nHEALTH CHECK FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exitCode = 1;
} else {
  console.log("\nAll eleven site pages passed desktop, 390px, and 320px browser health checks.");
}
