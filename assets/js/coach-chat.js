/* Floating chat with the Nepsis Coach, available on the content pages.
   Talks to the ai-coach-chat Edge Function. Messages are kept only in this page
   and are sent after the visitor agrees; the agreement is remembered in this browser. */
(() => {
  "use strict";
  const ENDPOINT = "https://emhukqvetlhjgadgskbl.supabase.co/functions/v1/ai-coach-chat";
  const APIKEY = "sb_publishable_sdWqagLvXYQsmveUrmmw9g_neLoRMCl";
  const CONSENT_KEY = "nepsis-coach-chat-consent";
  const MAX_CHARS = 1000;
  const T = {
    el: {
      open: "Μίλα με τον coach", title: "Nepsis Coach", close: "Κλείσιμο",
      hello: "Γεια. Πες μου τι μελετάς ή πού κολλάς, και θα βρούμε ένα μικρό επόμενο βήμα.",
      consent: "Συμφωνώ να σταλούν τα μηνύματά μου στον AI coach για να πάρω απάντηση.",
      placeholder: "Γράψε μια ερώτηση για τη μελέτη σου…", send: "Στείλε", full: "Άνοιγμα πλήρους coach",
      needConsent: "Χρειάζεται η συγκατάθεσή σου για να σταλούν τα μηνύματα.",
      limit: "Έφτασες το ημερήσιο όριο των 10 μηνυμάτων. Μπορείς να συνεχίσεις αύριο.",
      busy: "Πολλά μηνύματα από αυτή τη σύνδεση. Περίμενε λίγα λεπτά.",
      error: "Κάτι δεν πήγε καλά. Δοκίμασε ξανά σε λίγο.",
      you: "Εσύ", coach: "Coach"
    },
    en: {
      open: "Talk to the coach", title: "Nepsis Coach", close: "Close",
      hello: "Hi. Tell me what you are studying or where you get stuck, and we will find one small next step.",
      consent: "I agree that my messages are sent to an AI coach so I can get an answer.",
      placeholder: "Write a question about your studying…", send: "Send", full: "Open the full coach",
      needConsent: "Your consent is needed before messages can be sent.",
      limit: "You have reached the daily limit of 10 messages. You can continue tomorrow.",
      busy: "Too many messages from this connection. Please wait a few minutes.",
      error: "Something went wrong. Please try again shortly.",
      you: "You", coach: "Coach"
    }
  };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "el");
  const tx = () => T[lang()];
  const here = (location.pathname.split("/").pop() || "index.html");
  if (here === "coach.html") return; // the full coach is already on this page

  const history = [];
  let busy = false;
  const consentGiven = () => { try { return localStorage.getItem(CONSENT_KEY) === "yes"; } catch (e) { return false; } };
  const rememberConsent = () => { try { localStorage.setItem(CONSENT_KEY, "yes"); } catch (e) { /* remembered for this page only */ } };

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.id = "coachChatLauncher";
  launcher.className = "cc-launcher";
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-controls", "coachChatPanel");
  launcher.setAttribute("aria-expanded", "false");

  const panel = document.createElement("section");
  panel.id = "coachChatPanel";
  panel.className = "cc-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.hidden = true;
  panel.innerHTML = [
    '<header class="cc-head"><strong class="cc-title"></strong><button type="button" class="cc-close" aria-label=""><span aria-hidden="true">✕</span></button></header>',
    '<div class="cc-log" role="log" aria-live="polite"></div>',
    '<label class="cc-consent" hidden><input type="checkbox" class="cc-consent-box"><span class="cc-consent-text"></span></label>',
    '<form class="cc-form" autocomplete="off"><textarea class="cc-input" rows="2" maxlength="' + MAX_CHARS + '"></textarea>',
    '<button type="submit" class="cc-send"></button></form>',
    '<p class="cc-status" role="status"></p>',
    '<a class="cc-full" href="coach.html"></a>'
  ].join("");
  const $ = (sel) => panel.querySelector(sel);
  const log = $(".cc-log"), form = $(".cc-form"), input = $(".cc-input"), status = $(".cc-status");
  const consentRow = $(".cc-consent"), consentBox = $(".cc-consent-box");

  function addBubble(role, text, extra) {
    const b = document.createElement("p");
    b.className = "cc-bubble cc-" + role + (extra ? " " + extra : "");
    b.textContent = text;
    log.append(b);
    log.scrollTop = log.scrollHeight;
  }
  function paint() {
    const t = tx();
    launcher.textContent = t.open;
    $(".cc-title").textContent = t.title;
    $(".cc-close").setAttribute("aria-label", t.close);
    $(".cc-consent-text").textContent = t.consent;
    input.placeholder = t.placeholder;
    input.setAttribute("aria-label", t.placeholder);
    $(".cc-send").textContent = t.send;
    $(".cc-full").textContent = t.full;
    panel.setAttribute("aria-label", t.title);
    consentRow.hidden = consentGiven();
  }
  function open() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    if (!log.childElementCount) addBubble("coach", tx().hello);
    (consentGiven() ? input : consentBox).focus();
  }
  function close() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  async function send(text) {
    const t = tx();
    if (!consentBox.checked && !consentGiven()) { status.textContent = t.needConsent; return; }
    if (!consentGiven()) rememberConsent();
    consentRow.hidden = true;
    history.push({ role: "user", content: text });
    addBubble("you", text);
    busy = true;
    status.textContent = "…";
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: APIKEY },
        body: JSON.stringify({ messages: history.slice(-10), language: lang(), consent: true })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 429) {
        history.pop();
        status.textContent = data.error === "ip_rate_limit_reached" ? t.busy : t.limit;
        return;
      }
      if (!response.ok) throw new Error(data.error || "error");
      if (data.crisis) {
        addBubble("coach", data.reply, "cc-alert");
        history.pop();
      } else {
        history.push({ role: "assistant", content: data.reply });
        addBubble("coach", data.reply);
      }
      status.textContent = "";
    } catch (e) {
      history.pop();
      status.textContent = t.error;
    } finally {
      busy = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    send(text);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
  });
  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
  $(".cc-close").addEventListener("click", close);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) close(); });
  document.addEventListener("nepsis:open-coach-chat", open);

  document.body.append(launcher, panel);
  paint();
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
