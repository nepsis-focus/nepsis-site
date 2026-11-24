/* macOS-style windows and dock for the account panel.
   Red closes the panel, yellow tucks it into the dock, green enlarges it.
   The dock lists the site's sections and any minimized panel; the account item
   opens or restores the panel. Works on top of each page's own open/close code. */
(() => {
  const TARGETS = [
    { overlay: "accModal", card: ".acc-card", close: "accClose" },
    { overlay: "accountModal", card: ".account-card", close: "accountClose" }
  ];
  const TXT = {
    el: { close: "Κλείσιμο", minimize: "Ελαχιστοποίηση", zoom: "Μεγέθυνση", dock: "Εφαρμογές",
      account: "Λογαριασμός", stages: "Στάδια", coach: "Coach", library: "Βιβλιοθήκη",
      progress: "Πρόοδος", diary: "Ημερολόγιο", pause: "Παύση" },
    en: { close: "Close", minimize: "Minimize", zoom: "Zoom", dock: "Apps",
      account: "Account", stages: "Stages", coach: "AI Coach", library: "Library",
      progress: "Progress", diary: "Diary", pause: "Pause" }
  };
  const APPS = [
    { key: "stages", href: "practice.html", icon: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 2M9.5 3.5h5"/>', tone: ["#FFB36B", "#F0702A"] },
    { key: "coach", href: "coach.html", icon: '<path d="M12 4.5l1.7 4.3 4.3 1.7-4.3 1.7L12 16.5l-1.7-4.3L6 10.5l4.3-1.7z"/>', tone: ["#B9A6FF", "#7A5CF0"] },
    { key: "library", href: "library.html", icon: '<path d="M5.5 5.5A1.5 1.5 0 0 1 7 4h11.5v13.5H7a1.5 1.5 0 0 0-1.5 1.5zM5.5 19.5A1.5 1.5 0 0 0 7 21h11.5"/>', tone: ["#8ED0FF", "#2F7BE8"] },
    { key: "diary", href: "diary.html", icon: '<path d="M5 19.5l4.2-1 9.3-9.3-3.2-3.2-9.3 9.3zM13.5 6.5l3.2 3.2"/>', tone: ["#FFE48F", "#F0A92B"] },
    { key: "progress", href: "my-nepsis.html", icon: '<path d="M6 19V12M12 19V6M18 19v-9"/>', tone: ["#93E8A6", "#27B356"] },
    { key: "pause", href: "reset.html", icon: '<path d="M6 18.5c0-7.5 4.5-12.5 12.5-13 0 8-4.5 13-12.5 13z"/><path d="M6 18.5l6.5-6.5"/>', tone: ["#86E6DC", "#1FA596"] },
    { key: "account", account: true, icon: '<circle cx="12" cy="9" r="3.6"/><path d="M5.5 20c1.3-3.6 3.9-5.2 6.5-5.2s5.2 1.6 6.5 5.2"/>', tone: ["#E4DED8", "#8E8782"] }
  ];

  const lang = () => (document.documentElement.lang === "en" ? "en" : "el");
  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const here = (location.pathname.split("/").pop() || "index.html");
  const running = new Map(); // overlay id -> true while minimized
  const labels = [];          // [element, key] so labels follow the language switch
  let dock = null;
  const accountItems = new Map();

  function accountTarget(key) { return TARGETS.find(t => t.overlay === key); }

  function openPanel(target) {
    const overlay = document.getElementById(target.overlay);
    if (!overlay) return;
    running.delete(target.overlay);
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.add("open");
    overlay.querySelector(target.card)?.focus?.({ preventScroll: true });
    updateDock();
  }

  function minimize(target) {
    const overlay = document.getElementById(target.overlay);
    const card = overlay?.querySelector(target.card);
    if (!overlay || !card) return;
    const finish = () => {
      card.classList.remove("wc-to-dock");
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      running.set(target.overlay, true);
      updateDock();
    };
    if (reduceMotion()) return finish();
    card.classList.add("wc-to-dock");
    window.setTimeout(finish, 340);
  }

  function buildDock() {
    dock = document.getElementById("wcDock");
    if (!dock) {
      dock = document.createElement("nav");
      dock.id = "wcDock";
      dock.className = "wc-dock";
      document.body.append(dock);
    }
    dock.setAttribute("aria-label", TXT[lang()].dock);
    const hasAccount = TARGETS.some(t => document.getElementById(t.overlay));
    APPS.forEach(app => {
      if (app.account && !hasAccount) return;
      const target = app.account ? TARGETS.find(t => document.getElementById(t.overlay)) : null;
      const el = document.createElement(app.account ? "button" : "a");
      if (app.account) el.type = "button";
      else {
        el.href = app.href;
        if (app.href === here) el.setAttribute("aria-current", "page");
      }
      el.className = "wc-app";
      el.dataset.key = app.key;
      el.style.setProperty("--tone-a", app.tone[0]);
      el.style.setProperty("--tone-b", app.tone[1]);
      el.innerHTML = '<span class="wc-tile"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + app.icon + '</svg></span><span class="wc-label"></span><i class="wc-run" aria-hidden="true"></i>';
      labels.push([el.querySelector(".wc-label"), app.key]);
      if (app.account) {
        el.addEventListener("click", () => openPanel(target));
        accountItems.set(target.overlay, el);
      }
      dock.append(el);
    });
    applyLabels();
    updateDock();

    // Magnify the tiles near the pointer, the way the macOS dock does.
    const items = () => [...dock.querySelectorAll(".wc-app")];
    dock.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      items().forEach(el => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(event.clientX - (r.left + r.width / 2));
        const s = 1 + 0.5 * Math.max(0, 1 - d / 110);
        el.style.setProperty("--scale", s.toFixed(3));
      });
    });
    dock.addEventListener("pointerleave", () => items().forEach(el => el.style.setProperty("--scale", "1")));
  }

  function applyLabels() {
    const t = TXT[lang()];
    labels.forEach(([node, key]) => { node.textContent = t[key]; });
    dock?.setAttribute("aria-label", t.dock);
  }

  function updateDock() {
    if (!dock) return;
    let any = false;
    TARGETS.forEach(target => {
      const el = accountItems.get(target.overlay);
      const minimized = !!running.get(target.overlay);
      if (el) el.classList.toggle("is-running", minimized);
      if (minimized) any = true;
    });
    dock.classList.toggle("has-running", any);
  }

  function addLights(target) {
    const overlay = document.getElementById(target.overlay);
    const card = overlay?.querySelector(target.card);
    if (!overlay || !card || card.querySelector(".wc-lights")) return;
    card.classList.add("wc-card");
    const t = TXT[lang()];
    const bar = document.createElement("div");
    bar.className = "wc-lights";
    bar.innerHTML =
      '<button type="button" class="wc-red" aria-label="' + t.close + '" title="' + t.close + '"><span></span></button>' +
      '<button type="button" class="wc-yellow" aria-label="' + t.minimize + '" title="' + t.minimize + '"><span></span></button>' +
      '<button type="button" class="wc-green" aria-label="' + t.zoom + '" title="' + t.zoom + '" aria-pressed="false"><span></span></button>' +
      '<span class="wc-title">' + t.account + '</span>';
    bar.querySelector(".wc-red").addEventListener("click", () => document.getElementById(target.close)?.click());
    bar.querySelector(".wc-yellow").addEventListener("click", () => minimize(target));
    const zoom = bar.querySelector(".wc-green");
    zoom.addEventListener("click", () => {
      const on = card.classList.toggle("wc-zoomed");
      zoom.setAttribute("aria-pressed", String(on));
    });
    const own = document.getElementById(target.close);
    if (own && own.parentElement === card) own.after(bar);
    else card.prepend(bar);

    // Opening the panel from anywhere (menu, sign-in button) clears its running state.
    new MutationObserver(() => {
      if (overlay.classList.contains("open") && running.get(target.overlay)) {
        running.delete(target.overlay);
        updateDock();
      }
    }).observe(overlay, { attributes: true, attributeFilter: ["class"] });
  }

  TARGETS.forEach(addLights);
  buildDock();
  new MutationObserver(() => {
    TARGETS.forEach(t => {
      const bar = document.getElementById(t.overlay)?.querySelector(".wc-lights");
      if (!bar) return;
      const tt = TXT[lang()];
      bar.querySelector(".wc-title").textContent = tt.account;
      bar.querySelector(".wc-red").setAttribute("aria-label", tt.close);
      bar.querySelector(".wc-yellow").setAttribute("aria-label", tt.minimize);
      bar.querySelector(".wc-green").setAttribute("aria-label", tt.zoom);
    });
    applyLabels();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
