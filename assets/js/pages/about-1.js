(function () {
  var currentLang = "el";
  var drawer = document.getElementById("drawer");
  var menuBtn = document.getElementById("menuBtn");
  var scrim = document.getElementById("scrim");
  function setMenu(open) {
    drawer.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    menuBtn.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  menuBtn.addEventListener("click", function () { setMenu(!drawer.classList.contains("open")); });
  document.getElementById("closeBtn").addEventListener("click", function () { setMenu(false); });
  scrim.addEventListener("click", function () { setMenu(false); });
  drawer.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });
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
    document.getElementById("menuBtn").setAttribute("aria-label", lang === "el" ? "Άνοιγμα μενού" : "Open menu");
    document.getElementById("closeBtn").setAttribute("aria-label", lang === "el" ? "Κλείσιμο" : "Close");
    drawer.setAttribute("aria-label", lang === "el" ? "Κύριο μενού" : "Main menu");
  }
  document.querySelectorAll(".lang button").forEach(function (button) {
    button.addEventListener("click", function () { setLang(button.dataset.lang); });
  });
  setLang("el");
})();