(function (global) {
  "use strict";

  var POPUP_NAME = "nepsis-google-oauth";
  var POPUP_FEATURES = "width=520,height=720,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes";
  var AUTH_STORAGE_KEY = "sb-emhukqvetlhjgadgskbl-auth-token";
  var OAUTH_PENDING_KEY = "nepsis-oauth-return";
  var IDLE_LABEL = { el: "Συνέχεια με Google", en: "Continue with Google" };
  var LOADING_LABEL = {
    el: "Το Nepsis ετοιμάζει την ασφαλή συνεδρία…",
    en: "Nepsis is preparing your secure session…"
  };
  var FAIL_LABEL = {
    el: "Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.",
    en: "Sign-in didn't complete. Please try again."
  };
  var authWatchers = typeof WeakSet === "function" ? new WeakSet() : null;
  var activeSession = null;
  var announcedTokens = Object.create(null);
  var returnSettled = false;
  var openerRecheckBound = false;
  var initialCallback = readAuthCallback(global.location && global.location.href);

  function langKey(lang) { return lang === "en" ? "en" : "el"; }
  function idleLabel(lang) { return IDLE_LABEL[langKey(lang)]; }
  function loadingLabel(lang) { return LOADING_LABEL[langKey(lang)]; }

  function sanitizeDetail(value) {
    return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  }

  function failureText(lang, detail) {
    var base = FAIL_LABEL[langKey(lang)];
    if (!detail) return base;
    var description = sanitizeDetail(detail.errorDescription);
    var code = sanitizeDetail(detail.error || detail.errorCode);
    if (description && code) return base + " (" + code + ": " + description + ")";
    if (description) return base + " " + description;
    if (code) return base + " (" + code + ")";
    return base;
  }

  // Same options on every page so the session survives index, practice, my-nepsis, and coach.
  // supabase-js 2.45.4 uses the implicit grant (#access_token). detectSessionInUrl reads that hash.
  // A PKCE ?code= return is exchanged in watchPopupCompletion when the verifier is present.
  function clientOptions() {
    return {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        flowType: "implicit",
        storageKey: AUTH_STORAGE_KEY
      }
    };
  }

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

  function resetBusyButtons() {
    if (!document.querySelectorAll) return;
    var buttons = document.querySelectorAll("[data-oauth-busy='1']");
    Array.prototype.forEach.call(buttons, function (button) {
      setButtonLoading(button, false, document.documentElement && document.documentElement.lang);
    });
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

  function showAuthNotice(text) {
    if (!text || !document.body) return;
    injectAuthStyles();
    var toast = document.getElementById("nepsis-auth-notice");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "nepsis-auth-notice";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.style.cssText = "position:fixed;z-index:99999;left:50%;bottom:22px;transform:translate(-50%,12px);max-width:calc(100vw - 32px);padding:13px 18px;border:1px solid rgba(185,85,42,.28);border-radius:16px;background:var(--card,#fffaf4);color:var(--fg,#3a2418);box-shadow:0 18px 42px -24px rgba(58,36,24,.5);font:700 .94rem/1.45 Nunito,system-ui,sans-serif;opacity:0;transition:opacity .25s ease,transform .25s ease";
      document.body.appendChild(toast);
    }
    toast.textContent = text;
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

  function announceSignedIn(session, lang) {
    if (!session || !session.user || !document.body) return;
    updateSignedInIndicator(session, lang);
    var english = langKey(lang || document.documentElement.lang) === "en";
    var email = session.user.email || (english ? "your account" : "τον λογαριασμό σου");
    showAuthNotice(english ? "Signed in successfully · " + email : "Συνδέθηκες επιτυχώς · " + email);
  }

  function announceOnce(session, lang) {
    if (!session || !session.user) return;
    var token = session.access_token || session.user.id || "signed-in";
    if (announcedTokens[token]) return;
    announcedTokens[token] = true;
    announceSignedIn(session, lang);
    closeAccountDialogs();
  }

  function announceSignInFailed(detail, lang) {
    showAuthNotice(failureText(lang || (document.documentElement && document.documentElement.lang), detail));
    resetBusyButtons();
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

  function readAuthCallback(href) {
    var empty = { present: false, code: "", accessToken: "", refreshToken: "", error: "", errorDescription: "", errorCode: "" };
    if (!href) return empty;
    try {
      var url = new URL(href, global.location && global.location.origin ? global.location.origin : undefined);
      var search = url.searchParams;
      var hashParams = new URLSearchParams(url.hash ? url.hash.replace(/^#/, "") : "");
      var callback = {
        code: search.get("code") || "",
        accessToken: hashParams.get("access_token") || search.get("access_token") || "",
        refreshToken: hashParams.get("refresh_token") || search.get("refresh_token") || "",
        error: search.get("error") || hashParams.get("error") || "",
        errorDescription: search.get("error_description") || hashParams.get("error_description") || "",
        errorCode: search.get("error_code") || hashParams.get("error_code") || ""
      };
      callback.present = !!(callback.code || callback.accessToken || callback.refreshToken || callback.error || callback.errorDescription || callback.errorCode);
      return callback;
    } catch (error) {
      return empty;
    }
  }

  function cleanAuthCallbackFromUrl() {
    if (!global.history || typeof global.history.replaceState !== "function" || !global.location) return;
    try {
      var url = new URL(global.location.href);
      ["code", "state", "error", "error_description", "error_code", "access_token", "refresh_token"].forEach(function (key) {
        url.searchParams.delete(key);
      });
      var hashParams = new URLSearchParams(url.hash ? url.hash.replace(/^#/, "") : "");
      var authHash = ["access_token", "refresh_token", "expires_in", "expires_at", "token_type", "provider_token", "provider_refresh_token", "type", "error", "error_code", "error_description"].some(function (key) {
        return hashParams.has(key);
      });
      if (authHash) url.hash = "";
      var next = url.pathname + url.search + url.hash;
      var current = global.location.pathname + global.location.search + global.location.hash;
      if (next !== current) global.history.replaceState(global.history.state, "", next);
    } catch (error) {}
  }

  function markOAuthPending() {
    try { global.sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify({ t: Date.now() })); } catch (error) {}
  }

  function readOAuthPending() {
    try { return !!global.sessionStorage.getItem(OAUTH_PENDING_KEY); } catch (error) { return false; }
  }

  function clearOAuthPending() {
    try { global.sessionStorage.removeItem(OAUTH_PENDING_KEY); } catch (error) {}
  }

  function prefersFullPageRedirect() {
    var nav = global.navigator || {};
    var ua = String(nav.userAgent || "");
    var platform = String(nav.platform || "");
    if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)) return true;
    if (platform === "MacIntel" && Number(nav.maxTouchPoints) > 1) return true;
    if (/Instagram|FBAN|FBAV|FB_IAB|FB4A|Line\/|Twitter|Snapchat|TikTok|Musical\.ly|LinkedInApp|Pinterest|MicroMessenger|WhatsApp|Telegram|GSA\/|CriOS|FxiOS|EdgiOS|DuckDuckGo/i.test(ua)) return true;
    if (/;\s*wv\)/.test(ua)) return true;
    try {
      if (global.matchMedia && global.matchMedia("(pointer: coarse)").matches && global.matchMedia("(hover: none)").matches) return true;
    } catch (error) {}
    return false;
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

  function sessionFromResult(result) {
    return result && result.data && result.data.session && result.data.session.user ? result.data.session : null;
  }

  function adoptSession(session, lang, fromReturn) {
    if (!session || !session.user) return false;
    updateSignedInIndicator(session, lang);
    if (fromReturn) {
      announceOnce(session, lang);
      clearOAuthPending();
      cleanAuthCallbackFromUrl();
      resetBusyButtons();
      returnSettled = true;
    }
    return true;
  }

  function finishAuthReturn(session, callback, pendingOnArrival) {
    var expecting = !!(callback && callback.present) || !!pendingOnArrival;
    if (!expecting) {
      if (session) updateSignedInIndicator(session, document.documentElement.lang);
      return;
    }
    if (returnSettled) return;
    returnSettled = true;
    if (session && session.user) {
      adoptSession(session, document.documentElement.lang, true);
      return;
    }
    announceSignInFailed(callback, document.documentElement.lang);
    clearOAuthPending();
    cleanAuthCallbackFromUrl();
  }

  function recoverSessionFromUrl(client, callback) {
    if (!client || !client.auth || !callback) return Promise.resolve(null);
    if (callback.code && !callback.error && !callback.errorDescription && typeof client.auth.exchangeCodeForSession === "function") {
      return client.auth.exchangeCodeForSession(callback.code).then(function (result) {
        return sessionFromResult(result);
      }).catch(function () { return null; });
    }
    if (callback.accessToken && callback.refreshToken && typeof client.auth.setSession === "function") {
      return client.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken }).then(function (result) {
        return sessionFromResult(result);
      }).catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  function recheckStoredSession(client) {
    if (!client || !client.auth || typeof client.auth.getSession !== "function") return;
    client.auth.getSession().then(function (result) {
      var session = sessionFromResult(result);
      if (!session) return;
      var button = authButton();
      var alreadyShown = !!(button && button.dataset && button.dataset.nepsisSignedIn === "true");
      var fromReturn = readOAuthPending() || !alreadyShown;
      adoptSession(session, document.documentElement.lang, fromReturn);
    }).catch(function () {});
  }

  function bindOpenerRecheck(client) {
    if (openerRecheckBound) return;
    openerRecheckBound = true;
    var timer = null;
    function schedule() {
      if (timer) global.clearTimeout(timer);
      timer = global.setTimeout(function () { recheckStoredSession(client); }, 50);
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.visibilityState || document.visibilityState === "visible") schedule();
    });
    global.addEventListener("focus", schedule);
    global.addEventListener("pageshow", function (event) {
      if (event && event.persisted) schedule();
      if (event && event.persisted && readOAuthPending()) {
        client.auth.getSession().then(function (result) {
          if (!sessionFromResult(result)) finishAuthReturn(null, readAuthCallback(global.location.href), true);
        }).catch(function () {});
      }
    });
    global.addEventListener("storage", function (event) {
      if (event && event.key && event.key !== AUTH_STORAGE_KEY && event.key.indexOf(AUTH_STORAGE_KEY) !== 0) return;
      schedule();
    });
  }

  function watchPopupCompletion(client) {
    if (!client || !client.auth) return;
    var inPopup = !!(global.opener && global.opener !== global);
    if (authWatchers && authWatchers.has(client)) return;
    if (authWatchers) authWatchers.add(client);
    var pendingOnArrival = readOAuthPending();
    var callback = initialCallback && initialCallback.present ? initialCallback : readAuthCallback(global.location && global.location.href);

    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        clearSignedInIndicator();
        return;
      }
      if (session && session.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        updateSignedInIndicator(session, document.documentElement.lang);
        if (event === "SIGNED_IN") {
          announceOnce(session, document.documentElement.lang);
          clearOAuthPending();
          resetBusyButtons();
          if ((callback && callback.present) || pendingOnArrival) {
            returnSettled = true;
            cleanAuthCallbackFromUrl();
          }
        }
        if (inPopup) { try { global.close(); } catch (error) {} }
      }
    });

    client.auth.getSession().then(function (result) {
      var session = sessionFromResult(result);
      if (session || returnSettled) {
        finishAuthReturn(session, callback, pendingOnArrival);
        return null;
      }
      return recoverSessionFromUrl(client, callback).then(function (recovered) {
        finishAuthReturn(recovered, callback, pendingOnArrival);
      });
    }).catch(function () {
      finishAuthReturn(null, callback, pendingOnArrival);
    });

    bindOpenerRecheck(client);

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

    function fail(error) {
      clearOAuthPending();
      setButtonLoading(button, false, lang);
      onError(error || new Error("oauth-failed"));
      return { ok: false, mode: "error" };
    }

    function beginSameTabRedirect() {
      setButtonLoading(button, true, lang);
      onMessage("");
      markOAuthPending();
      return client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo }
      }).then(function (result) {
        if (!result || result.error || !result.data || !result.data.url) return fail(result && result.error);
        try {
          if (!global.location || global.location.href !== result.data.url) global.location.assign(result.data.url);
        } catch (assignError) {}
        return { ok: true, mode: "redirect" };
      }).catch(function (error) { return fail(error); });
    }

    if (prefersFullPageRedirect()) return beginSameTabRedirect();

    var popup = openAuthPopup();
    if (!popup) return beginSameTabRedirect();

    setButtonLoading(button, true, lang);
    onMessage("");
    markOAuthPending();

    return client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo, skipBrowserRedirect: true }
    }).then(function (result) {
      if (!result || result.error || !result.data || !result.data.url) {
        if (popup && !popup.closed) { try { popup.close(); } catch (error) {} }
        return fail(result && result.error);
      }

      var url = result.data.url;
      if (!navigatePopup(popup, url)) {
        if (popup && !popup.closed) { try { popup.close(); } catch (error) {} }
        return beginSameTabRedirect();
      }

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
          client.auth.getSession().then(function (sessionResult) {
            var session = sessionFromResult(sessionResult);
            if (session) announceOnce(session, lang);
            else announceSignInFailed(null, lang);
            clearOAuthPending();
          }).catch(function () {
            announceSignInFailed(null, lang);
            clearOAuthPending();
          }).finally(function () { cleanup(true); });
        }
      }, 400);
      return { ok: true, mode: "popup" };
    }).catch(function (error) {
      if (popup && !popup.closed) { try { popup.close(); } catch (closeError) {} }
      return fail(error);
    });
  }

  global.NepsisGoogleAuth = {
    idleLabel: idleLabel,
    loadingLabel: loadingLabel,
    failureText: failureText,
    clientOptions: clientOptions,
    prefersFullPageRedirect: prefersFullPageRedirect,
    readAuthCallback: readAuthCallback,
    setButtonLoading: setButtonLoading,
    watchPopupCompletion: watchPopupCompletion,
    signIn: signIn
  };
})(window);
