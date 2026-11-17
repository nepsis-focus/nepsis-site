/* AI Coach page: opens and closes the site menu like the other pages do,
   and turns the check-in fields into tappable choices. The original form
   fields stay in the page and keep the values coach.js reads. */
(function () {
  var drawer = document.getElementById("drawer");
  var button = document.getElementById("menuBtn");
  var scrim = document.getElementById("scrim");
  var close = document.getElementById("closeBtn");
  if (drawer && button) {
    drawer.inert = true;
    drawer.tabIndex = -1;
    var setOpen = function (open) {
      drawer.classList.toggle("open", open);
      if (scrim) scrim.classList.toggle("open", open);
      drawer.setAttribute("aria-hidden", String(!open));
      drawer.inert = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) drawer.focus({ preventScroll: true }); else button.focus();
    };
    button.addEventListener("click", function () { setOpen(!drawer.classList.contains("open")); });
    if (scrim) scrim.addEventListener("click", function () { setOpen(false); });
    if (close) close.addEventListener("click", function () { setOpen(false); });
    drawer.addEventListener("click", function (event) { if (event.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && drawer.classList.contains("open")) setOpen(false);
    });
  }

  function en() { return document.documentElement.lang === "en"; }
  function make(tag, cls, el, enText) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (el !== undefined) {
      node.setAttribute("data-el", el);
      node.setAttribute("data-en", enText);
      node.textContent = en() ? enText : el;
    }
    return node;
  }
  function fire(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function choiceGroup(label, items, current, onPick) {
    var group = document.createElement("div");
    group.className = "coach-choices";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    items.forEach(function (item) {
      var b = make("button", "coach-choice", item.el, item.en);
      b.type = "button";
      b.dataset.value = item.value;
      b.setAttribute("aria-pressed", String(String(item.value) === String(current)));
      b.addEventListener("click", function () {
        group.querySelectorAll(".coach-choice").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        onPick(item.value);
      });
      group.appendChild(b);
    });
    return group;
  }

  /* Hero: three things the Coach gives you */
  var heroText = document.querySelector(".coach-hero p");
  if (heroText && !document.querySelector(".coach-points")) {
    var points = document.createElement("ul");
    points.className = "coach-points";
    [["Μικρά βήματα", "Small steps"], ["Ερωτήσεις μελέτης", "Study questions"], ["Το σωστό στάδιο", "The right stage"]].forEach(function (p) {
      points.appendChild(make("li", "", p[0], p[1]));
    });
    heroText.insertAdjacentElement("afterend", points);
  }

  /* Numbered steps on the check-in fields */
  var form = document.getElementById("coachForm");
  if (!form) return;
  form.classList.add("coach-form-steps");

  var type = document.getElementById("taskType");
  if (type && !form.querySelector(".coach-choices-type")) {
    var typeGroup = choiceGroup(en() ? "What are you working on?" : "Τι έχεις να κάνεις;",
      [{ value: "study", el: "Διάβασμα", en: "Studying" }, { value: "task", el: "Εργασία", en: "A task" }],
      type.value, function (v) { type.value = v; fire(type); });
    typeGroup.classList.add("coach-choices-type");
    type.insertAdjacentElement("afterend", typeGroup);
    type.classList.add("coach-native-hidden");
  }

  var energy = document.getElementById("coachEnergy");
  if (energy && !form.querySelector(".coach-choices-energy")) {
    var energyGroup = choiceGroup(en() ? "Energy / focus" : "Ενέργεια / συγκέντρωση", [
      { value: 1, el: "1 · κουρασμένος", en: "1 · drained" },
      { value: 2, el: "2", en: "2" },
      { value: 3, el: "3 · οκ", en: "3 · okay" },
      { value: 4, el: "4", en: "4" },
      { value: 5, el: "5 · γεμάτος", en: "5 · sharp" }
    ], energy.value, function (v) { energy.value = v; fire(energy); });
    energyGroup.classList.add("coach-choices-energy");
    var row = energy.closest(".coach-range-row");
    (row || energy).insertAdjacentElement("afterend", energyGroup);
    if (row) row.classList.add("coach-native-hidden");
  }

  var minutes = document.getElementById("coachMinutes");
  if (minutes && !form.querySelector(".coach-choices-minutes")) {
    var minuteGroup = choiceGroup(en() ? "Available time" : "Διαθέσιμος χρόνος",
      [15, 25, 45, 60, 90].map(function (m) { return { value: m, el: m + "′", en: m + "′" }; }),
      minutes.value, function (v) { minutes.value = v; fire(minutes); });
    minuteGroup.classList.add("coach-choices-minutes");
    minutes.insertAdjacentElement("beforebegin", minuteGroup);
    minutes.addEventListener("input", function () {
      minuteGroup.querySelectorAll(".coach-choice").forEach(function (o) { o.setAttribute("aria-pressed", String(o.dataset.value === minutes.value)); });
    });
  }
})();
