import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = (process.env.SITE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const artifacts = "/opt/cursor/artifacts";
const desktopUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const iphoneUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const instagramUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0.0";
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => window.NepsisGoogleAuth && window.supabase, null, { timeout: 20000 });
}

async function dismissConsent(context) {
  await context.addInitScript(() => {
    try { localStorage.setItem("nepsis-analytics-consent-v1", "denied"); } catch (error) {}
  });
}

const browser = await chromium.launch({ headless: true });

try {
  await mkdir(artifacts, { recursive: true });

  const mobile = await browser.newContext({
    locale: "el-GR",
    userAgent: iphoneUa,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await dismissConsent(mobile);
  await mobile.addInitScript(() => {
    window.__oauthOpens = [];
    window.open = function (url, name) {
      window.__oauthOpens.push({ url, name });
      return null;
    };
  });
  const phone = await mobile.newPage();
  await phone.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(phone);
  check(await phone.evaluate(() => window.NepsisGoogleAuth.prefersFullPageRedirect() === true), "iPhone UA did not select the same-tab redirect");
  const authorize = phone.waitForRequest((request) => request.url().includes("/auth/v1/authorize"), { timeout: 15000 });
  authorize.catch(() => {});
  await phone.route("https://emhukqvetlhjgadgskbl.supabase.co/**", (route) => route.abort());
  await phone.locator("#accBtn").click();
  await phone.locator("#accModal.open, #accGoogle").first().waitFor({ state: "visible", timeout: 10000 });
  await phone.screenshot({ path: artifacts + "/google-signin-mobile-account.png" });
  await phone.locator("#accGoogle").click({ timeout: 10000 });
  const mobileRequest = await authorize;
  const mobileUrl = new URL(mobileRequest.url());
  check(mobileUrl.searchParams.get("provider") === "google", "mobile authorize provider was " + mobileUrl.searchParams.get("provider"));
  check(mobileUrl.searchParams.get("skip_http_redirect") !== "true", "mobile authorize used the popup skip flag");
  check(mobileUrl.searchParams.get("redirect_to") === "http://127.0.0.1:4173/", "mobile redirect_to was " + mobileUrl.searchParams.get("redirect_to"));
  check(await phone.evaluate(() => window.__oauthOpens.length) === 0, "mobile sign-in opened a popup");
  await mobile.close();

  const instagram = await browser.newContext({
    locale: "el-GR",
    userAgent: instagramUa,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await dismissConsent(instagram);
  const inApp = await instagram.newPage();
  await inApp.goto(base + "/practice.html", { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(inApp);
  check(await inApp.evaluate(() => window.NepsisGoogleAuth.prefersFullPageRedirect() === true), "Instagram UA did not select the same-tab redirect");
  const practiceAuthorize = inApp.waitForRequest((request) => request.url().includes("/auth/v1/authorize"), { timeout: 15000 });
  practiceAuthorize.catch(() => {});
  await inApp.route("https://emhukqvetlhjgadgskbl.supabase.co/**", (route) => route.abort());
  await inApp.locator("#accBtn").click();
  check(inApp.url().includes("practice.html"), "practice Sign in left the page before Google was chosen: " + inApp.url());
  await inApp.locator("#accGoogle").click({ timeout: 10000 });
  const practiceRequest = await practiceAuthorize;
  const practiceUrl = new URL(practiceRequest.url());
  check(practiceUrl.searchParams.get("redirect_to") === "http://127.0.0.1:4173/practice.html", "practice redirect_to was " + practiceUrl.searchParams.get("redirect_to"));
  check(!String(practiceUrl.searchParams.get("redirect_to")).includes("github.io"), "practice still redirected to GitHub Pages");
  await instagram.close();

  const desktop = await browser.newContext({
    locale: "el-GR",
    userAgent: desktopUa,
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false
  });
  await dismissConsent(desktop);
  await desktop.addInitScript(() => {
    window.__oauthOpens = [];
    window.open = function () {
      const popup = { closed: false, location: {} };
      Object.defineProperty(popup.location, "href", {
        set(value) { popup.assigned = String(value); },
        get() { return popup.assigned || "about:blank"; }
      });
      window.__oauthOpens.push(popup);
      return popup;
    };
  });
  const desk = await desktop.newPage();
  await desk.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(desk);
  check(await desk.evaluate(() => window.NepsisGoogleAuth.prefersFullPageRedirect() === false), "desktop UA unexpectedly used the mobile redirect");
  await desk.locator("#accBtn").click();
  await desk.locator("#accGoogle").click({ timeout: 10000 });
  await desk.waitForFunction(() => window.__oauthOpens[0] && window.__oauthOpens[0].assigned, null, { timeout: 10000 });
  const popupTarget = new URL(await desk.evaluate(() => window.__oauthOpens[0].assigned));
  check(popupTarget.pathname.endsWith("/auth/v1/authorize"), "desktop popup did not open the Google authorize URL: " + popupTarget.href);
  check(popupTarget.searchParams.get("provider") === "google", "desktop popup provider was " + popupTarget.searchParams.get("provider"));
  check(desk.url() === base + "/", "desktop sign-in navigated the opener away: " + desk.url());
  check(popupTarget.searchParams.get("redirect_to") === "http://127.0.0.1:4173/", "desktop redirect_to was " + popupTarget.searchParams.get("redirect_to"));
  await desktop.close();

  const blocked = await browser.newContext({ locale: "el-GR", userAgent: desktopUa, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  await dismissConsent(blocked);
  await blocked.addInitScript(() => { window.open = () => null; });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(blockedPage);
  const blockedAuthorize = blockedPage.waitForRequest((request) => request.url().includes("/auth/v1/authorize"), { timeout: 15000 });
  blockedAuthorize.catch(() => {});
  await blockedPage.route("https://emhukqvetlhjgadgskbl.supabase.co/**", (route) => route.abort());
  await blockedPage.locator("#accBtn").click();
  await blockedPage.locator("#accGoogle").click({ timeout: 10000 });
  const blockedRequest = await blockedAuthorize;
  const blockedTarget = new URL(blockedRequest.url());
  check(blockedTarget.searchParams.get("provider") === "google", "blocked popup did not fall back to Google authorize");
  check(blockedTarget.searchParams.get("redirect_to") === "http://127.0.0.1:4173/", "blocked popup redirect_to was " + blockedTarget.searchParams.get("redirect_to"));
  await blocked.close();

  const returned = await browser.newContext({
    locale: "el-GR",
    userAgent: iphoneUa,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await dismissConsent(returned);
  const errorPage = await returned.newPage();
  await errorPage.goto(base + "/?error=access_denied&error_description=Redirect%20URL%20is%20not%20allowed", { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(errorPage);
  const errorToast = errorPage.locator("#nepsis-auth-notice");
  await errorToast.waitFor({ state: "visible", timeout: 15000 });
  const errorText = await errorToast.innerText();
  check(errorText.includes("Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά."), "missing Greek failure message: " + errorText);
  check(errorText.includes("access_denied"), "missing Supabase error code: " + errorText);
  check(errorText.includes("Redirect URL is not allowed"), "missing Supabase error_description: " + errorText);
  await errorPage.waitForFunction(() => !location.search.includes("error="), null, { timeout: 5000 });
  await errorPage.screenshot({ path: artifacts + "/google-signin-return-error.png", timeout: 10000 });
  await errorPage.close();

  const hashPage = await returned.newPage();
  await hashPage.goto(base + "/practice.html#error=server_error&error_description=Unable%20to%20exchange%20external%20code", { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(hashPage);
  await hashPage.locator("#nepsis-auth-notice").waitFor({ state: "visible", timeout: 15000 });
  const hashText = await hashPage.locator("#nepsis-auth-notice").innerText();
  check(hashText.includes("server_error") && hashText.includes("Unable to exchange external code"), "hash error was not surfaced: " + hashText);
  await hashPage.waitForFunction(() => !location.hash.includes("error="), null, { timeout: 5000 });

  const codePage = await returned.newPage();
  await codePage.goto(base + "/my-nepsis.html?code=not-a-real-code", { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(codePage);
  await codePage.locator("#nepsis-auth-notice").waitFor({ state: "visible", timeout: 20000 });
  const codeText = await codePage.locator("#nepsis-auth-notice").innerText();
  check(codeText.includes("Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά."), "PKCE failure was silent: " + codeText);
  await codePage.waitForFunction(() => !location.search.includes("code="), null, { timeout: 5000 });
  await returned.close();

  const signedIn = await browser.newContext({
    locale: "el-GR",
    userAgent: iphoneUa,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await dismissConsent(signedIn);
  await signedIn.addInitScript(() => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem("sb-emhukqvetlhjgadgskbl-auth-token", JSON.stringify({
      access_token: "playwright-access-token",
      refresh_token: "playwright-refresh-token",
      expires_at: expiresAt,
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "user-playwright", email: "owner@example.com" }
    }));
    sessionStorage.setItem("nepsis-oauth-return", JSON.stringify({ t: Date.now() }));
  });
  const signedPage = await signedIn.newPage();
  await signedPage.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(signedPage);
  const successToast = signedPage.locator("#nepsis-auth-notice");
  await successToast.waitFor({ state: "visible", timeout: 15000 });
  const successText = await successToast.innerText();
  check(successText.includes("Συνδέθηκες επιτυχώς"), "return with a stored session did not confirm sign-in: " + successText);
  check(successText.includes("owner@example.com"), "return toast omitted the account email: " + successText);
  await signedPage.locator("#nepsis-auth-state").waitFor({ state: "visible", timeout: 5000 });
  const badge = await signedPage.locator("#nepsis-auth-state").innerText();
  check(badge.includes("Συνδεδεμένος"), "signed-in badge missing: " + badge);
  await signedPage.screenshot({ path: artifacts + "/google-signin-return-success.png", timeout: 10000 });
  await signedIn.close();
} catch (error) {
  failures.push(error && error.stack ? error.stack : String(error));
} finally {
  await browser.close();
}

const report = { checkedAt: new Date().toISOString(), base, failures };
await writeFile("nepsis-google-oauth-browser-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error("GOOGLE SIGN-IN BROWSER CHECK FAILED");
  for (const failure of failures) console.error("- " + failure);
  process.exitCode = 1;
} else {
  console.log("Mobile, in-app, desktop popup, blocked popup, and return URL checks passed.");
}
