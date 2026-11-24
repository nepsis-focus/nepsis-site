/* Custom focus session UI and break flow. Depends on practice-1.js and coach-core.js. */
(function (window, document) {
  "use strict";
  const core = window.NepsisCoachCore;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const customMode = params.get("custom") === "1";
  const el = (elText, enText) => document.documentElement.lang === "en" ? enText : elText;
  function initBuilder() {
    if (customMode && $("customStage")) $("customStage").hidden = true;
    const minutes = $("customMinutes"), patternButtons = Array.from(document.querySelectorAll("[data-custom-pattern]"));
    const preview = $("customPlanPreview"), start = $("customStart");
    if (!minutes || !preview || !start) return;
    let block = 25, rest = 5;
    document.querySelectorAll(".lang button").forEach(button => button.addEventListener("click", render));
    function render() {
      const total = Math.max(5, Math.min(180, Number(minutes.value) || 40));
      const blocks = core.buildBlocks(total, block, rest);
      const summary = blocks.map((item, i) => el(item.focusMinutes + "′ εστίαση", item.focusMinutes + " min focus") +
        (item.breakAfterMinutes ? " → " + el(item.breakAfterMinutes + "′ διάλειμμα", item.breakAfterMinutes + " min break") : "")).join(" · ");
      preview.textContent = summary;
      start.disabled = !Number.isInteger(Number(minutes.value)) || Number(minutes.value) < 5 || Number(minutes.value) > 180;
    }
    minutes.addEventListener("input", render);
    patternButtons.forEach(button => button.addEventListener("click", () => {
      block = Number(button.dataset.customPattern) === 50 ? 50 : 25;
      rest = block === 50 ? 10 : 5;
      patternButtons.forEach(item => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      render();
    }));
    start.addEventListener("click", () => {
      const total = Number(minutes.value);
      if (!Number.isInteger(total) || total < 5 || total > 180) return;
      const first = Math.min(block, total);
      const next = new URL("practice.html", window.location.href);
      next.searchParams.set("custom", "1");
      next.searchParams.set("coachStart", String(first));
      next.searchParams.set("customTotal", String(total));
      next.searchParams.set("customBlock", String(block));
      next.searchParams.set("customBreak", String(rest));
      next.searchParams.set("customRemaining", String(total));
      next.hash = "stage-" + first;
      window.location.href = next.href;
    });
    render();
  }
  function initRunningSession() {
    if (!customMode) return;
    if (params.get("customCompleted") === "1") { showReflection(Number(params.get("customTotal")) || 40); return; }
    const breakUntil = Number(params.get("customBreakUntil"));
    if (Number.isFinite(breakUntil) && breakUntil > 0) {
      const remainingFocus = Number(params.get("customRemaining"));
      const totalFocus = Number(params.get("customTotal"));
      const blockFocus = Number(params.get("customBlock"));
      const breakMinutes = Number(params.get("customBreak"));
      if ([remainingFocus,totalFocus,blockFocus,breakMinutes].every(Number.isInteger)) showBreak(remainingFocus,totalFocus,blockFocus,breakMinutes,breakUntil);
      return;
    }
    const current = Number(params.get("coachStart"));
    const total = Number(params.get("customTotal"));
    const remaining = Number(params.get("customRemaining"));
    const block = Number(params.get("customBlock"));
    const rest = Number(params.get("customBreak"));
    if (![current, total, remaining, block, rest].every(Number.isInteger) || current < 5 || total < 5 || total > 180 || remaining < 0 || remaining > total || !((block === 25 && rest === 5) || (block === 50 && rest === 10))) return;
    let handled = false;
    window.addEventListener("nepsis:session-completed", function (event) {
      if (handled || !event.detail || event.detail.stage !== "custom") return;
      handled = true;
      const after = Math.max(0, remaining - current);
      if (after > 0) showBreak(after, total, block, rest);
      else showReflection(total);
    });
  }
  function overlay(title, copy, actionHref, actionText, countdownSeconds) {
    let panel = $("customSessionOverlay");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "customSessionOverlay";
      panel.className = "custom-session-overlay";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-live", "polite");
      document.body.appendChild(panel);
    }
    panel.innerHTML = "";
    const card = document.createElement("div"); card.className = "custom-session-card";
    const kicker = document.createElement("span"); kicker.className = "eyebrow"; kicker.textContent = "NEPSIS · " + el("ΤΟ ΔΙΚΟ ΜΟΥ", "MY SESSION");
    const heading = document.createElement("h2"); heading.textContent = title;
    const text = document.createElement("p"); text.textContent = copy;
    card.append(kicker, heading, text);
    if (countdownSeconds !== null) {
      const count = document.createElement("strong"); count.className = "custom-break-count"; count.textContent = formatTime(countdownSeconds); card.appendChild(count);
      const tick = window.setInterval(() => {
        countdownSeconds -= 1; count.textContent = formatTime(Math.max(0, countdownSeconds));
        if (countdownSeconds <= 0) { window.clearInterval(tick); window.location.href = actionHref; }
      }, 1000);
    } else {
      const link = document.createElement("a"); link.className = "btn btn-primary"; link.href = actionHref; link.textContent = actionText; card.appendChild(link);
    }
    if (countdownSeconds !== null) {
      const link = document.createElement("a"); link.className = "btn btn-ghost"; link.href = actionHref; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = actionText; card.appendChild(link);
    }
    panel.appendChild(card);
    panel.hidden = false;
  }
  function formatTime(seconds) { return String(Math.floor(seconds / 60)).padStart(2,"0") + ":" + String(seconds % 60).padStart(2,"0"); }
  function showBreak(remaining, total, block, rest, savedUntil) {
    const nextFocus = Math.min(block, remaining);
    const next = new URL("practice.html", window.location.href);
    next.searchParams.set("custom","1"); next.searchParams.set("coachStart",String(nextFocus));
    next.searchParams.set("customTotal",String(total)); next.searchParams.set("customBlock",String(block));
    next.searchParams.set("customBreak",String(rest)); next.searchParams.set("customRemaining",String(remaining));
    next.hash = "stage-" + nextFocus;
    const reset = new URL("reset.html", window.location.href);
    reset.searchParams.set("customBreak",String(rest)); reset.searchParams.set("customNext",next.href); reset.searchParams.set("customBreakUntil",String(savedUntil || (Date.now() + rest * 60 * 1000)));
    const until = savedUntil || (Date.now() + rest * 60 * 1000);
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("customBreakUntil",String(until));
    try { history.replaceState({}, "", currentUrl.href); } catch (e) {}
    const secondsLeft = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    overlay(el("Ώρα για μικρή παύση","Time for a short break"),
      el("Ολοκλήρωσες ένα μπλοκ. Κάνε το διάλειμμά σου και μετά συνέχισε με το επόμενο μέρος.","You finished a focus block. Take your break, then continue with the next part."),
      next.href, el("Άνοιξε την επαναφορά","Open reset"), secondsLeft);
    const link = $("customSessionOverlay").querySelector("a.btn-ghost");
    if (link) link.href = reset.href;
  }
  function showReflection(total) {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("customCompleted","1");
    try { history.replaceState({}, "", currentUrl.href); } catch (e) {}
    const url = new URL("coach.html", window.location.href);
    url.searchParams.set("reflect","1"); url.searchParams.set("minutes",String(total));
    overlay(el("Η συνεδρία ολοκληρώθηκε","Session complete"),
      el("Πάρε μια στιγμή να σκεφτείς πώς πήγε.","Take a moment to reflect on how it went."),
      url.href, el("Απάντησε στον AI Coach","Reflect with AI Coach"), null);
  }
  initBuilder();
  initRunningSession();
})(window, document);
