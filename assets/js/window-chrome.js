/* macOS-style window controls for account panels.
   Red closes the panel, yellow tucks it into a dock at the bottom, green enlarges it.
   Works on top of the existing open/close code: it only toggles the .open class and
   reuses each page's own close button. */
(() => {
  const TARGETS = [
    { overlay: "accModal", card: ".acc-card", close: "accClose" },
    { overlay: "accountModal", card: ".account-card", close: "accountClose" }
  ];
  const LABEL = { el: "Λογαριασμός", en: "Account" };
  const TITLES = { el: { close: "Κλείσιμο", minimize: "Ελαχιστοποίηση", zoom: "Μεγέθυνση" }, en: { close: "Close", minimize: "Minimize", zoom: "Zoom" } };

  const lang = () => (document.documentElement.lang === "en" ? "en" : "el");
  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let dock = document.getElementById("wcDock");
  if (!dock) {
    dock = document.createElement("div");
    dock.id = "wcDock";
    dock.className = "wc-dock";
    dock.hidden = true;
    dock.setAttribute("role", "group");
    document.body.append(dock);
  }
  const tray = new Map(); // overlay id -> dock button

  function refreshDock() { dock.hidden = tray.size === 0; }

  function restore(target) {
    const overlay = document.getElementById(target.overlay);
    const item = tray.get(target.overlay);
    if (item) { item.remove(); tray.delete(target.overlay); }
    refreshDock();
    if (!overlay) return;
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.add("open");
    overlay.querySelector(target.card)?.focus?.({ preventScroll: true });
  }

  function minimize(target) {
    const overlay = document.getElementById(target.overlay);
    const card = overlay?.querySelector(target.card);
    if (!overlay || !card) return;
    const finish = () => {
      card.classList.remove("wc-to-dock");
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      const label = lang() === "el" ? LABEL.el : LABEL.en;
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = label;
      item.setAttribute("aria-label", (lang() === "el" ? "Άνοιγμα: " : "Open: ") + label);
      item.addEventListener("click", () => restore(target));
      tray.set(target.overlay, item);
      dock.append(item);
      refreshDock();
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
    const t = TITLES[lang()];
    const bar = document.createElement("div");
    bar.className = "wc-lights";
    bar.innerHTML =
      '<button type="button" class="wc-red" aria-label="' + t.close + '" title="' + t.close + '"></button>' +
      '<button type="button" class="wc-yellow" aria-label="' + t.minimize + '" title="' + t.minimize + '"></button>' +
      '<button type="button" class="wc-green" aria-label="' + t.zoom + '" title="' + t.zoom + '" aria-pressed="false"></button>';
    bar.querySelector(".wc-red").addEventListener("click", () => document.getElementById(target.close)?.click());
    bar.querySelector(".wc-yellow").addEventListener("click", () => minimize(target));
    const zoom = bar.querySelector(".wc-green");
    zoom.addEventListener("click", () => {
      const on = card.classList.toggle("wc-zoomed");
      zoom.setAttribute("aria-pressed", String(on));
    });
    // Sit after the page's own close button, so that button keeps its existing styling.
    const own = document.getElementById(target.close);
    if (own && own.parentElement === card) own.after(bar);
    else card.prepend(bar);

    // Opening the panel from anywhere (menu, sign-in button) takes it out of the dock.
    new MutationObserver(() => {
      if (overlay.classList.contains("open") && tray.has(target.overlay)) {
        tray.get(target.overlay).remove();
        tray.delete(target.overlay);
        refreshDock();
      }
    }).observe(overlay, { attributes: true, attributeFilter: ["class"] });
  }

  TARGETS.forEach(addLights);
})();
