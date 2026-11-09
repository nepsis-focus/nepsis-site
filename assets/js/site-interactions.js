(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Spotlight is reserved for cards that invite interaction or exploration.
  var spotlightSelector = ".progress-card, #quiz, .stage, .info-card, .step-card, .research-panel, .note";
  document.querySelectorAll(spotlightSelector).forEach(function (el) {
    if (el.dataset.nepsisSpotlight === "true") return;
    el.dataset.nepsisSpotlight = "true";
    el.classList.add("motion-spotlight");
    var light = document.createElement("span");
    light.className = "nepsis-light";
    light.setAttribute("aria-hidden", "true");
    el.insertBefore(light, el.firstChild);
    if (finePointer) {
      el.addEventListener("pointermove", function (event) {
        var rect = el.getBoundingClientRect();
        el.style.setProperty("--nepsis-x", (event.clientX - rect.left) + "px");
        el.style.setProperty("--nepsis-y", (event.clientY - rect.top) + "px");
      });
    }
  });

  if (!reduce && window.Lenis && !document.body.classList.contains("home-page") && !document.body.classList.contains("practice-page")) {
    var lenis = new Lenis({ duration: 1.08, smoothWheel: true, anchors: { offset: 0, duration: 1.05 } });
    window.__nepsisLenis = lenis;
    if (window.gsap) {
      window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(0);
    }
  }

  if (!reduce && window.gsap) {
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    if (document.querySelector(".page-heading")) {
      gsap.from(".page-heading > *", {
        y: 34, opacity: 0, filter: "blur(4px)", duration: .9, stagger: .13,
        ease: "power3.out", clearProps: "transform,opacity,filter"
      });
      gsap.utils.toArray(".info-card, .step-card, .research-panel, .faq-list details, .cta").forEach(function (el) {
        gsap.from(el, {
          y: 46, opacity: 0, rotateX: -3, transformOrigin: "50% 0%",
          duration: .82, ease: "power3.out", clearProps: "transform,opacity",
          scrollTrigger: { trigger: el, start: "top 86%", once: true }
        });
      });
    }

    if (document.body.classList.contains("privacy-page")) {
      gsap.from(".wrap > h1, .wrap > .muted", {
        y: 28, opacity: 0, duration: .8, stagger: .12, ease: "power3.out",
        clearProps: "transform,opacity"
      });
      gsap.utils.toArray(".wrap > h2, .wrap > p:not(.muted), .wrap > ul, .wrap > .note").forEach(function (el) {
        gsap.from(el, {
          y: 28, opacity: 0, duration: .72, ease: "power2.out", clearProps: "transform,opacity",
          scrollTrigger: { trigger: el, start: "top 90%", once: true }
        });
      });
    }

    // A more characterful reveal for the focus stages: the cards unfold in sequence.
    if (document.querySelector(".stages .stage")) {
      gsap.from(".stages .stage", {
        y: 58, opacity: 0, rotateX: -11, transformOrigin: "50% 0%",
        duration: .95, stagger: .13, ease: "power4.out", clearProps: "transform,opacity",
        scrollTrigger: { trigger: ".stages", start: "top 82%", once: true }
      });
    }
  }
})();