(function () {
  var DATE_KEY = "nepsis-exam-date";
  var currentLang = "el";
  var editing = false;
  var drawer = document.getElementById("drawer");
  var menuBtn = document.getElementById("menuBtn");
  var scrim = document.getElementById("scrim");
  var form = document.getElementById("examForm");
  var input = document.getElementById("examDate");
  var message = document.getElementById("examCountdown");
  var changeBtn = document.getElementById("examChange");

  function setMenu(open) {
    drawer.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    menuBtn.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  menuBtn.addEventListener("click", function () { setMenu(!drawer.classList.contains("open")); });
  document.getElementById("closeBtn").addEventListener("click", function () { setMenu(false); });
  scrim.addEventListener("click", function () { setMenu(false); });
  drawer.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });

  function parseIso(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function storedDate() {
    try {
      var value = localStorage.getItem(DATE_KEY);
      if (parseIso(value)) return value;
      if (value) localStorage.removeItem(DATE_KEY);
    } catch (e) {}
    return "";
  }

  function saveDate(value) {
    try {
      if (parseIso(value)) localStorage.setItem(DATE_KEY, value);
      else localStorage.removeItem(DATE_KEY);
    } catch (e) {}
  }

  function daysUntil(date) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  function countdownText(date) {
    var days = daysUntil(date);
    if (days <= 0) {
      return currentLang === "en" ? "Good luck with your exams." : "Καλή επιτυχία στις εξετάσεις.";
    }
    if (days === 1) {
      return currentLang === "en" ? "1 day left" : "Σου μένει 1 μέρα";
    }
    return currentLang === "en" ? days + " days left" : "Σου μένουν " + days + " μέρες";
  }

  function renderCountdown() {
    var iso = storedDate();
    var date = parseIso(iso);
    if (!date) {
      editing = false;
      form.hidden = false;
      if (document.activeElement !== input) input.value = "";
      message.hidden = true;
      if (message.textContent) message.textContent = "";
      changeBtn.hidden = true;
      return;
    }
    var text = countdownText(date);
    message.hidden = false;
    if (message.textContent !== text) message.textContent = text;
    if (editing) {
      form.hidden = false;
      changeBtn.hidden = true;
      if (document.activeElement !== input && input.value !== iso) input.value = iso;
      return;
    }
    form.hidden = true;
    changeBtn.hidden = false;
  }

  function setLang(lang) {
    currentLang = lang === "en" ? "en" : "el";
    document.documentElement.lang = currentLang;
    document.querySelectorAll("[data-el]").forEach(function (el) {
      el.textContent = el.dataset[currentLang] || el.dataset.el;
    });
    document.querySelectorAll(".lang button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.lang === currentLang);
    });
    menuBtn.setAttribute("aria-label", currentLang === "el" ? "Άνοιγμα μενού" : "Open menu");
    document.getElementById("closeBtn").setAttribute("aria-label", currentLang === "el" ? "Κλείσιμο" : "Close");
    drawer.setAttribute("aria-label", currentLang === "el" ? "Κύριο μενού" : "Main menu");
    renderCountdown();
  }

  document.querySelectorAll(".lang button").forEach(function (button) {
    button.addEventListener("click", function () { setLang(button.dataset.lang); });
  });

  input.addEventListener("change", function () {
    saveDate(input.value);
    editing = false;
    renderCountdown();
  });

  changeBtn.addEventListener("click", function () {
    var iso = storedDate();
    editing = true;
    form.hidden = false;
    changeBtn.hidden = true;
    if (parseIso(iso)) input.value = iso;
    input.focus();
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) renderCountdown();
  });

  try { setLang(localStorage.getItem("nepsis-lang") === "en" ? "en" : "el"); }
  catch (e) { setLang("el"); }
})();
