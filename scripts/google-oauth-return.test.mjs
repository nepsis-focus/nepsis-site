import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("../assets/js/google-oauth.js", import.meta.url), "utf8");
const pages = {
  index: await readFile(new URL("../assets/js/pages/index-1.js", import.meta.url), "utf8"),
  practice: await readFile(new URL("../assets/js/pages/practice-1.js", import.meta.url), "utf8"),
  dashboard: await readFile(new URL("../assets/js/pages/my-nepsis-1.js", import.meta.url), "utf8"),
  coach: await readFile(new URL("../assets/js/pages/coach.js", import.meta.url), "utf8"),
  coachHtml: await readFile(new URL("../coach.html", import.meta.url), "utf8"),
  diary: await readFile(new URL("../assets/js/pages/diary-1.js", import.meta.url), "utf8")
};

function createElement(ids, tag) {
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    id: "",
    className: "",
    textContent: "",
    disabled: false,
    title: "",
    style: {},
    dataset: {},
    attributes: {},
    children: [],
    parentElement: null,
    removed: [],
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      if (child.id) ids[child.id] = child;
      return child;
    },
    append(...children) { children.forEach((child) => this.appendChild(child)); },
    insertBefore(child) { return this.appendChild(child); },
    insertAdjacentElement(_position, child) {
      if (this.parentElement) return this.parentElement.appendChild(child);
      return child;
    },
    querySelector(selector) {
      const matches = (child) => {
        if (selector === ".nepsis-auth-state-label") return String(child.className).includes("nepsis-auth-state-label");
        if (selector === ".nepsis-oauth-spinner") return String(child.className).includes("nepsis-oauth-spinner");
        return false;
      };
      return this.children.find(matches) || null;
    },
    querySelectorAll() { return []; },
    addEventListener() {},
    remove() {
      this.removed.push(this.id);
      if (this.id) delete ids[this.id];
    },
    focus() { this.focused = true; },
    closest() { return this.parentElement; },
    classList: null
  };
  node.classList = {
    toggle() {},
    add(name) { node.className = (node.className + " " + name).trim(); },
    remove(name) { node.className = node.className.split(/\s+/).filter((part) => part !== name).join(" "); node.removed.push(name); }
  };
  return new Proxy(node, {
    set(target, prop, value) {
      target[prop] = value;
      if (prop === "id" && value) ids[value] = target;
      return true;
    }
  });
}

function loadAuth(href, options = {}) {
  const ids = {};
  const listeners = { window: {}, document: {} };
  const sessionStore = new Map(Object.entries(options.session || {}));
  const element = (tag) => createElement(ids, tag);
  const document = {
    documentElement: { lang: options.lang || "el", dataset: {} },
    visibilityState: "visible",
    getElementById(id) { return ids[id] || null; },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === "[data-oauth-busy='1']") return Object.values(ids).filter((node) => node.dataset && node.dataset.oauthBusy === "1");
      return [];
    },
    createElement: element,
    addEventListener(type, fn) { (listeners.document[type] ||= []).push(fn); }
  };
  document.body = element("body");
  document.head = element("head");
  const parsed = new URL(href);
  const location = {
    href: parsed.href,
    origin: parsed.origin,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    assigned: null,
    assign(url) { this.assigned = String(url); }
  };
  const history = { state: { page: 1 }, next: "", calls: 0, replaceState(_state, _title, next) { this.next = String(next); this.calls += 1; } };
  const window = {
    location,
    history,
    document,
    navigator: options.navigator || { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36", platform: "Win32", maxTouchPoints: 0 },
    sessionStorage: {
      getItem(key) { return sessionStore.has(key) ? sessionStore.get(key) : null; },
      setItem(key, value) { sessionStore.set(key, String(value)); },
      removeItem(key) { sessionStore.delete(key); }
    },
    opener: null,
    close() { window.closed = true; },
    open: options.open || (() => null),
    matchMedia() { return { matches: !!options.coarse }; },
    addEventListener(type, fn) { (listeners.window[type] ||= []).push(fn); },
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame(fn) { return setTimeout(fn, 0); },
    MutationObserver: null
  };
  window.window = window;
  const context = {
    window,
    document,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Object,
    Array,
    String,
    Promise,
    WeakSet,
    JSON,
    Date,
    Number,
    RegExp,
    Error
  };
  vm.runInNewContext(source, context, { filename: "google-oauth.js" });
  return {
    auth: window.NepsisGoogleAuth,
    window,
    document,
    ids,
    history,
    location,
    emit(target, type, event) { (listeners[target][type] || []).forEach((fn) => fn(event)); }
  };
}

