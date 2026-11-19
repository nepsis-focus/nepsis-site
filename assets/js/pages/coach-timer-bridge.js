/* Safe one-click handoff: calls the existing rendered stage's Start button. */
(function (window, document) {
  "use strict";
  var flags = window.NepsisFeatureFlags || {};
  var nav = document.querySelector("[data-coach-nav]");
  if (nav && flags.aiCoach === true) nav.hidden = false;
  if (flags.aiCoach !== true) return;

  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
  var value = params.get("coachStart");
  var minutes = Number(value);
  if (!value || !Number.isInteger(minutes) || minutes < 5 || minutes > 180) return;

  // Remove the one-shot command before starting so a refresh never starts another timer.
  params.delete("coachStart");
  var query = params.toString();
  var cleanUrl = window.location.pathname + (query ? "?" + query : "") + window.location.hash;
  window.history.replaceState(null, "", cleanUrl);

  var deadline = Date.now() + 6000;
  function startStage() {
    var card = document.getElementById("stage-" + minutes);
    var start = card && card.querySelector("[data-start]");
    if (start && !start.disabled) {
      if (card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "center" });
      if (card.classList.contains("is-running")) { start.focus({ preventScroll: true }); return; }
      start.click();
      return;
    }
    if (Date.now() < deadline) window.setTimeout(startStage, 100);
  }
  if (document.readyState === "complete") window.requestAnimationFrame(startStage);
  else window.addEventListener("load", function () { window.requestAnimationFrame(startStage); }, { once: true });
})(window, document);
