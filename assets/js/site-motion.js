(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var extras = document.querySelectorAll(".cta, .daily-challenge, .knowledge-note, .faq-list details");
  extras.forEach(function (el) {
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
  if (!reduce && window.gsap && window.ScrollTrigger) {
    gsap.utils.toArray(".daily-challenge, .knowledge-note").forEach(function (el) {
      gsap.from(el, {
        y: 34, opacity: 0, scale: .985, duration: .82, ease: "power3.out",
        clearProps: "transform,opacity",
        scrollTrigger: { trigger: el, start: "top 86%", once: true }
      });
    });
  }
})();