function button(page, id) {
  const node = page.document.createElement("button");
  node.id = id;
  page.document.body.appendChild(node);
  return node;
}

function mockClient(state = {}) {
  const listeners = [];
  return {
    listeners,
    auth: {
      signInWithOAuth(args) {
        (state.calls ||= []).push(args);
        if (state.oauthError) return Promise.reject(state.oauthError);
        return Promise.resolve({ data: { provider: "google", url: state.url || "https://accounts.example/authorize?provider=google" }, error: state.resultError || null });
      },
      getSession() { return Promise.resolve({ data: { session: state.session || null } }); },
      onAuthStateChange(callback) {
        listeners.push(callback);
        return { data: { subscription: { unsubscribe() { state.unsubscribed = true; } } } };
      },
      exchangeCodeForSession(code) {
        state.exchanged = code;
        if (state.exchangeError) return Promise.reject(state.exchangeError);
        return Promise.resolve({ data: { session: state.exchangedSession || null } });
      },
      setSession(payload) {
        state.setPayload = payload;
        return Promise.resolve({ data: { session: state.setSessionResult || null } });
      }
    }
  };
}

const session = {
  access_token: "access-token-1",
  refresh_token: "refresh-token-1",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "user-1", email: "owner@example.com" }
};

function flush(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("every Supabase client uses the same persisted auth options", () => {
  const page = loadAuth("https://nepsis-site.nepsis-corp.workers.dev/");
  assert.deepEqual(JSON.parse(JSON.stringify(page.auth.clientOptions().auth)), {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
    flowType: "implicit",
    storageKey: "sb-emhukqvetlhjgadgskbl-auth-token"
  });
  for (const [name, file] of Object.entries({ index: pages.index, practice: pages.practice, dashboard: pages.dashboard, coach: pages.coach })) {
    const calls = file.split("createClient(").length - 1;
    const options = file.split("clientOptions()").length - 1;
    assert.equal(options, calls, name + " creates its Supabase client with shared auth options");
    assert.ok(calls > 0, name + " creates a Supabase client");
  }
  assert.match(pages.coachHtml, /assets\/js\/google-oauth\.js/);
  assert.doesNotMatch(pages.diary, /createClient\(/);
});

test("mobile, touch, and in-app browsers use a same-tab redirect", () => {
  const cases = [
    ["iPhone", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1", platform: "iPhone", maxTouchPoints: 5 }],
    ["Android", { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5 }],
    ["Instagram", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 320.0.0.0.0", platform: "iPhone", maxTouchPoints: 5 }],
    ["iPad desktop UA", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 }]
  ];
  for (const [name, navigator] of cases) {
    const page = loadAuth("https://nepsis-site.nepsis-corp.workers.dev/practice.html", { navigator });
    assert.equal(page.auth.prefersFullPageRedirect(), true, name);
  }
  const desktop = loadAuth("https://nepsis-focus.github.io/nepsis-site/");
  assert.equal(desktop.auth.prefersFullPageRedirect(), false);
  const touch = loadAuth("https://nepsis-focus.github.io/nepsis-site/", { coarse: true });
  assert.equal(touch.auth.prefersFullPageRedirect(), true);
});

test("mobile sign-in redirects in the same tab and keeps origin plus pathname", async () => {
  const page = loadAuth("https://nepsis-site.nepsis-corp.workers.dev/practice.html?utm=keep", {
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5 }
  });
  let opened = 0;
  page.window.open = () => { opened += 1; return { closed: false, location: {} }; };
  const state = {};
  const client = mockClient(state);
  const control = button(page, "accGoogle");
  const result = await page.auth.signIn({ client, button: control, lang: "el" });
  assert.equal(result.mode, "redirect");
  assert.equal(opened, 0);
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].provider, "google");
  assert.equal(state.calls[0].options.skipBrowserRedirect, undefined);
  assert.equal(state.calls[0].options.redirectTo, "https://nepsis-site.nepsis-corp.workers.dev/practice.html");
  assert.equal(page.location.assigned, "https://accounts.example/authorize?provider=google");
  assert.equal(page.window.sessionStorage.getItem("nepsis-oauth-return") !== null, true);
});

