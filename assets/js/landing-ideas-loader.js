/* Load homepage enhancements after the shared navigation script is ready. */
(function () {
  if (!document.body.classList.contains("home-page")) return;
  var source = document.currentScript;
  if (!source) return;
  var landing = document.createElement("script");
  landing.src = new URL("landing-ideas.js", source.src).href;
  landing.defer = true;
  landing.onload = function () {
    var conversion = document.createElement("script");
    conversion.src = new URL("landing-conversion.js", source.src).href;
    conversion.defer = true;
    document.body.appendChild(conversion);
  };
  document.body.appendChild(landing);
})();
