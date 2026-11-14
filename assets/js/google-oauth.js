(function (global) {
  "use strict";

  var POPUP_NAME = "nepsis-google-oauth";
  var POPUP_FEATURES = "width=520,height=720,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes";
  var IDLE_LABEL = { el: "Συνέχεια με Google", en: "Continue with Google" };
  var LOADING_LABEL = {
    el: "Το Nepsis ετοιμάζει την ασφαλή συνεδρία…",
    en: "Nepsis is preparing your secure session…"
  };

  function langKey(lang) {
    return lang === "en" ? "en" : "el";
  }

  function idleLabel(lang) {
    return IDLE_LABEL[langKey(lang)];
  }

  function loadingLabel(lang) {
    return LOADING_LABEL[langKey(lang)];
  }

  function labelNode(button) {
    if (!button) return null;
    return button.querySelector("[data-oauth-label]") ||
      button.querySelector("#accGoogleLabel") ||
      button.querySelector("#googleSignInLabel") ||
      null;
  }

  function ensureSpinner(button) {
    if (!button) return;
    if (button.querySelector(".nepsis-oauth-spinner")) return;
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

  function openAuthPopup() {
    try {
      return global.open("about:blank", POPUP_NAME, POPUP_FEATURES);
    } catch (error) {
      return null;
    }
  }

  function navigatePopup(popup, url) {
    if (!popup || popup.closed) return false;
    try {
      popup.location.href = url;
      return true;
    } catch (error) {
      try { popup.close(); } catch (closeError) {}
      return false;
    }
  }

  function watchPopupCompletion(client) {
    if (!client || !global.opener || global.opener === global) return;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      try { global.close(); } catch (error) {}
    }
    client.auth.onAuthStateChange(function (event, session) {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        finish();
      }
    });
    client.auth.getSession().then(function (result) {
      if (result && result.data && result.data.session) finish();
    }).catch(function () {});
  }

  function signIn(options) {
    var opts = options || {};
    var client = opts.client;
    var button = opts.button;
    var lang = opts.lang || "el";
    var onError = typeof opts.onError === "function" ? opts.onError : function () {};
    var onMessage = typeof opts.onMessage === "function" ? opts.onMessage : function () {};
    var redirectTo = opts.redirectTo || (global.location.origin + global.location.pathname);

    if (!client) {
      onError(new Error("missing-client"));
      return Promise.resolve({ ok: false, mode: "error" });
    }
    if (button && button.dataset.oauthBusy === "1") {
      return Promise.resolve({ ok: false, mode: "busy" });
    }

    // Open under the user gesture so popup blockers stay quiet.
    var popup = openAuthPopup();
    setButtonLoading(button, true, lang);
    onMessage("");

    return client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo,
        skipBrowserRedirect: true
      }
    }).then(function (result) {
      if (result.error || !result.data || !result.data.url) {
        if (popup && !popup.closed) {
          try { popup.close(); } catch (error) {}
        }
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
            if (popup && !popup.closed) {
              try { popup.close(); } catch (error) {}
            }
            cleanup(true);
          }
        });
        subscription = authListener && authListener.data ? authListener.data.subscription : null;

        poll = setInterval(function () {
          if (!popup || popup.closed) cleanup(true);
        }, 400);

        return { ok: true, mode: "popup" };
      }

      // Popup blocked or failed — keep the spinner visible and redirect smoothly.
      global.location.assign(url);
      return { ok: true, mode: "redirect" };
    }).catch(function (error) {
      if (popup && !popup.closed) {
        try { popup.close(); } catch (closeError) {}
      }
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
