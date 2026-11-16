(function (global) {
  "use strict";

  var POPUP_NAME = "nepsis-google-oauth";
  var POPUP_FEATURES = "width=520,height=720,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes";
  var IDLE_LABEL = { el: "Συνέχεια με Google", en: "Continue with Google" };
  var LOADING_LABEL = {
    el: "Το Nepsis ετοιμάζει την ασφαλή συνεδρία…",
    en: "Nepsis is preparing your secure session…"
  };
  var authWatchers = typeof WeakSet === "function" ? new WeakSet() : null;
  var activeSession = null;

  function langKey(lang) { return lang === "en" ? "en" : "el"; }
  function idleLabel(lang) { return IDLE_LABEL[langKey(lang)]; }
  function loadingLabel(lang) { return LOADING_LABEL[langKey(lang)]; }

  function labelNode(button) {
    if (!button) return null;
    return button.querySelector("[data-oauth-label]") || button.querySelector("#accGoogleLabel") || button.querySelector("#googleSignInLabel") || null;
  }

  function ensureSpinner(button) {
    if (!button || button.querySelector(".nepsis-oauth-spinner")) return;
    var spinner = document.createElement("span");
    spinner.className = "nepsis-oauth-spinner";
    spinner.setAttribute("aria-hidden", "true");
    var label = labelNode(button);
    if (label) button.insertBefore(spinner, label);
    else button.appendChild(spinner);
  }

  function setButtonLoading(button, loading, lang) {
    if (!button) return;
    ensureSpinner(button);
    button.dataset.oauthBusy = loading ? "1" : "0";
    button.classList.toggle("is-oauth-loading", !!loading);
    button.disabled = !!loading;
    button.setAttribute("aria-busy", loading ? "true" : "false");
    var label = labelNode(button);
    var text = loading ? loadingLabel(lang) : idleLabel(lang);
    if (label) label.textContent = text;
    else if (!loading) button.textContent = text;
  }

  function injectAuthStyles() {
    if (document.getElementById("nepsis-auth-feedback-styles")) return;
    var style = document.createElement("style");
    style.id = "nepsis-auth-feedback-styles";
    style.textContent = [
      ".nepsis-auth-state{display:inline-flex;align-items:center;gap:6px;max-width:210px;padding:7px 10px;border:1px solid rgba(75,125,83,.28);border-radius:999px;background:rgba(102,145,98,.1);color:#426647;font:800 .76rem/1.2 Nunito,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".nepsis-auth-state[hidden]{display:none!important}",
      ".nepsis-auth-state-mark{display:grid;place-items:center;width:17px;height:17px;flex:0 0 17px;border-radius:50%;background:#668f62;color:#fff;font-size:.68rem}",
      "html[data-theme=dark] .nepsis-auth-state{color:#c5dfbf;background:rgba(143,168,146,.12);border-color:rgba(143,168,146,.3)}",
      "html[data-theme=dark] .nepsis-auth-state-mark{background:#8fa892;color:#1a1512}",
      "@media(max-width:520px){.nepsis-auth-state{max-width:112px;padding:6px 7px;font-size:.68rem;gap:4px}.nepsis-auth-state-mark{width:15px;height:15px;flex-basis:15px}}",
      "@media(prefers-reduced-motion:reduce){#nepsis-auth-notice{transition:none!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function authButton() {
    return document.getElementById("accountBtn") || document.getElementById("accBtn");
  }

  function syncAnalyticsIdentity(session) {
    var analytics = global.nepsisAnalytics;
    if (!analytics) return;
    if (session && session.user && session.user.id && typeof analytics.setIdentity === "function") analytics.setIdentity(session.user.id, session.access_token || "");
    else if ((!session || !session.user) && typeof analytics.clearIdentity === "function") analytics.clearIdentity();
  }

  function updateSignedInIndicator(session, lang) {
    syncAnalyticsIdentity(session);
    var button = authButton();
    if (!button || !session || !session.user) return;
    activeSession = session;
    injectAuthStyles();
    var english = langKey(lang || document.documentElement.lang) === "en";
    var email = session.user.email || (english ? "Your account" : "Ο λογαριασμός σου");
    var label = english ? "My account" : "Ο λογαριασμός μου";
    var host = button.closest(".headright, .head-right") || button.parentElement;
    if (!host) return;

    if (!button.dataset.nepsisOriginalLabel) button.dataset.nepsisOriginalLabel = button.textContent.trim();
    button.dataset.nepsisSignedIn = "true";
    button.setAttribute("aria-label", (english ? "Account, signed in as " : "Λογαριασμός, συνδεδεμένος ως ") + email);
    button.title = (english ? "Signed in as " : "Συνδεδεμένος ως ") + email;
    if (!labelNode(button)) button.textContent = label;

    var badge = document.getElementById("nepsis-auth-state");
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "nepsis-auth-state";
      badge.className = "nepsis-auth-state";
      badge.setAttribute("role", "status");
      var mark = document.createElement("span");
      mark.className = "nepsis-auth-state-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "✓";
      var badgeLabel = document.createElement("span");
      badgeLabel.className = "nepsis-auth-state-label";
      badge.append(mark, badgeLabel);
      button.insertAdjacentElement("afterend", badge);
    }
    badge.querySelector(".nepsis-auth-state-label").textContent = english ? "Signed in" : "Συνδεδεμένος";
    badge.title = email;

    var who = document.getElementById("accWho") || document.getElementById("accountWho");
    if (who) who.textContent = email;
    var title = document.getElementById("accTitle") || document.getElementById("accountTitle");
    if (title) title.textContent = english ? "You’re signed in" : "Συνδέθηκες επιτυχώς";
  }

  function clearSignedInIndicator() {
    syncAnalyticsIdentity(null);
    activeSession = null;
    var badge = document.getElementById("nepsis-auth-state");
    if (badge) badge.remove();
    var button = authButton();
    if (!button) return;
    if (button.dataset.nepsisSignedIn === "true") {
      var original = button.dataset.nepsisOriginalLabel || idleLabel(document.documentElement.lang);
      if (!labelNode(button)) button.textContent = original;
    }
    delete button.dataset.nepsisSignedIn;
    button.removeAttribute("title");
    button.removeAttribute("aria-label");
  }

  function announceSignedIn(session, lang) {
    if (!session || !session.user || !document.body) return;
    updateSignedInIndicator(session, lang);
    injectAuthStyles();
    var english = langKey(lang || document.documentElement.lang) === "en";
    var email = session.user.email || (english ? "your account" : "τον λογαριασμό σου");
    var toast = document.getElementById("nepsis-auth-notice");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "nepsis-auth-notice";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.style.cssText = "position:fixed;z-index:99999;left:50%;bottom:22px;transform:translate(-50%,12px);max-width:calc(100vw - 32px);padding:13px 18px;border:1px solid rgba(185,85,42,.28);border-radius:16px;background:var(--card,#fffaf4);color:var(--fg,#3a2418);box-shadow:0 18px 42px -24px rgba(58,36,24,.5);font:700 .94rem/1.45 Nunito,system-ui,sans-serif;opacity:0;transition:opacity .25s ease,transform .25s ease";
      document.body.appendChild(toast);
    }
    toast.textContent = english ? "Signed in successfully · " + email : "Συνδέθηκες επιτυχώς · " + email;
    global.requestAnimationFrame(function () {
      toast.style.opacity = "1";
      toast.style.transform = "translate(-50%,0)";
    });
    global.clearTimeout(toast.__nepsisTimer);
    toast.__nepsisTimer = global.setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%,12px)";
    }, 5200);
  }

  function closeAccountDialogs() {
    ["accountModal", "accModal"].forEach(function (id) {
      var modal = document.getElementById(id);
      if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
    });
    var scrim = document.getElementById("accScrim");
    if (scrim) { scrim.classList.remove("open"); scrim.setAttribute("aria-hidden", "true"); }
    if (document.body) document.body.classList.remove("auth-modal-open");
    var opener = document.getElementById("accBtn") || document.getElementById("accountBtn");
    if (opener && typeof opener.focus === "function") opener.focus();
  }

  function openAuthPopup() {
    try { return global.open("about:blank", POPUP_NAME, POPUP_FEATURES); }
    catch (error) { return null; }
  }

  function navigatePopup(popup, url) {
    if (!popup || popup.closed) return false;
    try { popup.location.href = url; return true; }
    catch (error) { try { popup.close(); } catch (closeError) {} return false; }
  }

  function watchPopupCompletion(client) {
    if (!client || !client.auth) return;
    var inPopup = !!(global.opener && global.opener !== global);
    if (authWatchers && authWatchers.has(client)) return;
    if (authWatchers) authWatchers.add(client);

    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        clearSignedInIndicator();
        return;
      }
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        updateSignedInIndicator(session, document.documentElement.lang);
        if (event === "SIGNED_IN") {
          announceSignedIn(session, document.documentElement.lang);
          closeAccountDialogs();
        }
        if (inPopup) { try { global.close(); } catch (error) {} }
      }
    });

    client.auth.getSession().then(function (result) {
      if (result && result.data && result.data.session) {
        updateSignedInIndicator(result.data.session, document.documentElement.lang);
        if (inPopup) { try { global.close(); } catch (error) {} }
      }
    }).catch(function () {});

    if (document.getElementById("weekBars") && !document.querySelector('script[data-nepsis-chart-addon]')) {
      var chartAddon = document.createElement("script");
      chartAddon.src = "assets/js/pages/my-nepsis-chart.js";
      chartAddon.defer = true;
      chartAddon.dataset.nepsisChartAddon = "true";
      document.head.appendChild(chartAddon);
    }

    // Re-label the status badge if the user switches the site language.
    if (global.MutationObserver && !document.documentElement.dataset.nepsisAuthLangObserver) {
      document.documentElement.dataset.nepsisAuthLangObserver = "true";
      new MutationObserver(function () {
        if (activeSession) updateSignedInIndicator(activeSession, document.documentElement.lang);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }
  }

  function signIn(options) {
    var opts = options || {};
    var client = opts.client;
    var button = opts.button;
    var lang = opts.lang || "el";
    var onError = typeof opts.onError === "function" ? opts.onError : function () {};
    var onMessage = typeof opts.onMessage === "function" ? opts.onMessage : function () {};
    var redirectTo = opts.redirectTo || (global.location.origin + global.location.pathname);

    if (!client) { onError(new Error("missing-client")); return Promise.resolve({ ok: false, mode: "error" }); }
    if (button && button.dataset.oauthBusy === "1") return Promise.resolve({ ok: false, mode: "busy" });
    watchPopupCompletion(client);

    var popup = openAuthPopup();
    setButtonLoading(button, true, lang);
    onMessage("");

    return client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo, skipBrowserRedirect: true }
    }).then(function (result) {
      if (result.error || !result.data || !result.data.url) {
        if (popup && !popup.closed) { try { popup.close(); } catch (error) {} }
        setButtonLoading(button, false, lang);
        onError(result.error || new Error("oauth-url-missing"));
        return { ok: false, mode: "error" };
      }

      var url = result.data.url;
      if (navigatePopup(popup, url)) {
        var settled = false;
        var subscription = null;
        var poll = null;
        function cleanup(resetButton) {
          if (settled) return;
          settled = true;
          if (poll) clearInterval(poll);
          if (subscription && typeof subscription.unsubscribe === "function") subscription.unsubscribe();
          if (resetButton) {
            setButtonLoading(button, false, lang);
            onMessage("");
          }
        }
        var authListener = client.auth.onAuthStateChange(function (event, session) {
          if (event === "SIGNED_IN" && session) {
            if (popup && !popup.closed) { try { popup.close(); } catch (error) {} }
            cleanup(true);
          }
        });
        subscription = authListener && authListener.data ? authListener.data.subscription : null;
        poll = setInterval(function () {
          if (!popup || popup.closed) {
            client.auth.getSession().then(function (result) {
              if (result && result.data && result.data.session) {
                announceSignedIn(result.data.session, lang);
                closeAccountDialogs();
              }
            }).catch(function () {}).finally(function () { cleanup(true); });
          }
        }, 400);
        return { ok: true, mode: "popup" };
      }

      global.location.assign(url);
      return { ok: true, mode: "redirect" };
    }).catch(function (error) {
      if (popup && !popup.closed) { try { popup.close(); } catch (closeError) {} }
      setButtonLoading(button, false, lang);
      onError(error);
      return { ok: false, mode: "error" };
    });
  }

  global.NepsisGoogleAuth = {
    idleLabel: idleLabel,
    loadingLabel: loadingLabel,
    setButtonLoading: setButtonLoading,
    watchPopupCompletion: watchPopupCompletion,
    signIn: signIn
  };
})(window);
