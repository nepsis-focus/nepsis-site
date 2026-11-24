(function () {
  var currentLang = "el";
  // Some pages (community rules, research) have no native menu. site-navigation.js
  // adds one afterwards, so every lookup here must tolerate a missing element.
  var drawer = document.getElementById("drawer");
  var menuBtn = document.getElementById("menuBtn");
  var scrim = document.getElementById("scrim");
  var closeBtn = document.getElementById("closeBtn");
  function setMenu(open) {
    if (!drawer) return;
    drawer.classList.toggle("open", open);
    if (scrim) scrim.classList.toggle("open", open);
    if (menuBtn) {
      menuBtn.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }
  if (menuBtn && drawer) menuBtn.addEventListener("click", function () { setMenu(!drawer.classList.contains("open")); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setMenu(false); });
  if (scrim) scrim.addEventListener("click", function () { setMenu(false); });
  if (drawer) {
    drawer.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setMenu(false); });
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });
  function setLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-el]").forEach(function (el) {
      el.textContent = el.dataset[lang] || el.dataset.el;
    });
    document.querySelectorAll(".lang button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.lang === lang);
    });
    if (menuBtn) menuBtn.setAttribute("aria-label", lang === "el" ? "Άνοιγμα μενού" : "Open menu");
    if (closeBtn) closeBtn.setAttribute("aria-label", lang === "el" ? "Κλείσιμο" : "Close");
    if (drawer) drawer.setAttribute("aria-label", lang === "el" ? "Κύριο μενού" : "Main menu");
  }
  document.querySelectorAll(".lang button").forEach(function (button) {
    button.addEventListener("click", function () { setLang(button.dataset.lang); });
  });
  try { setLang(localStorage.getItem("nepsis-lang") === "en" ? "en" : "el"); } catch (e) { setLang("el"); }
})();