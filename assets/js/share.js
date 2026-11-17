/* Share button: the phone share sheet where it exists, copy-link fallback elsewhere.
   The shared link opens the homepage; ?utm_source=share marks visits that came from a share. */
(function () {
  var btn = document.getElementById("shareBtn");
  if (!btn) return;
  var msg = document.getElementById("shareMsg");
  var url = "https://nepsis-focus.github.io/nepsis-site/?utm_source=share";
  function isEn() {
    try { if (localStorage.getItem("nepsis-lang") === "en") return true; } catch (e) {}
    return document.documentElement.lang === "en";
  }
  function say(el, en) { if (msg) msg.textContent = isEn() ? en : el; }
  btn.addEventListener("click", function () {
    var text = isEn()
      ? "Nepsis: a free focus app. No app-blocking, no sign-up."
      : "Nepsis: δωρεάν εφαρμογή εστίασης. Χωρίς κλειδώματα, χωρίς εγγραφή.";
    if (navigator.share) {
      navigator.share({ title: "Nepsis", text: text, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + " " + url).then(function () {
        say("Ο σύνδεσμος αντιγράφηκε. Στείλε τον σε όποιον θέλεις.", "Link copied. Send it to anyone.");
      }, function () { say(url, url); });
    } else {
      say(url, url);
    }
  });
})();
