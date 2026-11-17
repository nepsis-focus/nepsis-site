/* Landing-page enhancements are isolated and only run on the homepage. */
(function () {
  if (!document.body.classList.contains("home-page")) return;
  var source = document.currentScript;
  var landing = document.createElement("script");
  landing.src = new URL("landing-ideas.js", source.src).href;
  landing.defer = true;
  document.body.appendChild(landing);
})();
