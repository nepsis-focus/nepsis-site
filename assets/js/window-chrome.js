/* macOS-style account window: red closes, yellow tucks the panel into the site dock,
   green enlarges. The dock's account tile reopens the panel. */
(() => {
  const TARGETS = [
    { overlay: "accModal", card: ".acc-card", close: "accClose" },
    { overlay: "accountModal", card: ".account-card", close: "accountClose" }
  ];
  const TXT = {
    el: { close: "Κλείσιμο", minimize: "Ελαχιστοποίηση", zoom: "Μεγέθυνση", account: "Λογαριασμός" },
    en: { close: "Close", minimize: "Minimize", zoom: "Zoom", account: "Account" }
  };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "el");
  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const running = new Map();

  function openPanel(target) {
    const overlay = document.getElementById(target.overlay);
    if (!overlay) return;
    running.delete(target.overlay);
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.add("open");
    overlay.querySelector(target.card)?.focus?.({ preventScroll: true });
    window.NepsisDock?.setRunning("account", false);
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
      window.NepsisDock?.setRunning("account", true);
    };
    if (reduceMotion()) return finish();
    card.classList.add("wc-to-dock");
    window.setTimeout(finish, 340);
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
        window.NepsisDock?.setRunning("account", false);
      }
    }).observe(overlay, { attributes: true, attributeFilter: ["class"] });
  }

  document.addEventListener("nepsis:open-account", () => {
    const target = TARGETS.find(t => document.getElementById(t.overlay));
    if (!target) return;
    openPanel(target);
  });
  TARGETS.forEach(addLights);
})();
