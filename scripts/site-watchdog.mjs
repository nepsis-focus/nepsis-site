import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const base = (process.env.SITE_URL || "https://nepsis-focus.github.io/nepsis-site/").replace(/\/$/, "");
const routes = [
  "/", "/practice.html", "/my-nepsis.html", "/reset.html", "/library.html",
  "/tips/no-mobile-internet.html", "/tips/check-the-source.html", "/tips/ai-in-studying.html",
  "/diary.html", "/about.html", "/how.html", "/faq.html", "/exams.html", "/privacy.html",
  "/terms.html", "/premium.html"
];
const viewports = [
  { name: "desktop", width: 1440, height: 1000, isMobile: false, hasTouch: false },
  { name: "mobile-390", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "mobile-320", width: 320, height: 740, isMobile: true, hasTouch: true }
];
const failures = [];
const warnings = [];
const results = [];
const checkedLinks = new Set();
const siteOrigin = new URL(base).origin;
function isCrossOrigin(url) {
  if (!url) return false;
  try { return new URL(url).origin !== siteOrigin; } catch { return false; }
}
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch
    });
    // Treat the checks as a returning visitor who has already answered the analytics prompt.
    // The first-visit consent panel covers the bottom of narrow screens and is not part of the guest-flow check.
    await context.addInitScript(() => {
      try { localStorage.setItem("nepsis-analytics-consent-v1", "denied"); } catch (error) {}
    });

    for (const route of routes) {
      const url = base + route;
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];

      page.on("pageerror", error => pageErrors.push(error.message));
      page.on("console", message => {
        if (message.type() === "error") consoleErrors.push({ text: message.text(), url: message.location()?.url || "" });
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

        const overlays = await page.evaluate(() => {
          const selectors = ".scrim, .acc-scrim, .acc-modal, .sub-modal, .account, .nepsis-menu-scrim, .focus-nudge-scrim";
          const stuck = Array.from(document.querySelectorAll(selectors)).filter((el) => {
            if (el.classList.contains("open")) return false;
            if (el.classList.contains("focus-nudge-scrim") && document.body.classList.contains("nudge-visible")) return false;
            const style = getComputedStyle(el);
            return style.display !== "none" && style.pointerEvents !== "none";
          }).map((el) => el.id || el.className);
          // Prefer a visible header control — Sign in may be hidden on narrow widths.
          const button = ["#accBtn", "#accountBtn", "#menuBtn"].map((sel) => document.querySelector(sel)).find((el) => {
            if (!el) return false;
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
          }) || null;
          let hitsControl = true;
          if (button) {
            const rect = button.getBoundingClientRect();
            const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 12));
            hitsControl = !!top && (top === button || button.contains(top));
          }
          return { stuck, hitsControl, hasButton: !!button };
        });
        if (overlays.stuck.length) {
          failures.push(`${viewport.name} ${route}: closed overlay still captures pointer events: ${overlays.stuck.join(", ")}`);
        }
        if (overlays.hasButton && !overlays.hitsControl) {
          failures.push(`${viewport.name} ${route}: header control is covered by another layer`);
        }

        for (const message of pageErrors) failures.push(`${viewport.name} ${route}: JavaScript exception: ${message}`);
        for (const item of consoleErrors) {
          if (/favicon/i.test(item.text)) continue;
          // Resources served by another origin (CDNs, analytics) can be blocked or down without the
          // Nepsis site being broken. They are reported as warnings; same-origin errors fail the check.
          if (isCrossOrigin(item.url)) {
            warnings.push(`${viewport.name} ${route}: external resource error: ${item.text} (${item.url})`);
          } else {
            failures.push(`${viewport.name} ${route}: console error: ${item.text}${item.url ? " (" + item.url + ")" : ""}`);
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

        // Internal destinations are checked separately by the repository link audit.
        // Avoid issuing repeated preview HTTP requests here; Netlify can reset concurrent requests.
        
        if (route === "/practice.html") {
          const stageCount = await page.locator("#stageGrid .stage").count();
          const stageTimes = (await page.locator("#stageGrid .stage [data-time]").allTextContents())
            .map(value => value.trim());
          const expectedTimes = ["05:00", "10:00", "25:00", "45:00", "60:00"];
          if (stageCount !== 5) {
            failures.push(viewport.name + ": practice page rendered " + stageCount + " stages instead of 5");
          }
          if (JSON.stringify(stageTimes) !== JSON.stringify(expectedTimes)) {
            failures.push(viewport.name + ": unexpected practice stage times " + JSON.stringify(stageTimes));
          }

          // Functional smoke checks for the guest flow (no account needed).
          const quizText = (await page.locator("#quiz").innerText()).trim();
          if (quizText.length < 20) failures.push(`${viewport.name}: quiz rendered no content`);
          const calendarText = (await page.locator("#calendar").innerText()).trim();
          if (calendarText.length < 20) failures.push(`${viewport.name}: calendar rendered no content`);

          // Mock the server timer so the check exercises the page wiring only and writes nothing to the database.
          await page.route("**/functions/v1/focus-timer", (route) => route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, active: true, remaining_seconds: 300, session_id: "00000000-0000-4000-8000-000000000001", token: "watchdog-mock", state: "running" })
          }));
          const firstTime = page.locator("#stageGrid .stage [data-time]").first();
          const timeBefore = (await firstTime.textContent())?.trim();
          try {
            await page.locator("#stageGrid .stage [data-start]").first().click({ timeout: 5000 });
            await page.waitForTimeout(2500);
            const timeAfter = (await firstTime.textContent())?.trim();
            if (timeAfter === timeBefore) failures.push(`${viewport.name}: focus timer did not count after Start (still ${timeAfter})`);
          } catch (clickError) {
            failures.push(`${viewport.name}: focus timer Start could not be used: ${clickError.message.split("\n")[0]}`);
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
  failures,
  warnings
};
await writeFile("nepsis-watchdog-report.json", JSON.stringify(report, null, 2), "utf8");

console.log("NEPSIS RESPONSIVE HEALTH REPORT");
console.log(JSON.stringify(report, null, 2));

if (failures.length) {
  console.error("Site watchdog FAILED with " + failures.length + " problem(s):");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log("\nAll " + routes.length + " site pages passed desktop, 390px, and 320px browser health checks.");
}
if (warnings.length) console.warn(warnings.length + " external resource warning(s); not counted as failures.");
