/* Site dock: a macOS-style bar at the bottom of every page. Each tile opens one
   section of the site. The account tile opens the sign-in panel where the page has
   one, and otherwise goes to My Nepsis. Minimized account panels show as running. */
(() => {
  const APPS = [
    { key: "stages", href: "practice.html", icon: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 2M9.5 3.5h5"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "coach", href: "coach.html", icon: '<path d="M12 4.5l1.7 4.3 4.3 1.7-4.3 1.7L12 16.5l-1.7-4.3L6 10.5l4.3-1.7z"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "library", href: "library.html", icon: '<path d="M5.5 5.5A1.5 1.5 0 0 1 7 4h11.5v13.5H7a1.5 1.5 0 0 0-1.5 1.5zM5.5 19.5A1.5 1.5 0 0 0 7 21h11.5"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "diary", href: "diary.html", icon: '<path d="M5 19.5l4.2-1 9.3-9.3-3.2-3.2-9.3 9.3zM13.5 6.5l3.2 3.2"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "exams", href: "exams.html", icon: '<rect x="4.5" y="5.5" width="15" height="14" rx="2"/><path d="M4.5 10h15M9 3.5v3.5M15 3.5v3.5M8 14h2m3 0h3"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "progress", href: "my-nepsis.html", icon: '<path d="M6 19V12M12 19V6M18 19v-9"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "pause", href: "reset.html", icon: '<path d="M6 18.5c0-7.5 4.5-12.5 12.5-13 0 8-4.5 13-12.5 13z"/><path d="M6 18.5l6.5-6.5"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "subscribe", subscribe: true, hidden: true, icon: '<path d="M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.2L12 16.4l-4.6 2.5.9-5.2-3.8-3.7 5.2-.8z"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "account", account: true, icon: '<circle cx="12" cy="9" r="3.6"/><path d="M5.5 20c1.3-3.6 3.9-5.2 6.5-5.2s5.2 1.6 6.5 5.2"/>', tone: ["#FFB36B", "#F0702A"] }
  ];
  const TXT = {
    el: { subscribe: "Συνδρομή", dock: "Ενότητες", stages: "Στάδια", coach: "AI Coach", library: "Βιβλιοθήκη", diary: "Ημερολόγιο", exams: "Εξετάσεις", progress: "Πρόοδος", pause: "Παύση", account: "Λογαριασμός" },
    en: { subscribe: "Plans", dock: "Sections", stages: "Stages", coach: "AI Coach", library: "Library", diary: "Diary", exams: "Exams", progress: "Progress", pause: "Pause", account: "Account" }
  };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "el");
  const here = location.pathname.split("/").pop() || "index.html";
  const hasAccountPanel = () => !!(document.getElementById("accModal") || document.getElementById("accountModal"));
  const running = new Set();
  const tiles = new Map();

  const dock = document.createElement("nav");
  dock.id = "wcDock";
  dock.className = "wc-dock";
  document.body.append(dock);
  document.body.classList.add("wc-has-dock");

  APPS.forEach(app => {
    const isButton = !!(app.account || app.subscribe);
    const el = document.createElement(isButton ? "button" : "a");
    if (isButton) el.type = "button";
    else {
      el.href = app.href;
      if (app.href === here) el.setAttribute("aria-current", "page");
    }
    el.className = "wc-app";
    el.dataset.key = app.key;
    el.style.setProperty("--tone-a", app.tone[0]);
    el.style.setProperty("--tone-b", app.tone[1]);
    el.innerHTML = '<span class="wc-tile"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + app.icon + '</svg></span><span class="wc-label"></span><i class="wc-run" aria-hidden="true"></i>';
    if (app.hidden) el.classList.add("is-hidden");
    if (app.subscribe) el.addEventListener("click", () => document.dispatchEvent(new CustomEvent("nepsis:open-subscribe")));
    if (app.account) {
      el.addEventListener("click", () => {
        if (hasAccountPanel()) document.dispatchEvent(new CustomEvent("nepsis:open-account"));
        else location.href = "my-nepsis.html";
      });
    }
    tiles.set(app.key, el);
    dock.append(el);
  });

  function applyLabels() {
    const t = TXT[lang()];
    dock.setAttribute("aria-label", t.dock);
    tiles.forEach((el, key) => { el.querySelector(".wc-label").textContent = t[key]; });
  }
  function setRunning(key, on) {
    if (on) running.add(key); else running.delete(key);
    const el = tiles.get(key);
    if (el) {
      el.classList.toggle("is-running", !!on);
      if (el.classList.contains("is-hidden") && on) el.classList.remove("is-hidden");
      if (el.dataset.key === "subscribe" && !on) el.classList.add("is-hidden");
    }
    dock.classList.toggle("has-running", running.size > 0);
  }
  applyLabels();
  new MutationObserver(applyLabels).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  // Magnify the tiles near the pointer, as the macOS dock does.
  dock.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    tiles.forEach(el => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(event.clientX - (r.left + r.width / 2));
      el.style.setProperty("--scale", (1 + 0.5 * Math.max(0, 1 - d / 110)).toFixed(3));
    });
  });
  dock.addEventListener("pointerleave", () => tiles.forEach(el => el.style.setProperty("--scale", "1")));

  // Hide the dock while a menu, sheet or account panel is open, so it never sits on top of them.
  const COVER = ".acc-modal.open, .account.open, .sub-modal.open, #drawer.open, .drawer.open, .nepsis-dialog[open]";
  const syncCover = () => document.documentElement.classList.toggle("wc-covered", !!document.querySelector(COVER));
  new MutationObserver(syncCover).observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class", "open"] });
  syncCover();

  window.NepsisDock = { setRunning };
})();
