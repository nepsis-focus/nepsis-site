/* Coach-only menu drawer behavior; form controls remain native and single-source. */
(function () {
  var drawer = document.getElementById("drawer");
  var button = document.getElementById("menuBtn");
  var scrim = document.getElementById("scrim");
  var close = document.getElementById("closeBtn");
  if (!drawer || !button) return;

  drawer.inert = true;
  drawer.tabIndex = -1;
  function setOpen(open) {
    drawer.classList.toggle("open", open);
    if (scrim) scrim.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    drawer.inert = !open;
    button.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    if (open) drawer.focus({ preventScroll: true });
    else button.focus();
  }
  button.addEventListener("click", function () {
    setOpen(!drawer.classList.contains("open"));
  });
  if (scrim) scrim.addEventListener("click", function () { setOpen(false); });
  if (close) close.addEventListener("click", function () { setOpen(false); });
  drawer.addEventListener("click", function (event) {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && drawer.classList.contains("open")) setOpen(false);
  });
})();