test("desktop keeps the popup and a blocked popup falls back to the same tab", async () => {
  const popup = { closed: false, location: {}, close() { popup.closed = true; } };
  let assigned = "";
  Object.defineProperty(popup.location, "href", { set(value) { assigned = String(value); } });
  const page = loadAuth("https://nepsis-focus.github.io/nepsis-site/index.html", { open: () => popup });
  const state = {};
  const result = await page.auth.signIn({ client: mockClient(state), button: button(page, "accGoogle"), lang: "en" });
  assert.equal(result.mode, "popup");
  assert.equal(state.calls[0].options.skipBrowserRedirect, true);
  assert.equal(state.calls[0].options.redirectTo, "https://nepsis-focus.github.io/nepsis-site/index.html");
  assert.equal(assigned, "https://accounts.example/authorize?provider=google");
  popup.closed = true;
  await flush(450);

  const blocked = loadAuth("https://nepsis-focus.github.io/nepsis-site/", { open: () => null });
  const blockedState = {};
  const blockedResult = await blocked.auth.signIn({ client: mockClient(blockedState), button: button(blocked, "accBtn"), lang: "en" });
  assert.equal(blockedResult.mode, "redirect");
  assert.equal(blockedState.calls[0].options.skipBrowserRedirect, undefined);
  assert.equal(blocked.location.assigned, "https://accounts.example/authorize?provider=google");
});

