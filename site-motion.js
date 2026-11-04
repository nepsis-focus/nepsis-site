(function () {
  "use strict";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // A consistent, warm pointer light across content cards.
  var glowTargets = Array.prototype.slice.call(document.querySelectorAll(
    ".card, .stage, .info-card, .research-panel, .cta, .daily-challenge, .knowledge-note, .tool-panel, .tool-aside"
  ));
  glowTargets.forEach(function (el) {
    el.classList.add("nepsis-glow");
    if (!finePointer) return;
    el.addEventListener("pointermove", function (event) {
      var rect = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", (event.clientX - rect.left) + "px");
      el.style.setProperty("--spot-y", (event.clientY - rect.top) + "px");
      el.style.setProperty("--spot-alpha", "1");
    });
    el.addEventListener("pointerleave", function () {
      el.style.setProperty("--spot-alpha", "0");
    });
  });

  // Recreate the Folder opening motion only for internal page-navigation cards.
  var navLinks = document.querySelectorAll(".home-link, .cta .btn");
  navLinks.forEach(function (link) {
    var rawHref = link.getAttribute("href") || "";
    if (!rawHref || rawHref.charAt(0) === "#" || link.target === "_blank") return;
    var destination;
    try { destination = new URL(rawHref, window.location.href); } catch (e) { return; }
    if (destination.origin !== window.location.origin || !/\.html(?:$|#)/i.test(destination.pathname + destination.hash)) return;
    var lid = document.createElement("span");
    lid.className = "nepsis-folder-lid";
    lid.setAttribute("aria-hidden", "true");
    link.appendChild(lid);
    link.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (reduceMotion || !window.gsap || link.classList.contains("nepsis-folder-opening")) return;
      event.preventDefault();
      link.classList.add("nepsis-folder-opening");
      window.gsap.timeline({
        onComplete: function () { window.location.assign(destination.href); }
      }).set(lid, { autoAlpha: 1, rotateX: 0, transformOrigin: "50% 0%" })
        .to(lid, { rotateX: -68, duration: .42, ease: "power3.inOut" })
        .to(link, { y: -3, duration: .2, ease: "power2.out" }, 0);
    });
  });

  // Keep the same smooth-scroll and reveal language on the information pages.
  var isCorePage = document.body.classList.contains("home-page") || document.body.classList.contains("practice-page");
  if (!isCorePage && !reduceMotion && window.Lenis) {
    var lenis = new window.Lenis({ duration: 1.05, smoothWheel: true });
    if (window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      lenis.on("scroll", window.ScrollTrigger.update);
      window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time) { lenis.raf(time); window.requestAnimationFrame(raf); })(0);
    }
  }
  if (!reduceMotion && window.gsap && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    var revealTargets = document.querySelectorAll(
      ".page-heading > *, .info-card, .research-panel, .cta, main .wrap > h1, main .wrap > h2, main .wrap > p, main .wrap > ul"
    );
    window.gsap.utils.toArray(revealTargets).forEach(function (el) {
      window.gsap.from(el, {
        y: 20,
        opacity: 0,
        duration: .68,
        ease: "power3.out",
        clearProps: "transform,opacity",
        scrollTrigger: { trigger: el, start: "top 90%", once: true }
      });
    });
  }
})();