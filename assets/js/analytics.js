(() => {
  const EVENTS = new Set(["page_view","stage_selected","timer_started","timer_paused","timer_resumed","session_completed","quiz_started","quiz_completed","calendar_opened","login_started","library_searched","library_saved","whop_upsell_clicked"]);
  const ALLOWED_PROPERTIES = new Set(["stage","duration","result","section","item_id"]);
  const CONSENT_KEY = "nepsis-analytics-consent-v1";
  const POSTHOG_PROJECT_TOKEN = "phc_wSd6sLNCj3UjGVo82Ti8rWCdt4CS7T755jm3TKus7VKt"; // Add the public phc_ project token for the staging project. Never use a personal API key.
  const POSTHOG_API_HOST = "https://eu.i.posthog.com";
  const UMAMI_WEBSITE_ID = "93c6f050-e568-4aba-940d-8fa16c80cdcc";
  const host = window.location.hostname.toLowerCase();
  const isPreviewHost = /^deploy-preview-\d+--nepsis-focus\.netlify\.app$/.test(host);
  const isProductionHost = host === "nepsis-focus.github.io";
  let umamiScript = null;

  // ===== ΝΕΟ: Telemetry constants =====
  const SUPABASE_URL = "https://emhukqvetlhjgadgskbl.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_sdWqagLvXYQsmveUrmmw9g_neLoRMCl";
  const ANON_ID_KEY = "nepsis-anon-id";
  const SESSION_ID_KEY = "nepsis-session-id";

  // Κατάσταση tracking (μόνο στη μνήμη)
  const telemetryState = {
    startTime: Date.now(), maxScroll: 0, lastSection: "", lastClick: "",
    sessionId: null, anonId: null, userId: null, accessToken: null,
    identityLinkPending: false, trackingStarted: false
  };

  function getOrCreateId(key, storage) {
    try {
      let id = storage.getItem(key);
      if (!id) {
        id = crypto.randomUUID();
        storage.setItem(key, id);
      }
      return id;
    } catch (_) {
      return "fallback-" + Math.random().toString(36).slice(2);
    }
  }

  function initTelemetryIds() {
    telemetryState.anonId = getOrCreateId(ANON_ID_KEY, localStorage);
    telemetryState.sessionId = getOrCreateId(SESSION_ID_KEY, sessionStorage);
  }

  function updateScrollDepth() {
    const scrolled = window.scrollY + window.innerHeight;
    const total = Math.max(document.documentElement.scrollHeight, 1);
    const percent = Math.min(100, Math.round((scrolled / total) * 100));
    if (percent > telemetryState.maxScroll) telemetryState.maxScroll = percent;
  }

  function updateLastSection() {
    const sections = document.querySelectorAll("section[id], main > section, [data-section]");
    let best = "";
    let bestRatio = 0;
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const ratio = visible / Math.max(rect.height, 1);
      if (ratio > bestRatio && ratio > 0.3) {
        bestRatio = ratio;
        best = sec.id || sec.getAttribute("data-section") || sec.tagName.toLowerCase();
      }
    });
    if (best) telemetryState.lastSection = best;
  }

  function updateLastClick(target) {
    if (!target || typeof target.closest !== "function") return;
    const el = target.closest("a, button, [data-telemetry-label], [data-whop-upsell]") || target;
    const info = el.id || el.getAttribute("data-telemetry-label") || el.getAttribute("data-whop-upsell") || el.tagName;
    telemetryState.lastClick = String(info || "control").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 80);
  }

  function buildPayload(eventType) {
    const timeOnPage = Math.round((Date.now() - telemetryState.startTime) / 1000);
    return {
      anon_id: telemetryState.anonId,
      session_id: telemetryState.sessionId,
      event_type: eventType,
      page: location.pathname,
      section: telemetryState.lastSection || pageSection(),
      scroll_depth: telemetryState.maxScroll,
      time_on_page: timeOnPage,
      last_click: telemetryState.lastClick,
      properties: { host: host }
    };
  }

  function flushIdentityLink() {
    if (!telemetryState.identityLinkPending || !telemetryState.userId || !telemetryState.anonId || readConsent() !== "granted") return;
    telemetryState.identityLinkPending = false;
    sendTelemetry("identity_linked");
  }

  function setIdentity(userId, accessToken) {
    const nextUserId = typeof userId === "string" ? userId.trim() : "";
    if (!nextUserId) return clearIdentity();
    if (telemetryState.userId !== nextUserId) telemetryState.identityLinkPending = true;
    telemetryState.userId = nextUserId;
    if (typeof accessToken === "string" && accessToken) telemetryState.accessToken = accessToken;
    flushIdentityLink();
    return true;
  }

  function clearIdentity() {
    telemetryState.userId = null;
    telemetryState.accessToken = null;
    telemetryState.identityLinkPending = false;
    return true;
  }

  function sendTelemetry(eventType, useKeepalive = false) {
    if (readConsent() !== "granted" || !telemetryState.anonId) return;
    const payload = buildPayload(eventType);
    if (telemetryState.userId) payload.user_id = telemetryState.userId;
    const body = JSON.stringify(payload);
    if (body.length > 60000) return;
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + (telemetryState.accessToken || SUPABASE_ANON_KEY),
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    };
    try { fetch(SUPABASE_URL + "/rest/v1/site_telemetry", { method: "POST", headers, body, keepalive: useKeepalive }).catch(() => {}); }
    catch (_) {}
  }

  function setupTelemetryTracking() {
    if (telemetryState.trackingStarted) return;
    telemetryState.trackingStarted = true;
    initTelemetryIds();
    updateScrollDepth();
    updateLastSection();
    flushIdentityLink();
    let scrollTimer;
    window.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { updateScrollDepth(); updateLastSection(); }, 150);
    }, { passive: true });
    document.addEventListener("click", e => updateLastClick(e.target), true);
    let exitSentForVisibilityCycle = false;
    const sendExit = () => {
      if (exitSentForVisibilityCycle) return;
      exitSentForVisibilityCycle = true;
      clearTimeout(scrollTimer);
      updateScrollDepth();
      updateLastSection();
      sendTelemetry("exit", true);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") sendExit();
      else exitSentForVisibilityCycle = false;
    });
    window.addEventListener("pagehide", sendExit);
    sendTelemetry("page_enter");
  }


  function readConsent() {
    try { const value=localStorage.getItem(CONSENT_KEY); return value==="granted"||value==="denied"?value:null; }
    catch (_) { return null; }
  }
  function saveConsent(value) {
    try { localStorage.setItem(CONSENT_KEY,value); return true; }
    catch (_) { return false; }
  }
  function pageSection() {
    const last=window.location.pathname.split("/").filter(Boolean).pop()||"index";
    return last.replace(/\.html?$/i,"").replace(/[^a-z0-9_-]/gi,"").toLowerCase()||"index";
  }
  function safeProperties(properties) {
    const safe={};
    if(!properties||typeof properties!=="object"||Array.isArray(properties)) return safe;
    for(const [key,value] of Object.entries(properties)) {
      if(!ALLOWED_PROPERTIES.has(key)) continue;
      if(typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=3600) safe[key]=value;
      else if(typeof value==="boolean") safe[key]=value;
      else if(typeof value==="string"&&value.length<=80&&/^[a-zA-Z0-9_.-]+$/.test(value)) safe[key]=value;
    }
    return safe;
  }
  function loadUmami() {
    if(umamiScript||document.querySelector('script[data-nepsis-provider="umami"]')) return;
    umamiScript=document.createElement("script");
    umamiScript.defer=true;
    umamiScript.src="https://cloud.umami.is/script.js";
    umamiScript.dataset.websiteId=UMAMI_WEBSITE_ID;
    umamiScript.dataset.nepsisProvider="umami";
    document.head.appendChild(umamiScript);
  }
  function installPostHogStub() {
    if(window.posthog&&window.posthog.__SV) return;
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="capture opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing identify reset register register_once unregister get_distinct_id get_session_id get_session_replay_url startSessionRecording stopSessionRecording sessionRecordingStarted on setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags group resetGroups getGroups debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  }
  function loadPostHog() {
    if(!POSTHOG_PROJECT_TOKEN||!POSTHOG_PROJECT_TOKEN.startsWith("phc_")) return false;
    installPostHogStub();
    window.posthog.init(POSTHOG_PROJECT_TOKEN,{
      api_host:POSTHOG_API_HOST,defaults:"2026-08-30",capture_pageview:false,autocapture:false,
      disable_session_recording:true,opt_out_capturing_by_default:true,person_profiles:"never"
    });
    window.posthog.opt_in_capturing({captureEventName:false});
    return true;
  }
  function startAnalytics() {
    if(readConsent()!=="granted") return;
    if(isPreviewHost) { if(loadPostHog()) window.nepsisAnalytics.track("page_view",{section:pageSection()}); }
    else if(isProductionHost) loadUmami();
    // Νέο: ξεκίνα και το telemetry
    setupTelemetryTracking();
  }

  window.nepsisAnalytics=Object.freeze({
    events:Object.freeze([...EVENTS]),
    setIdentity(userId, accessToken) { return setIdentity(userId, accessToken); },
    clearIdentity() { return clearIdentity(); },
    track(name,properties={}) {
      if(!EVENTS.has(name)) return false;
      const safe=safeProperties(properties);
      window.dispatchEvent(new CustomEvent("nepsis:analytics",{detail:{name,properties:safe}}));
      if(readConsent()==="granted"&&isPreviewHost&&window.posthog&&typeof window.posthog.capture==="function") window.posthog.capture(name,safe);
      // Νέο: στείλε και στο Supabase αν είναι βασικό event
      if (readConsent() === "granted" && (name === "page_view" || name === "session_completed")) {
        sendTelemetry(name);
      }
      return true;
    }
  });

  const copy={
    el:{title:"Προαιρετικά στατιστικά χρήσης",body:"Με τη συγκατάθεσή σου, καταγράφουμε ένα τυχαίο αναγνωριστικό επισκέπτη, τις σελίδες, το μέγιστο βάθος κύλισης, την τελευταία ενότητα και το τελευταίο κουμπί. Αν συνδεθείς, συνδέουμε αυτά τα στατιστικά με το user ID του λογαριασμού σου στο Supabase. Δεν στέλνουμε email, περιεχόμενο ημερολογίου ή κείμενο αναζήτησης. Η καταγραφή συνεδριών είναι απενεργοποιημένη· μπορείς να αλλάξεις την επιλογή σου οποτεδήποτε.",accept:"Αποδοχή",reject:"Απόρριψη",manage:"Ρυθμίσεις analytics",privacy:"Πολιτική απορρήτου"},
    en:{title:"Optional usage analytics",body:"With your consent, we record a random visitor ID, pages, maximum scroll depth, the last section and the last button. If you sign in, we link these analytics to your Supabase account user ID. We do not send your email, diary content or search text. Session recording is disabled; you can change your choice at any time.",accept:"Allow analytics",reject:"Reject",manage:"Analytics settings",privacy:"Privacy policy"}
  };
  function language() {
    try { if(localStorage.getItem("nepsis-lang")==="en") return "en"; } catch (_) {}
    return document.documentElement.lang==="en"?"en":"el";
  }

  const style=document.createElement("style");
  style.textContent=`
    .nepsis-consent-panel{position:fixed;z-index:12000;left:50%;bottom:20px;transform:translateX(-50%);width:min(620px,calc(100vw - 28px));padding:20px 22px;background:var(--card,#fffaf3);color:var(--fg,#3a2418);border:1px solid var(--border,#eadccb);border-radius:18px;box-shadow:0 18px 60px rgba(40,28,20,.2);font:inherit}
    .nepsis-consent-panel[hidden],.nepsis-consent-settings[hidden]{display:none}
    .nepsis-consent-panel h2{margin:0 0 8px;font-size:1.05rem;line-height:1.3}
    .nepsis-consent-panel p{margin:0;font-size:.9rem;line-height:1.55}
    .nepsis-consent-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:15px}
    .nepsis-consent-actions button,.nepsis-consent-settings{min-height:40px;padding:9px 15px;border:1px solid var(--border,#eadccb);border-radius:999px;background:transparent;color:inherit;font:inherit;font-size:.88rem;font-weight:700;cursor:pointer}
    .nepsis-consent-actions .primary{background:#F0702A;border-color:#F0702A;color:#1d1d1f}
    .nepsis-consent-actions a{margin-left:auto;color:#B8501A;font-size:.85rem;text-underline-offset:3px}
    .nepsis-consent-actions button:focus-visible,.nepsis-consent-settings:focus-visible,.nepsis-consent-actions a:focus-visible,.nepsis-analytics-link:focus-visible{outline:3px solid #9A3F14;outline-offset:3px}
    .nepsis-consent-settings{display:none!important}
    @media(max-width:520px){
      .nepsis-consent-panel{
        left:max(12px,env(safe-area-inset-left,0px));
        right:max(12px,env(safe-area-inset-right,0px));
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        width:auto;
        max-width:none;
        transform:none;
        padding:16px;
      }
      .nepsis-consent-actions a{margin-left:0;width:100%}
    }
    @media(prefers-reduced-motion:no-preference){
      .nepsis-consent-panel{animation:nepsis-consent-in .25s ease-out both}
      @keyframes nepsis-consent-in{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
    }
    @media(max-width:520px) and (prefers-reduced-motion:no-preference){
      .nepsis-consent-panel{animation:nepsis-consent-in-mobile .25s ease-out both}
      @keyframes nepsis-consent-in-mobile{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    }
  `;
  document.head.appendChild(style);

  const panel=document.createElement("section");
  panel.className="nepsis-consent-panel";panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","false");
  panel.setAttribute("aria-labelledby","nepsis-consent-title");panel.setAttribute("aria-describedby","nepsis-consent-copy");
  const heading=document.createElement("h2");heading.id="nepsis-consent-title";
  const paragraph=document.createElement("p");paragraph.id="nepsis-consent-copy";
  const actions=document.createElement("div");actions.className="nepsis-consent-actions";
  const accept=document.createElement("button");accept.type="button";accept.className="primary";
  const reject=document.createElement("button");reject.type="button";
  const privacy=document.createElement("a");privacy.href="privacy.html#analytics-consent";
  actions.append(accept,reject,privacy);panel.append(heading,paragraph,actions);
  const settings=document.createElement("button");settings.type="button";settings.className="nepsis-consent-settings";settings.hidden=true;settings.setAttribute("aria-haspopup","dialog");
  document.body.append(panel,settings);

  function makeAnalyticsLink() {
    const button=document.createElement("button");
    button.type="button";
    button.className="nepsis-analytics-link";
    button.hidden=true;
    button.setAttribute("aria-haspopup","dialog");
    button.dataset.nepsisAnalyticsSettings="1";
    button.addEventListener("click",showPanel);
    return button;
  }
  function ensureAltTriggers() {
    const drawer=document.getElementById("drawer");
    if(drawer && !drawer.querySelector("[data-nepsis-analytics-settings]")) {
      const close=drawer.querySelector(".close, .nepsis-drawer-close");
      const link=makeAnalyticsLink();
      if(close && close.nextSibling) drawer.insertBefore(link, close.nextSibling);
      else drawer.append(link);
    }
    const footHosts=document.querySelectorAll("footer .foot > span:last-child, footer .foot, footer");
    const foot=footHosts[0];
    if(foot && !foot.querySelector("[data-nepsis-analytics-settings]")) {
      const link=makeAnalyticsLink();
      if(foot.childNodes.length) foot.append(document.createTextNode(" · "), link);
      else foot.append(link);
    }
  }
  function syncAltTriggers(visible) {
    ensureAltTriggers();
    const text=copy[language()].manage;
    document.querySelectorAll("[data-nepsis-analytics-settings]").forEach(el=>{
      el.hidden=!visible;
      el.textContent=text;
    });
  }
  function renderLanguage() {
    const text=copy[language()];
    heading.textContent=text.title;paragraph.textContent=text.body;accept.textContent=text.accept;reject.textContent=text.reject;
    privacy.textContent=text.privacy;settings.textContent=text.manage;
    document.querySelectorAll("[data-nepsis-analytics-settings]").forEach(el=>{ el.textContent=text.manage; });
  }
  function showPanel() { renderLanguage();panel.hidden=false;settings.hidden=true;syncAltTriggers(false);accept.focus(); }
  function hidePanel() { panel.hidden=true;settings.hidden=true;syncAltTriggers(true); }
  function choose(value) {
    const previous=readConsent();
    if(!saveConsent(value)) {
      renderLanguage();
      paragraph.textContent=language()==="el"?"Δεν ήταν δυνατή η αποθήκευση της επιλογής σου σε αυτή τη συσκευή. Τα analytics παραμένουν απενεργοποιημένα.":"Your choice could not be saved on this device. Analytics will remain disabled.";
      return;
    }
    if(value==="denied") {
      if(window.posthog&&typeof window.posthog.opt_out_capturing==="function") window.posthog.opt_out_capturing();
      const loadedUmami=document.querySelector('script[data-nepsis-provider="umami"]');if(loadedUmami)loadedUmami.remove();
      hidePanel();if(previous==="granted")window.location.reload();return;
    }
    hidePanel();startAnalytics();
  }
  accept.addEventListener("click",()=>choose("granted"));
  reject.addEventListener("click",()=>choose("denied"));
  settings.addEventListener("click",showPanel);
  document.querySelectorAll("[data-lang], [data-set-lang]").forEach(button=>button.addEventListener("click",()=>window.setTimeout(renderLanguage,0)));
  document.addEventListener("click",event=>{
    if(event.target.closest("#accBtn, #accountBtn, #googleSignIn, #drawerAccBtn")) window.nepsisAnalytics.track("login_started",{section:pageSection()});
    const whop=event.target.closest("[data-whop-upsell]");
    if(whop) window.nepsisAnalytics.track("whop_upsell_clicked",{section:pageSection(),item_id:whop.getAttribute("data-whop-upsell")||"whop"});
  });

  function refreshTriggers() {
    const value=readConsent();
    if(value==="granted"||value==="denied") syncAltTriggers(true);
    else syncAltTriggers(false);
  }
  ensureAltTriggers();
  const consent=readConsent();
  if(consent==="granted"){settings.hidden=true;renderLanguage();syncAltTriggers(true);startAnalytics();}
  else if(consent==="denied"){settings.hidden=true;renderLanguage();syncAltTriggers(true);}
  else { syncAltTriggers(false); showPanel(); }
  // Drawer/footer may mount after this script — refresh a few times.
  [50, 250, 1000].forEach(function(ms){ window.setTimeout(refreshTriggers, ms); });
})();
