(() => {
  function text(options = {}) {
    const dialog = document.createElement("dialog");
    dialog.className = "nepsis-dialog";
    const form = document.createElement("form");
    form.method = "dialog";
    const title = document.createElement("h2");
    title.textContent = options.title || "";
    const input = document.createElement("input");
    input.type = options.type === "password" ? "password" : "text";
    input.value = options.value || "";
    input.maxLength = options.maxLength || 120;
    input.required = true;
    input.autocomplete = options.type === "password" ? "current-password" : "off";
    const actions = document.createElement("div");
    actions.className = "nepsis-dialog-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = options.cancel || "Cancel";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = options.submit || "Save";
    actions.append(cancel, submit);
    form.append(title, input, actions);
    dialog.append(form);
    document.body.append(dialog);
    return new Promise(resolve => {
      const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
      cancel.addEventListener("click", () => finish(null));
      dialog.addEventListener("cancel", event => { event.preventDefault(); finish(null); }, { once: true });
      form.addEventListener("submit", event => { event.preventDefault(); finish(input.value.trim()); });
      dialog.addEventListener("click", event => { if (event.target === dialog) finish(null); });
      dialog.addEventListener("close", () => dialog.remove(), { once: true });
      dialog.showModal();
      input.focus();
      input.select();
    });
  }
  window.NepsisDialogs = { text };
})();
