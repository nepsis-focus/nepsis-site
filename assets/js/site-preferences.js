(() => {
  const key = "nepsis-lang";
  document.querySelectorAll("[data-lang]").forEach(button => {
    button.addEventListener("click", () => {
      try { localStorage.setItem(key, button.dataset.lang); } catch (_) {}
    });
  });
  try {
    if (localStorage.getItem(key) === "en") {
      const english = document.querySelector('[data-lang="en"]');
      if (english && !english.classList.contains("active")) english.click();
    }
  } catch (_) {}
})();
