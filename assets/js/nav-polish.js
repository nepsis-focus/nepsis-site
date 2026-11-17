/* Nepsis menu polish, shared by every page (loaded from site-navigation.js).
   - Adds a "back to home" arrow next to the logo on every page except the homepage.
   - Marks the page you are on inside the menu and opens its group.
   - Gives the menu a header row (logo + close) and lets one group open at a time. */
(function () {
  var me = document.currentScript;
  var root = new URL("../../", (me && me.src) || location.href);
  var homeUrl = new URL("index.html", root);

  function clean(path) { return path.replace(/index\.html$/, "").replace(/\/+$/, "/"); }
  var here = clean(location.pathname);
  var isHome = here === clean(root.pathname);
  function lang() {
    try { if (localStorage.getItem("nepsis-lang") === "en") return "en"; } catch (e) {}
    return document.documentElement.lang === "en" ? "en" : "el";
  }

  /* 1. Back-to-home arrow */
  var logo = document.querySelector("header .logo");
  if (!isHome && logo && !document.querySelector(".nav-home-back")) {
    var back = document.createElement("a");
    back.className = "nav-home-back";
    back.href = homeUrl.href;
    back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var label = document.createElement("span");
    label.className = "nav-home-back-label";
    label.dataset.el = "Αρχική";
    label.dataset.en = "Home";
    label.textContent = lang() === "en" ? "Home" : "Αρχική";
    back.appendChild(label);
    var left = document.createElement("div");
    left.className = "nav-left";
    logo.parentNode.insertBefore(left, logo);
    left.appendChild(back);
    left.appendChild(logo);
  }

  /* 2. Menu: header row, current page, one open group at a time */
  var drawer = document.getElementById("drawer");
  if (!drawer) return;

  var close = drawer.querySelector(".close");
  if (close && !drawer.querySelector(".nav-drawer-head")) {
    var head = document.createElement("div");
    head.className = "nav-drawer-head";
    var brand = document.createElement("a");
    brand.className = "nav-drawer-brand";
    brand.href = homeUrl.href;
    brand.innerHTML = '<span class="dot" aria-hidden="true"></span>Nepsis';
    drawer.insertBefore(head, close);
    head.appendChild(brand);
    head.appendChild(close);
  }

  /* Only an exact match counts as the current page: a link to a section of
     another page (practice.html#quiz) is not "where you are". */
  var links = drawer.querySelectorAll("a[href]");
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    if (a.classList.contains("nav-drawer-brand")) continue;
    var url;
    try { url = new URL(a.getAttribute("href"), location.href); } catch (e) { continue; }
    var hash = url.hash === "#top" ? "" : url.hash;
    if (url.origin !== location.origin || clean(url.pathname) !== here || hash !== location.hash) continue;
    a.setAttribute("aria-current", "page");
    var group = a.closest("details");
    if (group) group.open = true;
    break;
  }

  var groups = drawer.querySelectorAll("details.menu-group");
  for (var g = 0; g < groups.length; g++) {
    groups[g].addEventListener("toggle", function (event) {
      if (!event.target.open) return;
      for (var k = 0; k < groups.length; k++) if (groups[k] !== event.target) groups[k].open = false;
    });
  }
})();
