/* Full-screen hello on the home page. Any tap, click or key closes it and shows the home screen. */
(() => {
  const splash = document.getElementById("welcomeSplash");
  if (!splash) return;
  let open = true;
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  splash.hidden = false;
  splash.focus({ preventScroll: true });

  const dismiss = () => {
    if (!open) return;
    open = false;
    splash.classList.add("is-leaving");
    document.documentElement.style.overflow = prevOverflow;
    window.setTimeout(() => { splash.hidden = true; }, 350);
  };
  splash.addEventListener("click", dismiss);
  document.addEventListener("keydown", (e) => { if (open) { e.preventDefault(); dismiss(); } }, { once: true });
})();
