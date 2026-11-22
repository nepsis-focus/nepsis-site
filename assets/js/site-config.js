/* Nepsis public site hosts.
   Primary (canonical / share / SEO / Watchdog): GitHub Pages.
   Mirror (Cloudflare Workers preview/deploy): same content, canonical still points at primary. */
(function (global) {
  "use strict";
  var PUBLIC_HOST = "nepsis-focus.github.io";
  var PUBLIC_ORIGIN = "https://nepsis-focus.github.io";
  var PUBLIC_BASE = "https://nepsis-focus.github.io/nepsis-site/";
  var MIRROR_HOSTS = ["nepsis-site.nepsis-corp.workers.dev"];

  function hostOf(value) {
    return String(value || "").toLowerCase();
  }

  function isProductionHost(hostname) {
    var host = hostOf(hostname || (global.location && global.location.hostname));
    if (host === PUBLIC_HOST) return true;
    return MIRROR_HOSTS.indexOf(host) !== -1;
  }

  global.NepsisSite = {
    PUBLIC_HOST: PUBLIC_HOST,
    PUBLIC_ORIGIN: PUBLIC_ORIGIN,
    PUBLIC_BASE: PUBLIC_BASE,
    MIRROR_HOSTS: MIRROR_HOSTS.slice(),
    isProductionHost: isProductionHost
  };
})(typeof window !== "undefined" ? window : globalThis);
