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

  function showLoginNotice(session, lang, announce) {
    var user = session && session.user;
    if (!user || !global.document || !document.body) return;
    var english = langKey(lang || document.documentElement.lang) === "en";
    var email = user.email || "";
    var display = email || (english ? "Your account" : "Ο λογαριασμός σου");

    // Keep the existing account controls, but make the authenticated state explicit.
    ["accountBtn", "accBtn"].forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) return;
      button.dataset.nepsisSignedIn = "true";
      button.setAttribute("aria-label", (english ? "Signed in as " : "Συνδεδεμένος ως ") + display);
      button.title = (english ? "Signed in as " : "Συνδεδεμένος ως ") + display;
      var label = english ? "My account" : "Ο λογαριασμός μου";
      if (button.textContent !== label) button.textContent = label;
    });

    var accountTitle = document.getElementById("accountTitle");
    var accountCopy = document.getElementById("accountCopy");
    var accountWho = document.getElementById("accWho");
    if (accountTitle) accountTitle.textContent = english ? "You’re signed in" : "Συνδέθηκες επιτυχώς";
    if (accountCopy) accountCopy.textContent = display;
    if (accountWho) accountWho.textContent = display;

    if (announce) {
      var toast = document.getElementById("nepsis-auth-notice");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "nepsis-auth-notice";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.style.cssText = "position:fixed;z-index:99999;left:50%;bottom:22px;transform:translate(-50%,12px);max-width:calc(100vw - 32px);padding:13px 18px;border:1px solid rgba(185,85,42,.28);border-radius:16px;background:var(--card,#fffaf4);color:var(--fg,#3a2418);box-shadow:0 18px 42px -24px rgba(58,36,24,.5);font:700 .94rem/1.45 Nunito,system-ui,sans-serif;opacity:0;transition:opacity .25s ease,transform .25s ease";
        document.body.appendChild(toast);
      }
      toast.textContent = english ? "Signed in successfully · " + display : "Συνδέθηκες επιτυχώς · " + display;
      requestAnimationFrame(function () {
        toast.style.opacity = "1";
        toast.style.transform = "translate(-50%,0)";
      });
      global.clearTimeout(toast.__nepsisTimer);
      toast.__nepsisTimer = global.setTimeout(function () {
        toast.style.opacity = "0";
        toast.style.transform = "translate(-50%,12px)";
      }, 5200);
    }

    try {
      global.dispatchEvent(new CustomEvent("nepsis:auth", { detail: { user: user, signedIn: true } }));
    } catch (error) {}
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
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        showLoginNotice(session, document.documentElement.lang, event === "SIGNED_IN");
        if (inPopup) {
          try { global.close(); } catch (error) {}
        }
      }
    });

    client.auth.getSession().then(function (result) {
      if (result && result.data && result.data.session) {
        showLoginNotice(result.data.session, document.documentElement.lang, false);
        if (inPopup) { try { global.close(); } catch (error) {} }
      }
    }).catch(function () {});

    // The My Nepsis weekly chart is optional; the dashboard remains usable if its CDN is unavailable.
    if (document.getElementById("weekBars") && !document.querySelector('script[data-nepsis-chart-addon]')) {
      var chartAddon = document.createElement("script");
      chartAddon.src = "assets/js/pages/my-nepsis-chart.js";
      chartAddon.defer = true;
      chartAddon.dataset.nepsisChartAddon = "true";
      document.head.appendChild(chartAddon);
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
            showLoginNotice(session, lang, true);
            if (popup && !popup.closed) { try { popup.close(); } catch (error) {} }
            cleanup(true);
          }
        });
        subscription = authListener && authListener.data ? authListener.data.subscription : null;
        poll = setInterval(function () { if (!popup || popup.closed) cleanup(true); }, 400);
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
