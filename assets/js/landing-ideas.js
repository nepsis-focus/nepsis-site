/* Landing-page experiments inspired by Nepsis' own product, not copied from another site. */
(function () {
  if (!document.body.classList.contains("home-page")) return;

  const isEnglish = document.documentElement.lang === "en";
  const t = (el, en) => isEnglish ? en : el;
  const hero = document.querySelector(".hero-copy");
  if (!hero) return;

  const style = document.createElement("style");
  style.textContent = `
    body.home-page .trust-chips{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none}
    body.home-page .trust-chips li{padding:7px 11px;border:1px solid var(--border);border-radius:999px;background:var(--card);color:var(--muted);font-size:.78rem;font-weight:800}
    body.home-page .landing-lab{padding:clamp(54px,8vw,100px) 0;background:var(--card);border-block:1px solid var(--border)}
    body.home-page .landing-lab h2{max-width:16ch;margin:0 0 12px;font-size:clamp(2rem,4vw,3.3rem);letter-spacing:-.05em;line-height:1.04}
    body.home-page .landing-lab-intro{max-width:58ch;margin:0 0 30px;color:var(--muted);line-height:1.7}
    body.home-page .landing-demo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
    body.home-page .landing-panel{min-width:0;padding:clamp(22px,3vw,34px);border:1px solid var(--border);border-radius:24px;background:var(--bg)}
    body.home-page .demo-controls,.use-filters{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0}
    body.home-page .demo-controls button,.use-filters button{border:1px solid var(--border);border-radius:999px;padding:9px 14px;background:var(--card);color:var(--fg);font:inherit;font-weight:800;cursor:pointer}
    body.home-page .demo-controls button[aria-pressed=true],.use-filters button[aria-pressed=true]{background:var(--fg);color:var(--bg)}
    body.home-page .demo-ring{--progress:0deg;position:relative;display:grid;place-items:center;width:166px;aspect-ratio:1;margin:20px auto;border-radius:50%;background:conic-gradient(var(--orange) var(--progress),var(--border) 0);transition:background .3s ease}
    body.home-page .demo-ring:before{content:"";position:absolute;inset:10px;border-radius:50%;background:var(--bg)}
    body.home-page .demo-time{position:relative;font-size:2rem;font-weight:900;font-variant-numeric:tabular-nums}
    body.home-page .demo-action{display:flex;justify-content:center;flex-wrap:wrap;gap:9px}
    body.home-page .demo-action .btn{min-height:44px;padding:10px 18px}
    body.home-page .demo-note{min-height:1.5em;text-align:center;color:var(--muted);font-size:.88rem}
    body.home-page .how-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:28px 0 0;padding:0;list-style:none}
    body.home-page .how-steps li{padding:17px;border-top:2px solid var(--orange);background:var(--card);border-radius:0 0 14px 14px}
    body.home-page .how-steps b{display:block;margin-bottom:6px}
    body.home-page .use-plan{min-height:150px;padding:18px;border:1px solid var(--border);border-radius:16px;background:var(--card)}
    body.home-page .use-plan p{margin:8px 0;color:var(--muted);line-height:1.6}
    body.home-page .use-plan a{color:var(--ember);font-weight:900}
    body.home-page .mobile-start{display:none}
    body.home-page .faq-list details[data-nepsis-faq]{border-top:1px solid var(--border)}
    @media(max-width:700px){body.home-page .landing-demo-grid{grid-template-columns:1fr}body.home-page .how-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:600px){body.home-page{padding-bottom:calc(72px + env(safe-area-inset-bottom))}body.home-page .mobile-start{position:fixed;z-index:45;inset:auto 0 0;display:block;padding:10px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--border);background:var(--theme-header-bg,rgba(255,248,238,.96));backdrop-filter:blur(14px)}body.home-page .mobile-start a{display:flex;justify-content:center;width:100%;min-height:48px;align-items:center;border-radius:999px;background:var(--orange);color:white;text-decoration:none;font-weight:900}}
    @media(prefers-reduced-motion:reduce){body.home-page .demo-ring{transition:none}}
  `;
  document.head.appendChild(style);

  const chips = document.createElement("ul");
  chips.className = "trust-chips";
  chips.setAttribute("aria-label", t("Με μια ματιά", "At a glance"));
  chips.innerHTML = [
    t("Δωρεάν", "Free"), t("Χωρίς εγγραφή", "No sign-up"),
    t("Ξεκινάς σε 5″", "Start in 5 sec"), t("Τα δεδομένα μένουν στη συσκευή σου", "Your data stays on your device")
  ].map(label => `<li>${label}</li>`).join("");
  const lead = hero.querySelector(".lead");
  if (lead) lead.after(chips); else hero.append(chips);

  const lab = document.createElement("section");
  lab.className = "landing-lab";
  lab.id = "try-nepsis";
  lab.setAttribute("aria-labelledby", "landingLabTitle");
  lab.innerHTML = `
    <div class="wrap">
      <span class="eyebrow">${t("Δοκίμασέ το", "Try it")}</span>
      <h2 id="landingLabTitle">${t("Μια μικρή δοκιμή συγκέντρωσης.", "A small taste of focus.")}</h2>
      <p class="landing-lab-intro">${t("Δες πώς κινείται ο κύκλος του timer. Είναι ένα demo της landing· για κανονική συνεδρία, άνοιξε την εφαρμογή.", "See the timer ring move. This is a landing-page demo; open the app for a real session.")}</p>
      <div class="landing-demo-grid">
        <section class="landing-panel" aria-labelledby="demoTitle">
          <span class="eyebrow">${t("Ζωντανό demo", "Live demo")}</span>
          <h3 id="demoTitle">${t("Διάλεξε διάρκεια", "Choose a duration")}</h3>
          <div class="demo-controls" role="group" aria-label="${t("Διάρκεια demo", "Demo duration")}">
            <button type="button" data-demo-min="5" aria-pressed="true">5′</button>
            <button type="button" data-demo-min="25" aria-pressed="false">25′</button>
          </div>
          <div class="demo-ring" id="landingDemoRing" role="img" aria-label="${t("Demo χρονόμετρο", "Demo timer")}"><span class="demo-time" id="landingDemoTime">05:00</span></div>
          <div class="demo-action"><button class="btn btn-primary" type="button" id="landingDemoToggle">${t("Έναρξη demo", "Start demo")}</button><button class="btn btn-ghost" type="button" id="landingDemoReset">${t("Επαναφορά", "Reset")}</button></div>
          <p class="demo-note" id="landingDemoNote" aria-live="polite">${t("Ο timer του demo δεν καταγράφει συνεδρίες ή πρόοδο.", "The demo timer does not record sessions or progress.")}</p>
          <div class="demo-action"><a class="btn btn-ghost" href="practice.html#stageGrid">${t("Άνοιξε το κανονικό timer →", "Open the full timer →")}</a></div>
        </section>
        <section class="landing-panel" aria-labelledby="useTitle">
          <span class="eyebrow">${t("Για κάθε μέρα", "For your day")}</span>
          <h3 id="useTitle">${t("Τι έχεις μπροστά σου;", "What are you working on?")}</h3>
          <div class="use-filters" role="group" aria-label="${t("Επίλεξε χρήση", "Choose a use case")}">
            <button type="button" data-use="exams" aria-pressed="true">${t("Εξεταστική", "Exams")}</button>
            <button type="button" data-use="panhellenic" aria-pressed="false">${t("Πανελλήνιες", "School exams")}</button>
            <button type="button" data-use="work" aria-pressed="false">${t("Δουλειά", "Work")}</button>
            <button type="button" data-use="coding" aria-pressed="false">Coding</button>
          </div>
          <div class="use-plan" id="usePlan" aria-live="polite"></div>
        </section>
      </div>
      <ol class="how-steps" aria-label="${t("Πώς δουλεύει", "How it works")}">
        <li><b>${t("Άνοιξε · 5″", "Open · 5 sec")}</b>${t("Χωρίς λογαριασμό.", "No account needed.")}</li>
        <li><b>${t("Διάλεξε στάδιο", "Choose a stage")}</b>${t("Ξεκίνα από εκεί που είσαι.", "Start where you are.")}</li>
        <li><b>${t("Εστίασε · 5–60′", "Focus · 5–60 min")}</b>${t("Ένας στόχος τη φορά.", "One goal at a time.")}</li>
        <li><b>${t("Δες την εβδομάδα σου", "See your week")}</b>${t("Παρακολούθησε την πρόοδο στη συσκευή σου.", "Track progress on your device.")}</li>
      </ol>
    </div>`;
  const heroSection = document.querySelector("body.home-page main > .hero");
  if (heroSection) heroSection.after(lab);

  const recommendations = {
    exams: [25, t("Διάβασε ένα μικρό κομμάτι ύλης και σημείωσε τρεις βασικές ιδέες.", "Review one small topic and write down three key ideas.")],
    panhellenic: [25, t("Λύσε μία ομάδα ασκήσεων σε ένα μάθημα και σημείωσε τι θέλεις να ξαναδείς.", "Work through one set of exercises and note what to revisit.")],
    work: [25, t("Διάλεξε το επόμενο συγκεκριμένο παραδοτέο και κλείσε τις άσχετες καρτέλες.", "Choose the next concrete deliverable and close unrelated tabs.")],
    coding: [45, t("Διάλεξε ένα μικρό task, όρισε τι σημαίνει ολοκληρωμένο και ξεκίνα από το πρώτο βήμα.", "Pick one small task, define done, and start with the first step.")]
  };
  const plan = document.getElementById("usePlan");
  function showPlan(key) {
    const item = recommendations[key] || recommendations.exams;
    plan.innerHTML = `<strong>${t("Πρόταση AI Coach · ", "AI Coach idea · ")}${item[0]} ${t("λεπτά", "min")}</strong><p>${item[1]}</p><a href="coach.html">${t("Φτιάξε το δικό σου πλάνο με τον AI Coach →", "Make your own plan with AI Coach →")}</a>`;
  }
  showPlan("exams");
  lab.querySelectorAll("[data-use]").forEach(button => button.addEventListener("click", () => {
    lab.querySelectorAll("[data-use]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    showPlan(button.dataset.use);
  }));

  let duration = 300;
  let remaining = duration;
  let interval = null;
  const ring = document.getElementById("landingDemoRing");
  const time = document.getElementById("landingDemoTime");
  const toggle = document.getElementById("landingDemoToggle");
  const note = document.getElementById("landingDemoNote");
  const render = () => {
    time.textContent = String(Math.floor(remaining / 60)).padStart(2, "0") + ":" + String(remaining % 60).padStart(2, "0");
    ring.style.setProperty("--progress", ((duration - remaining) / duration * 360) + "deg");
    ring.setAttribute("aria-label", t("Demo χρονόμετρο: ", "Demo timer: ") + time.textContent);
  };
  lab.querySelectorAll("[data-demo-min]").forEach(button => button.addEventListener("click", () => {
    clearInterval(interval); interval = null;
    duration = Number(button.dataset.demoMin) * 60; remaining = duration;
    lab.querySelectorAll("[data-demo-min]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    toggle.textContent = t("Έναρξη demo", "Start demo");
    note.textContent = t("Ο timer του demo δεν καταγράφει συνεδρίες ή πρόοδο.", "The demo timer does not record sessions or progress.");
    render();
  }));
  toggle.addEventListener("click", () => {
    if (interval) {
      clearInterval(interval); interval = null; toggle.textContent = t("Συνέχεια demo", "Resume demo");
      note.textContent = t("Σε παύση — η πρόοδος του demo μένει μόνο εδώ.", "Paused — demo progress stays on this page.");
      return;
    }
    if (remaining <= 0) remaining = duration;
    toggle.textContent = t("Παύση", "Pause");
    note.textContent = t("Το demo τρέχει — δεν αποθηκεύεται πρόοδος.", "Demo is running — no progress is saved.");
    interval = setInterval(() => {
      remaining = Math.max(0, remaining - 1); render();
      if (!remaining) {
        clearInterval(interval); interval = null;
        toggle.textContent = t("Ξανά από την αρχή", "Start again");
        note.textContent = t("Τέλος demo. Μπράβο που έκανες χώρο για συγκέντρωση.", "Demo complete. Nice work making room to focus.");
      }
    }, 1000);
  });
  document.getElementById("landingDemoReset").addEventListener("click", () => {
    clearInterval(interval); interval = null; remaining = duration; render();
    toggle.textContent = t("Έναρξη demo", "Start demo");
    note.textContent = t("Ο timer του demo δεν καταγράφει συνεδρίες ή πρόοδο.", "The demo timer does not record sessions or progress.");
  });
  render();

  const mobileCta = document.createElement("div");
  mobileCta.className = "mobile-start";
  mobileCta.innerHTML = `<a href="practice.html#stageGrid">${t("Ξεκίνα τώρα, δωρεάν", "Start now, free")}</a>`;
  document.body.appendChild(mobileCta);

  const faq = document.querySelector("#faq .faq-list");
  const faqItems = [
    [t("Γιατί το Nepsis δεν μπλοκάρει εφαρμογές;", "Why doesn't Nepsis block apps?"), t("Το Nepsis σε βοηθά να εξασκείς την προσοχή σου χωρίς να παίρνει τον έλεγχο της συσκευής. Εσύ επιλέγεις πώς θα περιορίσεις τους περισπασμούς.", "Nepsis helps you practice attention without taking control of your device. You choose how to manage distractions." )],
    [t("Είναι όντως δωρεάν;", "Is it really free?"), t("Ναι. Η βασική εξάσκηση και τα στάδια εστίασης είναι δωρεάν. Το προαιρετικό Nepsis+ περιλαμβάνει επιπλέον υλικό και τιμή που φαίνεται στη σελίδα του.", "Yes. Core practice and focus stages are free. Optional Nepsis+ adds materials; its pricing is shown on its page." )],
    [t("Χρειάζεται να γραφτώ για να ξεκινήσω;", "Do I need an account to start?"), t("Όχι. Μπορείς να ξεκινήσεις αμέσως. Ορισμένες λειτουργίες λογαριασμού είναι προαιρετικές.", "No. You can start right away. Account features are optional." )]
  ];
  if (faq) faqItems.forEach(([question, answer]) => {
    const details = document.createElement("details");
    details.dataset.nepsisFaq = "true";
    const summary = document.createElement("summary"); summary.textContent = question;
    const paragraph = document.createElement("p"); paragraph.textContent = answer;
    details.append(summary, paragraph); faq.append(details);
  });

  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  const graph = [{
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Nepsis",
    applicationCategory: "ProductivityApplication", operatingSystem: "Web browser",
    url: "https://nepsis-focus.github.io/nepsis-site/",
    description: t("Δωρεάν εφαρμογή εστίασης για διάβασμα και δουλειά. Χωρίς εγγραφή.", "A free focus app for study and work. No sign-up required."),
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }
  }];
  if (faq) graph.push({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqItems.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } }))
  });
  schema.textContent = JSON.stringify(graph);
  document.head.appendChild(schema);
})();
