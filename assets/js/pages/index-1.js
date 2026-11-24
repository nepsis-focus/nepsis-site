(() => {
  "use strict";
  const root = document.documentElement;
  const drawer = document.getElementById("drawer");
  const menu = document.getElementById("menuBtn");
  const close = document.getElementById("closeBtn");
  const scrim = document.getElementById("scrim");
  const LANG_KEY = "nepsis-lang";
  const PROGRESS_KEY = "nepsis-progress:guest";
  const circumference = 2 * Math.PI * 108;
  let currentLang = root.lang === "en" ? "en" : "el";

  function setMenu(open) {
    drawer.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    menu.setAttribute("aria-expanded", String(open));
    drawer.setAttribute("aria-hidden", String(!open));
    if (open) (close || drawer.querySelector("a"))?.focus();
  }
  menu?.addEventListener("click", () => setMenu(!drawer.classList.contains("open")));
  close?.addEventListener("click", () => setMenu(false));
  scrim?.addEventListener("click", () => setMenu(false));
  drawer?.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") setMenu(false); });

  function applyLanguage(lang) {
    currentLang = lang === "en" ? "en" : "el";
    root.lang = currentLang;
    try { localStorage.setItem(LANG_KEY, currentLang); } catch (error) {}
    document.querySelectorAll("[data-el]").forEach((node) => {
      const value = node.dataset[currentLang] || node.dataset.el;
      if (node.tagName === "H1" || node.tagName === "H2" || node.tagName === "H3" || node.tagName === "P") node.innerHTML = value;
      else node.textContent = value;
    });
    document.querySelectorAll("[data-lang]").forEach((button) => button.classList.toggle("active", button.dataset.lang === currentLang));
    updateProgress();
  }
  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => applyLanguage(button.dataset.lang)));

  function dateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }
  function readProgress() {
    const records = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || "";
        if (key === PROGRESS_KEY || key.startsWith(`${PROGRESS_KEY}:user:`)) {
          const parsed = JSON.parse(localStorage.getItem(key) || "null");
          if (parsed && parsed.days) records.push(parsed);
        }
      }
    } catch (error) {}
    return records;
  }
  function todayMinutes() {
    const today = dateKey(new Date());
    return readProgress().reduce((largest, record) => {
      const minutes = Array.isArray(record.days?.[today]) ? record.days[today].reduce((sum, value) => sum + (Number(value) || 0), 0) : 0;
      return Math.max(largest, minutes);
    }, 0);
  }
  function updateProgress() {
    const minutes = todayMinutes();
    const ring = document.getElementById("todayRing");
    const today = document.getElementById("todayMinutes");
    const summary = document.getElementById("progressMinutes");
    const copy = document.getElementById("progressCopy");
    const progress = Math.min(minutes / 60, 1);
    if (today) today.textContent = String(minutes);
    if (summary) summary.textContent = String(minutes);
    if (ring) ring.style.strokeDashoffset = String(circumference * (1 - progress));
    if (copy) copy.innerHTML = currentLang === "el" ? (minutes ? "Σήμερα επέστρεψες στη συγκέντρωση." : "Κάθε μικρή προσπάθεια μετράει.") : (minutes ? "You returned to focus today." : "Every small effort counts.");
    const orbit = document.querySelector(".focus-orbit");
    if (orbit) orbit.setAttribute("aria-label", (orbit.dataset[`aria${currentLang === "el" ? "El" : "En"}`] || "").replace("{minutes}", minutes));
    if (minutes === 0 && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) orbit?.classList.add("is-idle");
  }
  window.addEventListener("storage", updateProgress);
  window.addEventListener("focus", updateProgress);
  updateProgress();

  const mobileCta = document.getElementById("mobileCta");
  const hero = document.querySelector(".hero");
  if (mobileCta && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => mobileCta.classList.toggle("is-visible", !entry.isIntersecting), { threshold: 0.05 }).observe(hero);
  }
  try { applyLanguage(localStorage.getItem(LANG_KEY) === "en" ? "en" : "el"); } catch (error) { applyLanguage("el"); }
})();
