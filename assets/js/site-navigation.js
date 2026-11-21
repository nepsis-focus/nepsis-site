/* Shared menu polish for every page: back-to-home arrow and a cleaner menu.
   Loaded from here because this script is already on every page. */
(() => {
  const me = document.currentScript;
  if (!me || document.getElementById("nepsisNavPolish")) return;
  const css = document.createElement("link");
  css.id = "nepsisNavPolish";
  css.rel = "stylesheet";
  css.href = new URL("../css/nav-polish.css", me.src).href;
  document.head.append(css);
  const js = document.createElement("script");
  js.src = new URL("nav-polish.js", me.src).href;
  document.body.append(js);
})();

(() => {
  const links = [
    ["index.html", "Αρχική", "Home"], ["practice.html", "Εξάσκηση", "Practice"],
    ["my-nepsis.html", "Το Nepsis μου", "My Nepsis"], ["diary.html", "Ημερολόγιο", "Diary"],
    ["library.html", "Βιβλιοθήκη", "Library"], ["reset.html", "Μικρή παύση", "Reset"],
    ["about.html", "Σχετικά", "About"], ["how.html", "Πώς λειτουργεί", "How it works"],
    ["faq.html", "Συχνές ερωτήσεις", "FAQ"], ["privacy.html", "Απόρρητο", "Privacy"],
    ["terms.html", "Όροι χρήσης", "Terms"]
  ];
  let drawer = document.getElementById("drawer");
  let button = document.getElementById("menuBtn");

  // Pages with their own complete navigation keep it unchanged.
  // This shared fallback is only for pages that do not already have a menu.
  if (drawer && button) return;

  if (!drawer) {
    const host = document.querySelector(".top-actions, .controls, .headright, header") || document.body;
    button = document.createElement("button");
    button.type = "button";
    button.id = "menuBtn";
    button.className = "nepsis-menu-button";
    button.setAttribute("aria-label", "Open menu");
    button.setAttribute("aria-expanded", "false");
    button.textContent = "☰";
    host.append(button);
    drawer = document.createElement("nav");
    drawer.id = "drawer";
    drawer.className = "nepsis-site-drawer";
    drawer.setAttribute("aria-label", "Site navigation");
    drawer.setAttribute("aria-hidden", "true");
    document.body.append(drawer);
  }
  if (drawer) {
    for (const [href, el, en] of links) {
      if (drawer.querySelector(`a[href="${href}"]`)) continue;
      const a = document.createElement("a");
      a.href = href;
      a.dataset.el = el;
      a.dataset.en = en;
      a.textContent = document.documentElement.lang === "en" ? en : el;
      drawer.append(a);
    }
  }
  if (!button || !drawer) return;
  drawer.inert = true;
  let scrim = document.getElementById("scrim");
  if (!scrim) {
    scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "nepsis-menu-scrim";
    scrim.setAttribute("aria-label", "Close menu");
    document.body.append(scrim);
  }
  const setOpen = open => {
    drawer.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    drawer.inert = !open;
    button.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    if (open) drawer.querySelector("a")?.focus(); else button.focus();
  };
  button.addEventListener("click", () => setOpen(!drawer.classList.contains("open")));
  scrim.addEventListener("click", () => setOpen(false));
  drawer.addEventListener("click", event => { if (event.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && drawer.classList.contains("open")) setOpen(false); });
})();

/* Load the opt-in homepage demo and landing sections after the existing site scripts. */
(function () {
  if (!document.body.classList.contains("home-page")) return;
  var source = document.currentScript;
  var loader = document.createElement("script");
  loader.src = new URL("landing-ideas-loader.js", source.src).href;
  loader.defer = true;
  document.body.appendChild(loader);

  // The Apple-inspired product story is isolated to the homepage; core app
  // pages, navigation behavior, and existing integrations are unchanged.
  var productStyles = document.createElement("link");
  productStyles.rel = "stylesheet";
  productStyles.href = new URL("../css/pages/home-product.css", source.src).href;
  document.head.appendChild(productStyles);
  var productScript = document.createElement("script");
  productScript.src = new URL("home-product.js", source.src).href;
  document.body.appendChild(productScript);
})();
