/* Homepage product story: enhances presentation without replacing app behavior. */
(function () {
  var body = document.body;
  var main = document.querySelector("body.home-page main#top");
  var hero = document.getElementById("globe");
  if (!body || !main || !hero || document.getElementById("zero-friction")) return;

  var productNav = document.createElement("nav");
  productNav.className = "home-product-links";
  productNav.setAttribute("aria-label", "Κύρια πλοήγηση");
  productNav.innerHTML = [
    '<a href="#try-nepsis" data-el="Δοκίμασε" data-en="Try it">Δοκίμασε</a>',
    '<a href="#why-nepsis" data-el="Γιατί Nepsis" data-en="Why Nepsis">Γιατί Nepsis</a>',
    '<a href="#plans" data-el="Πλάνα" data-en="Plans">Πλάνα</a>'
  ].join("");
  var header = document.querySelector("body.home-page header.top .top-in");
  var headRight = header && header.querySelector(".head-right");
  if (header && headRight) header.insertBefore(productNav, headRight);

  // Replace only the landing copy; keep the original start route and site controls.
  var heading = hero.querySelector("h1");
  var badge = hero.querySelector(".badge");
  var lead = hero.querySelector(".lead");
  var start = hero.querySelector(".btn-primary");
  var learn = hero.querySelector(".btn-ghost");
  if (heading) {
    heading.dataset.el = "Σκέψου καθαρά.<br>Χωρίς περισπασμούς.";
    heading.dataset.en = "Think clearly.<br>Without distractions.";
  }
  if (badge) {
    badge.dataset.el = "NEPSIS";
    badge.dataset.en = "NEPSIS";
    badge.textContent = "NEPSIS";
  }
  if (lead) {
    lead.dataset.el = "Ένα εργαλείο εστίασης που σέβεται το μυαλό σου.";
    lead.dataset.en = "A focus tool that respects your mind.";
  }
  if (start) {
    start.dataset.el = "Ξεκίνα σε 5 δευτερόλεπτα";
    start.dataset.en = "Start in 5 seconds";
    start.textContent = start.dataset.el;
    start.href = "practice.html#stageGrid";
  }
  if (learn) {
    learn.dataset.el = "Μάθε περισσότερα";
    learn.dataset.en = "Learn more";
    learn.textContent = learn.dataset.el;
    learn.href = "#why-nepsis";
  }

  var sections = document.createElement("div");
  sections.id = "home-product-story";
  sections.innerHTML = `
    <section class="home-product-section home-product-light" id="zero-friction" aria-labelledby="zero-friction-title">
      <div class="home-product-container">
        <header class="home-product-heading">
          <p class="home-product-eyebrow" data-el="ΧΩΡΙΣ ΤΡΙΒΗ" data-en="ZERO FRICTION">ΧΩΡΙΣ ΤΡΙΒΗ</p>
          <h2 id="zero-friction-title" data-el="Απλό από την πρώτη στιγμή." data-en="Simple from the first moment.">Απλό από την πρώτη στιγμή.</h2>
          <p class="home-product-copy" data-el="Λιγότερα βήματα ανάμεσα σε εσένα και σε αυτό που έχει σημασία." data-en="Fewer steps between you and what matters.">Λιγότερα βήματα ανάμεσα σε εσένα και σε αυτό που έχει σημασία.</p>
        </header>
        <div class="home-product-grid">
          <article class="home-product-card">
            <h3 data-el="Χωρίς εγγραφή" data-en="No sign-up">Χωρίς εγγραφή</h3>
            <p data-el="Ξεκίνα ως επισκέπτης. Η σύνδεση χρειάζεται μόνο αν θέλεις συγχρονισμό στον λογαριασμό σου." data-en="Start as a guest. Sign-in is only needed if you want account sync.">Ξεκίνα ως επισκέπτης. Η σύνδεση χρειάζεται μόνο αν θέλεις συγχρονισμό στον λογαριασμό σου.</p>
          </article>
          <article class="home-product-card">
            <h3 data-el="Έτοιμο σε 5 δευτερόλεπτα" data-en="Ready in 5 seconds">Έτοιμο σε 5 δευτερόλεπτα</h3>
            <p data-el="Διάλεξε ένα από τα στάδια εστίασης, από 5 έως 60 λεπτά, και ξεκίνα." data-en="Choose a focus stage from 5 to 60 minutes and begin.">Διάλεξε ένα από τα στάδια εστίασης, από 5 έως 60 λεπτά, και ξεκίνα.</p>
          </article>
          <article class="home-product-card">
            <h3 data-el="Μηδενική καμπύλη" data-en="No learning curve">Μηδενική καμπύλη</h3>
            <p data-el="Καθαρό χρονόμετρο και απλά βήματα — χωρίς κλειδώματα εφαρμογών ή περίπλοκες ρυθμίσεις." data-en="A clear timer and simple steps — no app locks or complicated setup.">Καθαρό χρονόμετρο και απλά βήματα — χωρίς κλειδώματα εφαρμογών ή περίπλοκες ρυθμίσεις.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="home-product-section home-product-dark" id="local-private" aria-labelledby="local-private-title">
      <div class="home-product-container home-product-privacy">
        <header class="home-product-heading">
          <p class="home-product-eyebrow" data-el="LOCAL &amp; PRIVATE" data-en="LOCAL &amp; PRIVATE">LOCAL &amp; PRIVATE</p>
          <h2 id="local-private-title" data-el="Τα δεδομένα σου μένουν σε εσένα." data-en="Your data stays yours.">Τα δεδομένα σου μένουν σε εσένα.</h2>
          <p class="home-product-copy" data-el="Ως επισκέπτης, η πρόοδός σου αποθηκεύεται στον browser της συσκευής σου. Αν συνδεθείς, μπορεί να συγχρονιστεί ιδιωτικά στον λογαριασμό σου. Το κρυπτογραφημένο ημερολόγιο μένει μόνο στη συσκευή σου, ενώ ο Coach στέλνει κείμενο σε AI μόνο με τη ρητή συγκατάθεσή σου." data-en="As a guest, your progress is stored in your device browser. If you sign in, it can sync privately to your account. Your encrypted diary stays on your device, and the Coach sends text to AI only with your explicit consent.">Ως επισκέπτης, η πρόοδός σου αποθηκεύεται στον browser της συσκευής σου. Αν συνδεθείς, μπορεί να συγχρονιστεί ιδιωτικά στον λογαριασμό σου. Το κρυπτογραφημένο ημερολόγιο μένει μόνο στη συσκευή σου, ενώ ο Coach στέλνει κείμενο σε AI μόνο με τη ρητή συγκατάθεσή σου.</p>
          <a class="home-product-privacy-link" href="privacy.html" data-el="Δες πώς λειτουργεί η ιδιωτικότητα →" data-en="See how privacy works →">Δες πώς λειτουργεί η ιδιωτικότητα →</a>
        </header>
      </div>
    </section>

    <section class="home-product-section home-product-light" id="why-nepsis" aria-labelledby="why-nepsis-title">
      <div class="home-product-container">
        <header class="home-product-heading">
          <p class="home-product-eyebrow" data-el="WHY NEPSIS" data-en="WHY NEPSIS">WHY NEPSIS</p>
          <h2 id="why-nepsis-title" data-el="Φτιαγμένο για πραγματική εστίαση." data-en="Made for real focus.">Φτιαγμένο για πραγματική εστίαση.</h2>
          <p class="home-product-copy" data-el="Ένας πιο ήρεμος ψηφιακός χώρος, σχεδιασμένος γύρω από τη δική σου προσοχή." data-en="A calmer digital space, designed around your attention.">Ένας πιο ήρεμος ψηφιακός χώρος, σχεδιασμένος γύρω από τη δική σου προσοχή.</p>
        </header>
        <div class="home-product-grid">
          <article class="home-product-card">
            <h3 data-el="Ήσυχο design" data-en="Quiet design">Ήσυχο design</h3>
            <p data-el="Καθαρή τυπογραφία και γενναιόδωρος χώρος, για να μένεις σε αυτό που κάνεις." data-en="Clear type and generous space help you stay with what you are doing.">Καθαρή τυπογραφία και γενναιόδωρος χώρος, για να μένεις σε αυτό που κάνεις.</p>
          </article>
          <article class="home-product-card">
            <h3 data-el="Πραγματική ταχύτητα" data-en="Real speed">Πραγματική ταχύτητα</h3>
            <p data-el="Άμεση πρόσβαση στα στάδια εστίασης, χωρίς να χρειάζεται εγκατάσταση." data-en="Jump straight into the focus stages, with no installation required.">Άμεση πρόσβαση στα στάδια εστίασης, χωρίς να χρειάζεται εγκατάσταση.</p>
          </article>
          <article class="home-product-card">
            <h3 data-el="Σέβεται τον χρόνο σου" data-en="Respects your time">Σέβεται τον χρόνο σου</h3>
            <p data-el="Χωρίς υποχρεωτικά σερί ή κλειδώματα εφαρμογών. Εσύ διαλέγεις πότε και πόσο." data-en="No forced streaks or app locks. You choose when and for how long.">Χωρίς υποχρεωτικά σερί ή κλειδώματα εφαρμογών. Εσύ διαλέγεις πότε και πόσο.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="home-product-section home-product-dark" id="plans" aria-labelledby="plans-title">
      <div class="home-product-container">
        <header class="home-product-heading">
          <p class="home-product-eyebrow" data-el="PLANS" data-en="PLANS">PLANS</p>
          <h2 id="plans-title" data-el="Διάλεξε τον ρυθμό σου." data-en="Choose your own pace.">Διάλεξε τον ρυθμό σου.</h2>
          <p class="home-product-copy" data-el="Ξεκίνα δωρεάν με τα στάδια εστίασης ή ζήτησε από τον Coach να σε βοηθήσει να φτιάξεις ένα πλάνο." data-en="Start for free with the focus stages, or ask the Coach to help you build a plan.">Ξεκίνα δωρεάν με τα στάδια εστίασης ή ζήτησε από τον Coach να σε βοηθήσει να φτιάξεις ένα πλάνο.</p>
        </header>
        <div class="home-product-actions">
          <a class="home-product-button" href="practice.html#stageGrid" data-el="Ξεκίνα δωρεάν" data-en="Start for free">Ξεκίνα δωρεάν</a>
          <a class="home-product-button home-product-button--secondary" href="coach.html" data-el="Φτιάξε το δικό σου πλάνο" data-en="Build your own plan">Φτιάξε το δικό σου πλάνο</a>
        </div>
        <a class="home-product-more" href="#premium" data-el="Δες τις επιλογές Nepsis+ →" data-en="See Nepsis+ options →">Δες τις επιλογές Nepsis+ →</a>
      </div>
    </section>`;

  hero.insertAdjacentElement("afterend", sections);

  // Keep the already-existing live demo after the requested product-story order,
  // regardless of which independently loaded homepage script finishes first.
  var placeAfterProductStory = function () {
    var demo = document.getElementById("try-nepsis");
    if (!demo || !sections.isConnected) return false;
    if (sections.nextElementSibling === demo) return true;
    sections.insertAdjacentElement("afterend", demo);
    return true;
  };
  if (!placeAfterProductStory()) {
    var storyObserver = new MutationObserver(function () {
      if (placeAfterProductStory()) storyObserver.disconnect();
    });
    storyObserver.observe(main, { childList: true, subtree: true });
  }

  // The daily tip stays available, but moves out of the hero so the first screen
  // remains calm and focused.
  var dailyTip = document.getElementById("dailyTip");
  var bentoGrid = document.querySelector("#bento .bento-grid");
  if (dailyTip && bentoGrid) {
    bentoGrid.insertAdjacentElement("afterend", dailyTip);
    dailyTip.classList.add("home-product-daily-tip");
  }

  // Initialize newly-added copy in the language selected before this script ran.
  var lang = document.documentElement.lang === "en" ? "en" : "el";
  productNav.querySelectorAll("[data-el]").forEach(function (element) {
    element.textContent = element.dataset[lang] || element.dataset.el;
  });
  sections.querySelectorAll("[data-el]").forEach(function (element) {
    element.textContent = element.dataset[lang] || element.dataset.el;
  });
  if (heading) heading.innerHTML = heading.dataset[lang] || heading.dataset.el;
  if (lead) lead.textContent = lead.dataset[lang] || lead.dataset.el;
  if (start) start.textContent = start.dataset[lang] || start.dataset.el;
  if (learn) learn.textContent = learn.dataset[lang] || learn.dataset.el;

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealTargets = sections.querySelectorAll(".home-product-section");
  if (!reducedMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("home-product-motion");
    var observer = new IntersectionObserver(function (entries, currentObserver) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -32px 0px" });
    revealTargets.forEach(function (section) { observer.observe(section); });
  } else {
    revealTargets.forEach(function (section) { section.classList.add("is-visible"); });
  }

  // Keep the existing sticky mobile start button, but let the hero buttons
  // remain unobstructed until the visitor has scrolled past the hero.
  if (window.matchMedia && window.matchMedia("(max-width: 600px)").matches && "IntersectionObserver" in window) {
    var watchHero = function (cta) {
      if (!cta || cta.dataset.homeProductObserved === "true") return false;
      cta.dataset.homeProductObserved = "true";
      var heroObserver = new IntersectionObserver(function (entries) {
        body.classList.toggle("home-product-scrolled", !entries[0].isIntersecting && window.scrollY > sections.offsetTop);
      }, { threshold: 0.05 });
      heroObserver.observe(sections);
      return true;
    };
    if (!watchHero(document.querySelector(".mobile-start"))) {
      var ctaObserver = new MutationObserver(function () {
        if (watchHero(document.querySelector(".mobile-start"))) ctaObserver.disconnect();
      });
      ctaObserver.observe(body, { childList: true, subtree: true });
    }
  }
})();