test("a Supabase error in the query or hash is shown and removed", async () => {
  const query = loadAuth("https://nepsis-site.nepsis-corp.workers.dev/?error=access_denied&error_description=Redirect+URL+is+not+allowed&keep=1");
  button(query, "accBtn");
  query.auth.watchPopupCompletion(mockClient());
  await flush();
  const queryToast = query.ids["nepsis-auth-notice"];
  assert.ok(queryToast);
  assert.match(queryToast.textContent, /Η σύνδεση δεν ολοκληρώθηκε\. Δοκίμασε ξανά\./);
  assert.match(queryToast.textContent, /access_denied/);
  assert.match(queryToast.textContent, /Redirect URL is not allowed/);
  assert.equal(query.history.next, "/?keep=1");
  assert.equal(query.window.sessionStorage.getItem("nepsis-oauth-return"), null);

  const hash = loadAuth("https://nepsis-focus.github.io/nepsis-site/my-nepsis.html#error=server_error&error_description=Unable%20to%20exchange%20external%20code", { lang: "en" });
  hash.auth.watchPopupCompletion(mockClient());
  await flush();
  assert.match(hash.ids["nepsis-auth-notice"].textContent, /Sign-in didn't complete\. Please try again\./);
  assert.match(hash.ids["nepsis-auth-notice"].textContent, /server_error/);
  assert.match(hash.ids["nepsis-auth-notice"].textContent, /Unable to exchange external code/);
  assert.equal(hash.history.next, "/nepsis-site/my-nepsis.html");
});

test("returning without a session explains the failure instead of doing nothing", async () => {
  const page = loadAuth("https://nepsis-site.nepsis-corp.workers.dev/");
  page.window.sessionStorage.setItem("nepsis-oauth-return", JSON.stringify({ t: Date.now() }));
  page.auth.watchPopupCompletion(mockClient());
  await flush();
  assert.equal(page.ids["nepsis-auth-notice"].textContent, "Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.");
  assert.equal(page.window.sessionStorage.getItem("nepsis-oauth-return"), null);
});

test("a returned session shows the signed-in state, toast, and cleaned URL", async () => {
  const page = loadAuth("https://nepsis-site.nepsis-corp.workers.dev/#access_token=abc&refresh_token=def&token_type=bearer");
  const control = button(page, "accBtn");
  const modal = page.document.createElement("div");
  modal.id = "accountModal";
  modal.className = "open";
  page.document.body.appendChild(modal);
  page.auth.watchPopupCompletion(mockClient({ session }));
  await flush();
  assert.equal(control.dataset.nepsisSignedIn, "true");
  assert.match(control.textContent, /Ο λογαριασμός μου/);
  assert.match(page.ids["nepsis-auth-state"].querySelector(".nepsis-auth-state-label").textContent, /Συνδεδεμένος/);
  assert.match(page.ids["nepsis-auth-notice"].textContent, /Συνδέθηκες επιτυχώς/);
  assert.match(page.ids["nepsis-auth-notice"].textContent, /owner@example.com/);
  assert.equal(page.history.next, "/");
  assert.equal(modal.className.includes("open"), false);
});

test("a PKCE code is exchanged and a hash session can be restored", async () => {
  const codePage = loadAuth("https://nepsis-site.nepsis-corp.workers.dev/?code=pkce-code");
  const codeState = { exchangedSession: session };
  codePage.auth.watchPopupCompletion(mockClient(codeState));
  await flush();
  assert.equal(codeState.exchanged, "pkce-code");
  assert.match(codePage.ids["nepsis-auth-notice"].textContent, /Συνδέθηκες επιτυχώς/);
  assert.equal(codePage.history.next, "/");

  const hashPage = loadAuth("https://nepsis-focus.github.io/nepsis-site/#access_token=hash-access&refresh_token=hash-refresh", { lang: "en" });
  const hashState = { setSessionResult: session };
  hashPage.auth.watchPopupCompletion(mockClient(hashState));
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(hashState.setPayload)), { access_token: "hash-access", refresh_token: "hash-refresh" });
  assert.match(hashPage.ids["nepsis-auth-notice"].textContent, /Signed in successfully/);
});

test("the opener adopts a session stored by the popup tab", async () => {
  const page = loadAuth("https://nepsis-focus.github.io/nepsis-site/");
  const control = button(page, "accBtn");
  const state = {};
  page.auth.watchPopupCompletion(mockClient(state));
  await flush();
  assert.equal(page.ids["nepsis-auth-notice"], undefined);
  state.session = session;
  page.emit("window", "storage", { key: "sb-emhukqvetlhjgadgskbl-auth-token" });
  page.emit("window", "focus", {});
  await flush(80);
  assert.equal(control.dataset.nepsisSignedIn, "true");
  assert.match(page.ids["nepsis-auth-notice"].textContent, /Συνδέθηκες επιτυχώς/);
});

test("closing the desktop popup without a session re-enables the button and explains why", async () => {
  const popup = { closed: false, location: {}, close() { popup.closed = true; } };
  Object.defineProperty(popup.location, "href", { set() {} });
  const page = loadAuth("https://nepsis-focus.github.io/nepsis-site/", { open: () => popup, lang: "en" });
  const control = button(page, "accGoogle");
  const result = await page.auth.signIn({ client: mockClient(), button: control, lang: "en" });
  assert.equal(result.mode, "popup");
  assert.equal(control.dataset.oauthBusy, "1");
  popup.closed = true;
  await flush(450);
  assert.match(page.ids["nepsis-auth-notice"].textContent, /Sign-in didn't complete\. Please try again\./);
  assert.equal(control.dataset.oauthBusy, "0");
  assert.equal(control.disabled, false);
});

test("practice sign-in opens the account dialog when auth scripts loaded", () => {
  assert.match(pages.practice, /if \(sb \|\| window\.NepsisGoogleAuth \|\| sbUser/);
  assert.match(pages.practice, /event\.preventDefault\(\);\s*setAcc\(true\);/);
});
