/* Conversion-focused homepage polish. Uses product facts only; no fabricated testimonials. */
(function () {
  if (!document.body.classList.contains("home-page") || document.getElementById("nepsis-conversion-styles")) return;
  var isEnglish = document.documentElement.lang === "en";
  var text = function (el, en) { return isEnglish ? en : el; };
  var hero = document.querySelector(".hero-copy");
  var premium = document.getElementById("premium");
  var ctaTarget = document.querySelector(".mobile-start a");
  if (!hero) return;

  var css = document.createElement("style");
  css.id = "nepsis-conversion-styles";
  css.textContent = `
    body.home-page .conversion-proof{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin:0;padding:0;border:1px solid var(--border);border-radius:20px;background:var(--card);list-style:none;overflow:hidden}
    body.home-page .conversion-proof li{padding:18px 20px;min-width:0}
    body.home-page .conversion-proof li+li{border-left:1px solid var(--border)}
    body.home-page .conversion-proof strong{display:block;font-size:.96rem;line-height:1.35}
    body.home-page .conversion-proof span{display:block;margin-top:5px;color:var(--muted);font-size:.84rem;line-height:1.5}
    body.home-page .conversion-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    body.home-page .conversion-links a{font-size:.9rem;font-weight:850}
    body.home-page .landing-lab .landing-panel{box-shadow:0 16px 42px -34px rgba(58,36,24,.35)}
    body.home-page #premium .premium-choices{align-items:stretch}
    body.home-page #premium .premium-choices>.cmp{display:flex;flex-direction:column;justify-content:flex-start;box-shadow:0 14px 36px -30px rgba(58,36,24,.35)}
    body.home-page #premium .premium-choices>.cmp.on{border:2px solid color-mix(in srgb,var(--orange) 50%,var(--border));position:relative}
    body.home-page #premium .premium-choices>.cmp.on:before{content:attr(data-plan-badge);display:inline-flex;align-self:flex-start;margin:-4px 0 12px;padding:5px 10px;border-radius:999px;background:var(--orange);color:white;font-size:.72rem;font-weight:900}
    body.home-page #premium .premium-choices .btns{margin-top:auto!important;padding-top:18px}
    body.home-page #premium .premium-note{border-top:1px solid var(--border);padding-top:16px}
    body.home-page .faq-list details[data-nepsis-faq]{padding:4px 0}
    body.home-page .faq-list details[data-nepsis-faq] summary{font-weight:900}
    body.home-page .mobile-start a{box-shadow:0 8px 26px -14px rgba(184,52,30,.8)}
    @media(max-width:700px){body.home-page .conversion-proof{grid-template-columns:1fr}body.home-page .conversion-proof li+li{border-left:0;border-top:1px solid var(--border)}body.home-page .conversion-proof li{padding:13px 16px}}
    @media(prefers-reduced-motion:reduce){body.home-page .mobile-start a{box-shadow:none}}
  `;
  document.head.appendChild(css);

  /* Replace the overly broad device-only chip: signed-in users can opt into sync. */
  var chips = hero.querySelector(".trust-chips");
  if (chips) {
    var chipLabels = [text("Δωρεάν", "Free"), text("Χωρίς εγγραφή", "No sign-up"), text("Ξεκινάς σε 5″", "Start in 5 sec"), text("Η πρόοδός σου ξεκινά στη συσκευή σου", "Your progress starts on your device")];
    chips.innerHTML = chipLabels.map(function (label) { var li = document.createElement("li"); li.textContent = label; return li.outerHTML; }).join("");
    var privacyNote = document.createElement("p");
    privacyNote.className = "conversion-privacy-note";
    privacyNote.textContent = text("Η πρόοδος αποθηκεύεται τοπικά· ο προαιρετικός λογαριασμός επιτρέπει συγχρονισμό.", "Progress is stored locally; an optional account enables sync.");
    chips.after(privacyNote);
  }

  var heroButtons = hero.querySelector(".btns");
  if (heroButtons && !hero.querySelector(".conversion-links")) {
    var links = document.createElement("div");
    links.className = "conversion-links";
    links.innerHTML = '<a href="#premium">' + text("Σύγκρινε Free και Nepsis+ ↓", "Compare Free and Nepsis+ ↓") + '</a>';
    heroButtons.after(links);
  }

  /* Product-value proof, not invented customer or usage claims. */
  var proof = document.createElement("ul");
  proof.className = "conversion-proof";
  proof.setAttribute("aria-label", text("Τι προσφέρει το Nepsis", "What Nepsis offers"));
  [
    [text("Χωρίς κλειδώματα", "No app locks"), text("Εσύ έχεις τον έλεγχο της συσκευής σου.", "You stay in control of your device." )],
    [text("Μικρά στάδια", "Small stages"), text("Ξεκίνα από 5 λεπτά και προχώρησε με τον ρυθμό σου.", "Start with 5 minutes and move at your own pace." )],
    [text("Free ή προαιρετικό Nepsis+", "Free, with optional Nepsis+"), text("Δες καθαρά τι περιλαμβάνει κάθε επιλογή.", "See clearly what each option includes." )]
  ].map(function (item) {
    var li = document.createElement("li");
    var strong = document.createElement("strong"); strong.textContent = item[0];
    var span = document.createElement("span"); span.textContent = item[1];
    li.append(strong, span); proof.append(li);
  });
  var lab = document.getElementById("try-nepsis");
  if (lab && !document.getElementById("conversion-proof")) {
    proof.id = "conversion-proof";
    lab.querySelector(".wrap").append(proof);
  }

  /* Make existing, accurate pricing cards feel like a deliberate comparison. */
  if (premium) {
    var choices = premium.querySelectorAll(".premium-choices > .cmp");
    if (choices[0]) choices[0].setAttribute("data-plan-badge", text("Ξεκίνα δωρεάν", "Start free"));
    if (choices[1]) {
      var heading = choices[1].querySelector("h3");
      if (heading && !choices[1].querySelector("a.btn")) {
        var link = document.createElement("a"); link.className = "btn btn-primary"; link.href = "premium.html";
        link.textContent = text("Δες τιμές και λεπτομέρειες →", "See pricing and details →");
        choices[1].append(link);
      }
    }
  }

  if (ctaTarget) ctaTarget.setAttribute("aria-label", text("Ξεκίνα τώρα δωρεάν, χωρίς εγγραφή", "Start free now, no sign-up"));
})();
