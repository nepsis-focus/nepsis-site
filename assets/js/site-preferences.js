(() => {
  const LANG_KEY = "nepsis-lang";
  const THEME_KEY = "nepsis-theme";
  const THEME_MODES = ["system", "light", "dark"];

  const labels = {
    el: {
      system: "Θέμα: αυτόματο (συσκευή)",
      light: "Θέμα: φωτεινό",
      dark: "Θέμα: ζεστό σκοτεινό"
    },
    en: {
      system: "Theme: automatic (device)",
      light: "Theme: light",
      dark: "Theme: warm dark"
    }
  };

  function currentLang() {
    try {
      if (localStorage.getItem(LANG_KEY) === "en") return "en";
    } catch (_) {}
    return document.documentElement.lang === "en" ? "en" : "el";
  }

  function readPreference() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      if (THEME_MODES.includes(value)) return value;
    } catch (_) {}
    return "system";
  }

  function systemPrefersDark() {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (_) {
      return false;
    }
  }

  function resolveTheme(preference) {
    if (preference === "dark") return "dark";
    if (preference === "light") return "light";
    return systemPrefersDark() ? "dark" : "light";
  }

  function themeColorFor(resolved) {
    return resolved === "dark" ? "#1A1512" : "#F0702A";
  }

  function applyTheme(preference) {
    const resolved = resolveTheme(preference);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", themeColorFor(resolved));
    });
    document.querySelectorAll(".theme-toggle").forEach((button) => {
      button.dataset.mode = preference;
      const copy = labels[currentLang()][preference];
      button.setAttribute("aria-label", copy);
      button.setAttribute("title", copy);
    });
    return resolved;
  }

  function savePreference(preference) {
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch (_) {}
    return applyTheme(preference);
  }

  function nextMode(current) {
    const index = THEME_MODES.indexOf(current);
    return THEME_MODES[(index + 1) % THEME_MODES.length];
  }

  function iconMarkup() {
    return [
      '<svg class="icon-system" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7.2"/><path d="M12 4.8v14.4"/><path d="M12 4.8a7.2 7.2 0 0 1 0 14.4" fill="currentColor" opacity=".22"/></svg>',
      '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/></svg>',
      '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.4 13.8A6.4 6.4 0 0 1 10.2 7.6 5.6 5.6 0 1 0 16.4 13.8z"/></svg>'
    ].join("");
  }

  function ensureToggle() {
    if (document.querySelector(".theme-toggle")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.innerHTML = iconMarkup();
    button.addEventListener("click", () => {
      savePreference(nextMode(readPreference()));
    });

    const lang = document.querySelector(".lang");
    if (lang && lang.parentElement) {
      lang.insertAdjacentElement("afterend", button);
      return;
    }

    const langButtons = document.querySelectorAll("[data-lang]");
    if (langButtons.length) {
      langButtons[langButtons.length - 1].insertAdjacentElement("afterend", button);
      return;
    }

    const host =
      document.querySelector(".head-right, .headright, .controls, .top-actions, header .wrap, header") ||
      null;
    if (host) host.appendChild(button);
  }

  // Language preference (existing behavior)
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        localStorage.setItem(LANG_KEY, button.dataset.lang);
      } catch (_) {}
      applyTheme(readPreference());
    });
  });
  try {
    if (localStorage.getItem(LANG_KEY) === "en") {
      const english = document.querySelector('[data-lang="en"]');
      if (english && !english.classList.contains("active")) english.click();
    }
  } catch (_) {}

  // Theme preference
  ensureToggle();
  applyTheme(readPreference());

  try {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPreference() === "system") applyTheme("system");
    };
    if (typeof media.addEventListener === "function") media.addEventListener("change", onChange);
    else if (typeof media.addListener === "function") media.addListener(onChange);
  } catch (_) {}

  window.NepsisTheme = {
    getPreference: readPreference,
    setPreference: savePreference,
    resolve: () => resolveTheme(readPreference())
  };
})();
