(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Magic UI-inspired Bento layout, adapted to Nepsis' existing homepage links.
  // CSS-only, scoped to this page, and does not replace or reorder navigation.
  var homeLinks = document.querySelector(".home-discovery .home-links");
  if (homeLinks && !document.getElementById("nepsis-home-bento-styles")) {
    homeLinks.classList.add("nepsis-bento");
    var bentoStyles = document.createElement("style");
    bentoStyles.id = "nepsis-home-bento-styles";
    bentoStyles.textContent = `
      body.home-page .home-discovery .home-links.nepsis-bento {
        display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); grid-auto-rows:minmax(164px,auto); gap:16px; border:0;
      }
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link {
        grid-column:span 3; min-width:0; min-height:168px; padding:23px 24px 40px;
        border:1px solid color-mix(in srgb,var(--border) 84%,var(--orange)); border-radius:22px;
        background:linear-gradient(145deg,var(--card),rgba(255,255,255,.55));
        box-shadow:0 1px 0 rgba(255,255,255,.78) inset,0 16px 34px -28px rgba(89,52,31,.45);
        transition:transform .32s cubic-bezier(.2,.8,.2,1),border-color .32s ease,box-shadow .32s ease;
      }
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1) {
        grid-column:span 7; min-height:300px; padding:30px 32px 48px;
        background:radial-gradient(80% 130% at 100% 0%,rgba(247,209,90,.22),transparent 68%),linear-gradient(135deg,var(--card),#fff8ed);
      }
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(2) {
        grid-column:span 5; min-height:300px;
        background:radial-gradient(80% 130% at 100% 0%,rgba(87,153,193,.12),transparent 70%),linear-gradient(145deg,var(--card),#fffaf4);
      }
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(n+3){grid-column:span 3}
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link::before {
        content:""; position:absolute; width:150px; height:150px; right:-74px; top:-84px;
        border:1px solid rgba(185,85,42,.12); border-radius:50%;
        box-shadow:0 0 0 16px rgba(185,85,42,.035),0 0 0 34px rgba(185,85,42,.025);
        pointer-events:none; transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .3s ease;
      }
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link:hover {
        transform:translateY(-4px); border-color:color-mix(in srgb,var(--orange) 44%,var(--border));
        box-shadow:0 1px 0 rgba(255,255,255,.86) inset,0 24px 42px -28px rgba(89,52,31,.48),0 0 0 1px rgba(185,85,42,.08);
      }
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link:hover::before{transform:scale(1.12) translate(-5px,5px)}
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link>*{position:relative;z-index:1}
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link strong{max-width:18ch;font-size:clamp(1.18rem,1.8vw,1.45rem);line-height:1.2}
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1) strong {
        max-width:13ch; font-family:Literata,Georgia,serif; font-size:clamp(1.7rem,3vw,2.45rem); font-weight:500; letter-spacing:-.035em;
      }
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link>span:nth-of-type(2){max-width:32ch;line-height:1.65}
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1)>span:nth-of-type(2){max-width:36ch}
      body.home-page .home-discovery .home-links.nepsis-bento>.home-link .home-link-arrow{right:23px;bottom:20px}
      html[data-theme="dark"] body.home-page .home-discovery .home-links.nepsis-bento>.home-link {
        background:linear-gradient(145deg,var(--card),var(--theme-surface));border-color:var(--border);
        box-shadow:0 1px 0 rgba(255,255,255,.035) inset,0 18px 38px -30px rgba(0,0,0,.7);
      }
      html[data-theme="dark"] body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1){
        background:radial-gradient(80% 130% at 100% 0%,rgba(232,197,106,.1),transparent 68%),linear-gradient(135deg,var(--card),#2e241d)
      }
      html[data-theme="dark"] body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(2){
        background:radial-gradient(80% 130% at 100% 0%,rgba(87,153,193,.1),transparent 70%),linear-gradient(145deg,var(--card),#2a211b)
      }
      @media(max-width:900px){
        body.home-page .home-discovery .home-links.nepsis-bento{gap:13px}
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link,
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1),
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(2){grid-column:span 6;min-height:190px;padding:23px 22px 40px}
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1) strong{font-size:clamp(1.5rem,3vw,2rem)}
      }
      @media(max-width:600px){
        body.home-page .home-discovery .home-links.nepsis-bento{grid-template-columns:minmax(0,1fr);grid-auto-rows:auto;gap:11px}
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link,
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1),
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(2){grid-column:1;min-height:150px;padding:21px 22px 39px}
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1){min-height:205px}
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:nth-child(1) strong{font-size:1.85rem}
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:hover{transform:none}
      }
      @media(prefers-reduced-motion:reduce){
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link,
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link::before{transition:none!important}
        body.home-page .home-discovery .home-links.nepsis-bento>.home-link:hover{transform:none}
      }
    `;
    document.head.appendChild(bentoStyles);
  }

  // Add a calm, warm depth treatment to the practice room without changing timer logic.
  if (document.body.classList.contains("practice-page") && !document.getElementById("nepsis-practice-motion-styles")) {
    var practiceStyles = document.createElement("style");
    practiceStyles.id = "nepsis-practice-motion-styles";
    practiceStyles.textContent = `
      body.practice-page #stages .head h2,body.practice-page #stages .head p{ text-wrap:balance }
      body.practice-page #stageGrid .stage{will-change:transform;transform-style:preserve-3d}
      body.practice-page #stageGrid .stage.is-running{
        border-color:rgba(185,85,42,.58);
        box-shadow:0 22px 48px -30px rgba(120,64,36,.48),0 0 0 1px rgba(185,85,42,.1),0 1px 0 rgba(255,255,255,.92) inset;
      }
      body.practice-page #stageGrid .stage.is-running::after{transform:scaleX(1);opacity:1}
      body.practice-page #stageGrid .stage:focus-within{outline:2px solid rgba(185,85,42,.42);outline-offset:4px}
      body.practice-page #stageGrid .stage .msg[aria-live]{min-height:1.4em}
      body.practice-page #challenge,body.practice-page #quiz,body.practice-page #progress,body.practice-page #calendar{
        scroll-margin-top:100px;
      }
      html[data-theme="dark"] body.practice-page #stageGrid .stage.is-running{
        border-color:rgba(232,146,74,.62);box-shadow:0 24px 52px -34px rgba(0,0,0,.72),0 0 0 1px rgba(232,146,74,.12);
      }
      @media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){
        body.practice-page #stageGrid .stage:not(.is-running):hover{transform:translateY(-4px)}
      }
      @media(prefers-reduced-motion:reduce){body.practice-page #stageGrid .stage{will-change:auto}}
    `;
    document.head.appendChild(practiceStyles);
  }

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
      gsap.from(".page-heading > *", { y:34, opacity:0, filter:"blur(4px)", duration:.9, stagger:.13, ease:"power3.out", clearProps:"transform,opacity,filter" });
      gsap.utils.toArray(".info-card, .step-card, .research-panel, .faq-list details, .cta").forEach(function (el) {
        gsap.from(el, { y:46, opacity:0, rotateX:-3, transformOrigin:"50% 0%", duration:.82, ease:"power3.out", clearProps:"transform,opacity", scrollTrigger:{trigger:el,start:"top 86%",once:true} });
      });
    }
    if (document.body.classList.contains("privacy-page")) {
      gsap.from(".wrap > h1, .wrap > .muted", { y:28, opacity:0, duration:.8, stagger:.12, ease:"power3.out", clearProps:"transform,opacity" });
      gsap.utils.toArray(".wrap > h2, .wrap > p:not(.muted), .wrap > ul, .wrap > .note").forEach(function (el) {
        gsap.from(el, { y:28, opacity:0, duration:.72, ease:"power2.out", clearProps:"transform,opacity", scrollTrigger:{trigger:el,start:"top 90%",once:true} });
      });
    }
    if (document.querySelector(".stages .stage")) {
      gsap.from(".stages .stage", { y:58, opacity:0, rotateX:-11, transformOrigin:"50% 0%", duration:.95, stagger:.13, ease:"power4.out", clearProps:"transform,opacity", scrollTrigger:{trigger:".stages",start:"top 82%",once:true} });
    }
  }
})();
