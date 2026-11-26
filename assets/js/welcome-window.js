/* Full-screen hello on the home page. Show it once per site visit, then remember the dismissal for this tab. */
(() => {
  const splash = document.getElementById("welcomeSplash");
  if (!splash) return;

  const storageKey = "nepsis-welcome-seen-v1";
  let hasSeen = false;
  try {
    hasSeen = window.sessionStorage.getItem(storageKey) === "1";
  } catch (error) {}
  if (hasSeen) {
    splash.remove();
    return;
  }

  let open = true;
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  splash.hidden = false;
  splash.focus({ preventScroll: true });
  const dismiss = () => {
    if (!open) return;
    open = false;
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch (error) {}
    splash.classList.add("is-leaving");
    document.documentElement.style.overflow = prevOverflow;
    window.setTimeout(() => { splash.hidden = true; }, 350);
  };
  splash.addEventListener("click", dismiss);
  document.addEventListener("keydown", (e) => { if (open) { e.preventDefault(); dismiss(); } }, { once: true });
})();
