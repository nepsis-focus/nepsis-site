/* Shows the welcome window on the home page. The red button hides it for this visit only. */
(() => {
  const win = document.getElementById("welcomeWindow");
  const close = win?.querySelector(".welcome-window__close");
  if (!win || !close) return;
  const hide = () => {
    win.classList.add("is-leaving");
    window.setTimeout(() => { win.hidden = true; }, 250);
  };
  close.addEventListener("click", hide);
  win.hidden = false;
})();
