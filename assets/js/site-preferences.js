(() => {
  const LANG_KEY = "nepsis-lang";
  const THEME_KEY = "nepsis-theme";

  function currentLang() {
    try {
      if (localStorage.getItem(LANG_KEY) === "en") return "en";
    } catch (_) {}
    return document.documentElement.lang === "en" ? "en" : "el";
  }

  function forceLightTheme() {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", "#ffffff");
    });
    // Site is light-only: drop any legacy dark/system preference and remove toggles.
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored && stored !== "light") localStorage.setItem(THEME_KEY, "light");
    } catch (_) {}
    document.querySelectorAll(".theme-toggle").forEach((button) => button.remove());
  }

  // Language preference (existing behavior)
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        localStorage.setItem(LANG_KEY, button.dataset.lang);
      } catch (_) {}
    });
  });
  try {
    if (localStorage.getItem(LANG_KEY) === "en") {
      const english = document.querySelector('[data-lang="en"]');
      if (english && !english.classList.contains("active")) english.click();
    }
  } catch (_) {}

  forceLightTheme();

  window.NepsisTheme = {
    getPreference: () => "light",
    setPreference: () => {
      forceLightTheme();
      return "light";
    },
    resolve: () => "light",
    currentLang
  };
})();
