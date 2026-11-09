function setLang(l) {
    document.documentElement.lang = l;
    document.querySelectorAll("[data-" + l + "]").forEach(function (el) { el.textContent = el.dataset[l]; });
    document.querySelectorAll(".lang button").forEach(function (b) { b.classList.toggle("active", b.dataset.lang === l); });
  }
  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.lang); });
  });