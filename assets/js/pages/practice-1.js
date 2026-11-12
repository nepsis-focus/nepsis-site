  let currentLang = "el";
  const $ = (id) => document.getElementById(id);

  // ---------- language ----------
  function setLang(l) {
    currentLang = l;
    document.documentElement.lang = l;
    document.querySelectorAll("[data-el]").forEach(function (el) {
      const v = el.dataset[l] || el.dataset.el;
      if (el.tagName === "H1" || el.classList.contains("hero-h1")) el.innerHTML = v; else el.textContent = v;
    });
    document.querySelectorAll(".lang button").forEach(function (b) { b.classList.toggle("active", b.dataset.lang === l); });
    renderSelect(); renderCalc(); renderGlobeMsg(); renderStageLabels(); renderParkLabels(); renderParkReview(); renderProgress(); buildQuiz(); if (currentMusicIdx !== null) playMusic(currentMusicIdx); if (currentAmbientIdx !== null) playAmbientPlaylist(currentAmbientIdx); renderAcc(""); updateTabTitle();
  }
  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.lang); });
  });
  // hero heading contains markup, so set it as HTML
  document.querySelectorAll("h1[data-el]").forEach(function (h) { h.innerHTML = h.dataset.el; });

  // ---------- menu ----------
  function setMenu(open) {
    $("drawer").classList.toggle("open", open);
    $("scrim").classList.toggle("open", open);
    $("menuBtn").setAttribute("aria-expanded", open ? "true" : "false");
  }
  $("menuBtn").addEventListener("click", function () { setMenu(true); });
  $("closeBtn").addEventListener("click", function () { setMenu(false); });
  $("scrim").addEventListener("click", function () { setMenu(false); });
  $("drawer").querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });

  // ---------- calculator (illustrative) ----------
  function renderCalc() {
    const min = Number($("calcMin").value);
    const hours = min * 30 / 60;
    $("calcBox").textContent = String(min);
    $("calcOut").textContent = hours.toString().replace(".", ",");
    $("calcFormula").textContent = currentLang === "el"
      ? min + " λεπτά × 30 ημέρες ÷ 60 = " + hours.toString().replace(".", ",") + " ώρες"
      : min + " min × 30 days ÷ 60 = " + hours + " hours";
  }
  $("calcMin").addEventListener("input", renderCalc);

  // ---------- interactive 3D Earth ----------
  const COUNTRIES = [
    { id: "GR", el: "Ελλάδα", en: "Greece", lat: 39, lon: 22 },
    { id: "CY", el: "Κύπρος", en: "Cyprus", lat: 35, lon: 33 },
    { id: "DE", el: "Γερμανία", en: "Germany", lat: 51, lon: 10 },
    { id: "FR", el: "Γαλλία", en: "France", lat: 46, lon: 2 },
    { id: "GB", el: "Ηνωμένο Βασίλειο", en: "United Kingdom", lat: 54, lon: -2 },
    { id: "IT", el: "Ιταλία", en: "Italy", lat: 42, lon: 12 },
    { id: "ES", el: "Ισπανία", en: "Spain", lat: 40, lon: -4 },
    { id: "TR", el: "Τουρκία", en: "Turkey", lat: 39, lon: 35 },
    { id: "EG", el: "Αίγυπτος", en: "Egypt", lat: 26, lon: 30 },
    { id: "US", el: "ΗΠΑ", en: "United States", lat: 39, lon: -98 },
    { id: "CA", el: "Καναδάς", en: "Canada", lat: 56, lon: -106 },
    { id: "BR", el: "Βραζιλία", en: "Brazil", lat: -10, lon: -55 },
    { id: "IN", el: "Ινδία", en: "India", lat: 21, lon: 78 },
    { id: "JP", el: "Ιαπωνία", en: "Japan", lat: 36, lon: 138 },
    { id: "AU", el: "Αυστραλία", en: "Australia", lat: -25, lon: 133 }
  ];
  const GLOBE_KEY = "nepsis-country";
  let globeApp = null;

  function selectedCountry() {
    const id = localStorage.getItem(GLOBE_KEY);
    return COUNTRIES.filter(function (c) { return c.id === id; })[0] || null;
  }
  function renderSelect() {
    const sel = $("countrySel");
    if (!sel) return;
    const current = sel.value || (selectedCountry() ? selectedCountry().id : "");
    sel.innerHTML = '<option value="">' + (currentLang === "el" ? "Επίλεξε χώρα..." : "Choose a country...") + '</option>' +
      COUNTRIES.map(function (c) { return '<option value="' + c.id + '">' + (currentLang === "el" ? c.el : c.en) + '</option>'; }).join("");
    sel.value = current;
  }
  function renderGlobeMsg() {
    const c = selectedCountry();
    const msg = $("globeMsg");
    if (!msg) return;
    if (!c) { msg.textContent = ""; return; }
    msg.textContent = currentLang === "el"
      ? "Επέλεξες: " + c.el + "."
      : "Selected: " + c.en + ".";
  }
  function initGlobe() {
    const canvas = $("globeCanvas");
    const stage = $("globeStage");
    if (!canvas || !stage || !window.THREE) {
      const msg = $("globeMsg");
      if (msg) msg.textContent = currentLang === "el" ? "Η υδρόγειος δεν είναι διαθέσιμη σε αυτόν τον browser." : "The globe is unavailable in this browser.";
      return;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, alpha: true, antialias: true, powerPreference: "high-performance"
      });
    } catch (error) {
      const msg = $("globeMsg");
      if (msg) msg.textContent = currentLang === "el" ? "Ο browser δεν υποστηρίζει 3D υδρόγειο." : "This browser does not support the 3D globe.";
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    camera.position.set(0, 0, 5.6);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);

    scene.add(new THREE.AmbientLight(0xb8cbe0, 0.82));
    const sunlight = new THREE.DirectionalLight(0xffffff, 1.42);
    sunlight.position.set(-3.8, 2.2, 4.8);
    scene.add(sunlight);
    const fillLight = new THREE.DirectionalLight(0x8bb9e2, 0.42);
    fillLight.position.set(4, -1.5, -3);
    scene.add(fillLight);

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    const radius = 2;
    const sphereGeometry = new THREE.SphereGeometry(radius, 96, 96);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff, specular: new THREE.Color(0x34495c), shininess: 10
    });
    const earth = new THREE.Mesh(sphereGeometry, earthMaterial);
    earthGroup.add(earth);

    const cloudMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.009, 96, 96), cloudMaterial);
    earthGroup.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.045, 96, 96),
      new THREE.MeshBasicMaterial({
        color: 0x62aee8, side: THREE.BackSide, transparent: true, opacity: 0.115, depthWrite: false
      })
    );
    earthGroup.add(atmosphere);

    const marker = new THREE.Group();
    const markerHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xf0702a, transparent: true, opacity: 0.28 })
    );
    const markerCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xf0702a })
    );
    marker.add(markerHalo, markerCore);
    marker.visible = false;
    earthGroup.add(marker);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg",
      function (texture) {
        if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
        earthMaterial.map = texture;
        earthMaterial.needsUpdate = true;
      },
      undefined,
      function () {
        const msg = $("globeMsg");
        if (msg && !selectedCountry()) msg.textContent = currentLang === "el" ? "Δεν φορτώθηκε η εικόνα της Γης. Έλεγξε τη σύνδεσή σου." : "Earth texture could not load. Check your connection.";
      }
    );
    loader.load("https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_normal_2048.jpg", function (texture) {
      earthMaterial.normalMap = texture;
      earthMaterial.normalScale = new THREE.Vector2(0.42, 0.42);
      earthMaterial.needsUpdate = true;
    });
    loader.load("https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png", function (texture) {
      if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
      cloudMaterial.map = texture;
      cloudMaterial.needsUpdate = true;
    });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let focusAnimation = null;
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    earthGroup.rotation.set(0.08, -112 * Math.PI / 180, 0);

    function latLonPosition(lat, lon, r) {
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    function focusCountry(country) {
      const point = latLonPosition(country.lat, country.lon, radius * 1.018);
      marker.position.copy(point);
      marker.visible = true;
      const targetX = country.lat * Math.PI / 180;
      const targetY = -(country.lon + 90) * Math.PI / 180;
      const startX = earthGroup.rotation.x;
      const startY = earthGroup.rotation.y;
      const deltaY = Math.atan2(Math.sin(targetY - startY), Math.cos(targetY - startY));
      const startedAt = performance.now();
      const duration = 950;
      focusAnimation = function (now) {
        const t = Math.min(1, (now - startedAt) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        earthGroup.rotation.x = startX + (targetX - startX) * ease;
        earthGroup.rotation.y = startY + deltaY * ease;
        if (t >= 1) focusAnimation = null;
      };
    }
    function clearCountry() { marker.visible = false; }

    function onPointerDown(event) {
      dragging = true;
      focusAnimation = null;
      velocityX = 0; velocityY = 0;
      lastX = event.clientX; lastY = event.clientY;
      canvas.style.cursor = "grabbing";
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    }
    function onPointerMove(event) {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX; lastY = event.clientY;
      velocityX = dx * 0.0048;
      velocityY = dy * 0.0048;
      earthGroup.rotation.y += velocityX;
      earthGroup.rotation.x = Math.max(-1.35, Math.min(1.35, earthGroup.rotation.x + velocityY));
    }
    function onPointerUp() {
      dragging = false;
      canvas.style.cursor = "grab";
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("lostpointercapture", onPointerUp);

    function resize() {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(resize);
      observer.observe(stage);
    } else {
      window.addEventListener("resize", resize);
    }
    resize();

    function animate() {
      requestAnimationFrame(animate);
      if (focusAnimation) focusAnimation(performance.now());
      if (!dragging) {
        if (Math.abs(velocityX) > 0.00004 || Math.abs(velocityY) > 0.00004) {
          earthGroup.rotation.y += velocityX;
          earthGroup.rotation.x = Math.max(-1.35, Math.min(1.35, earthGroup.rotation.x + velocityY));
          velocityX *= 0.94; velocityY *= 0.94;
        } else if (!reducedMotion && !focusAnimation) {
          earthGroup.rotation.y += 0.00022;
        }
      }
      clouds.rotation.y += 0.00012;
      renderer.render(scene, camera);
    }
    animate();

    globeApp = {
      focusCountry: focusCountry,
      clearCountry: clearCountry
    };
    window.nepsisGlobe = globeApp;

    const savedCountry = selectedCountry();
    if (savedCountry) focusCountry(savedCountry);
  }

  $("countrySel").addEventListener("change", function (event) {
    const country = COUNTRIES.filter(function (item) { return item.id === event.target.value; })[0];
    if (country) {
      localStorage.setItem(GLOBE_KEY, country.id);
      if (globeApp) globeApp.focusCountry(country);
    } else {
      localStorage.removeItem(GLOBE_KEY);
      if (globeApp) globeApp.clearCountry();
    }
    renderGlobeMsg();
  });

  renderSelect();
  renderGlobeMsg();
  initGlobe();

  // ---------- server-verified focus timers ----------
  const STAGES = [
    { min: 5,  el: "Ξεκίνημα", en: "Start",    d: "Ένα μικρό, εύκολο βήμα για να πάρεις μπρος.", de: "A small, easy step to get you started." },
    { min: 10, el: "Ζέσταμα",  en: "Warm-up",  d: "Μάθε να μένεις σε μία εργασία.", de: "Learn to stay with one task." },
    { min: 25, el: "Ρυθμός",   en: "Rhythm",   d: "Ένας πλήρης κύκλος συγκέντρωσης.", de: "One full cycle of focus." },
    { min: 45, el: "Βάθος",    en: "Depth",    d: "Χώρος για δύσκολη, απαιτητική δουλειά.", de: "Room for demanding, focused work." },
    { min: 60, el: "Ροή",      en: "Flow",     d: "Μία ολόκληρη ώρα χωρίς περισπασμούς.", de: "A full hour without distractions." }
  ];
  const C = 2 * Math.PI * 66;
  const TIMER_STORAGE_PREFIX = "nepsis-timer-session-";
  const grid = $("stageGrid");
  const timers = {};

  STAGES.forEach(function (s, i) {
    const card = document.createElement("div");
    card.className = "card stage";
    card.id = "stage-" + s.min;
    card.innerHTML =
      '<span class="stage-folder-tab" aria-hidden="true"><i></i></span>' +
      '<div class="top"><span>' + (currentLang === "el" ? "ΣΤΑΔΙΟ " : "STAGE ") + (i + 1) + '</span><span class="dot2"></span></div>' +
      '<h3 data-stage-name></h3>' +
      '<div class="desc" data-stage-desc></div>' +
      '<div class="ring"><svg viewBox="0 0 150 150"><circle class="track" cx="75" cy="75" r="66" fill="none" stroke-width="10"/>' +
      '<circle class="prog" cx="75" cy="75" r="66" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg>' +
      '<div class="time" data-time>' + String(s.min).padStart(2, "0") + ':00</div></div>' +
      '<button type="button" class="btn btn-primary start" data-start></button>' +
      '<p class="thought-park-return" data-park-return aria-live="polite"></p>' +
      '<div class="thought-park">' +
        '<p class="thought-park-label" data-park-label></p>' +
        '<div class="thought-park-row">' +
          '<input type="text" class="thought-park-input" maxlength="200" autocomplete="off" enterkeyhint="done" data-park-input>' +
          '<button type="button" class="btn btn-ghost thought-park-save" data-park-save></button>' +
        '</div>' +
        '<p class="thought-park-privacy" data-park-privacy></p>' +
        '<p class="thought-park-ok" data-park-ok aria-live="polite"></p>' +
      '</div>' +
      '<details class="thought-park-review" data-park-review hidden>' +
        '<summary data-park-review-title></summary>' +
        '<ul class="thought-park-list" data-park-list></ul>' +
        '<button type="button" class="btn btn-ghost thought-park-clear" data-park-clear></button>' +
      '</details>' +
      '<div class="msg" data-msg aria-live="polite"></div>' +
      '<div class="after" data-after></div>';
    grid.appendChild(card);

    const state = {
      min: s.min,
      left: s.min * 60,
      total: s.min * 60,
      id: null,
      running: false,
      busy: false,
      verifying: false,
      sessionId: null,
      sessionToken: null,
      endAt: null,
      el: card
    };
    timers[s.min] = state;

    card.querySelector("[data-start]").addEventListener("click", function () {
      if (state.busy) return;
      if (state.running) pause(state);
      else start(state);
    });

    var parkInput = card.querySelector("[data-park-input]");
    var parkSave = card.querySelector("[data-park-save]");
    var parkOk = card.querySelector("[data-park-ok]");
    function keepThought() {
      var text = (parkInput.value || "").trim();
      if (!text) return;
      saveParkedThought(text, s.min);
      parkInput.value = "";
      parkOk.textContent = currentLang === "el" ? "Το κράτησα." : "Saved. Back to now.";
      clearTimeout(parkOk._hide);
      parkOk._hide = setTimeout(function () { parkOk.textContent = ""; }, 2000);
      parkInput.focus();
      renderParkReview();
    }
    parkSave.addEventListener("click", keepThought);
    card.querySelector("[data-park-clear]").addEventListener("click", function () {
      var ask = currentLang === "el" ? "Να σβηστούν όλες οι σημειώσεις από αυτή τη συσκευή;" : "Delete all notes from this device?";
      if (!window.confirm(ask)) return;
      try { localStorage.removeItem(PARK_KEY); } catch (e) {}
      renderParkReview();
    });
    parkInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        keepThought();
      }
    });
  });

  var PARK_KEY = "nepsis-thought-park";
  function loadParkedThoughts() {
    try {
      var list = JSON.parse(localStorage.getItem(PARK_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function saveParkedThought(text, stageMin) {
    var list = loadParkedThoughts();
    list.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: String(text).slice(0, 200),
      at: Date.now(),
      stage: stageMin
    });
    try { localStorage.setItem(PARK_KEY, JSON.stringify(list.slice(-50))); } catch (e) {}
  }
  function renderParkLabels() {
    var label = currentLang === "el"
      ? "Αν πετάγεται κάτι, γράψε το και γύρνα στο τώρα."
      : "If something pops up, write it down and return to now.";
    var placeholder = currentLang === "el" ? "Μια σύντομη σημείωση" : "A short note";
    var save = currentLang === "el" ? "Κράτησέ το" : "Keep it";
    var privacy = currentLang === "el" ? "Μένει μόνο σε αυτή τη συσκευή." : "It stays only on this device.";
    document.querySelectorAll(".thought-park").forEach(function (park) {
      park.querySelector("[data-park-label]").textContent = label;
      park.querySelector("[data-park-input]").setAttribute("placeholder", placeholder);
      park.querySelector("[data-park-input]").setAttribute("aria-label", label);
      park.querySelector("[data-park-save]").textContent = save;
      park.querySelector("[data-park-privacy]").textContent = privacy;
    });
  }
  renderParkLabels();

  // After a stage, show the notes kept during practice, newest first.
  function renderParkReview() {
    var list = loadParkedThoughts().slice().reverse();
    var title = currentLang === "el" ? "Σημειώσεις που κράτησες (" + list.length + ")" : "Notes you kept (" + list.length + ")";
    var clear = currentLang === "el" ? "Σβήσ' τες όλες" : "Delete all";
    var locale = currentLang === "el" ? "el-GR" : "en-GB";
    document.querySelectorAll("[data-park-review]").forEach(function (box) {
      box.hidden = list.length === 0;
      box.querySelector("[data-park-review-title]").textContent = title;
      box.querySelector("[data-park-clear]").textContent = clear;
      var ul = box.querySelector("[data-park-list]");
      ul.textContent = "";
      list.forEach(function (item) {
        var li = document.createElement("li");
        var when = document.createElement("span");
        when.className = "thought-park-when";
        try {
          when.textContent = new Date(item.at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        } catch (e) { when.textContent = ""; }
        li.appendChild(when);
        li.appendChild(document.createTextNode(" " + String(item.text || "")));
        ul.appendChild(li);
      });
    });
  }
  renderParkReview();

  var RETURN_AFTER_MS = 30000;
  var parkHiddenAt = 0;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      parkHiddenAt = Date.now();
      return;
    }
    var away = parkHiddenAt ? Date.now() - parkHiddenAt : 0;
    parkHiddenAt = 0;
    if (away < RETURN_AFTER_MS) return;
    Object.keys(timers).forEach(function (min) {
      var st = timers[min];
      if (!st || !st.running) return;
      var el = st.el.querySelector("[data-park-return]");
      if (!el) return;
      el.textContent = currentLang === "el"
        ? "Καλώς ήρθες πίσω. Συνέχισε από εκεί που ήσουν."
        : "Welcome back. Continue from where you were.";
      clearTimeout(el._hide);
      el._hide = setTimeout(function () { el.textContent = ""; }, 6000);
    });
  });

  function fmt(sec) {
    return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
  }

  function draw(state) {
    const ring = state.el.querySelector(".prog");
    state.el.querySelector("[data-time]").textContent = fmt(state.left);
    ring.setAttribute("stroke-dashoffset", String(C * (1 - state.left / state.total)));
  }

  function timerStorageKey(state) {
    return TIMER_STORAGE_PREFIX + state.min;
  }

  function saveTimerCredentials(state) {
    try {
      if (state.sessionToken) {
        localStorage.setItem(timerStorageKey(state), JSON.stringify({
          session_id: state.sessionId,
          token: state.sessionToken
        }));
      }
    } catch (e) { /* the live timer still works if storage is unavailable */ }
  }

  function clearTimerCredentials(state) {
    try { localStorage.removeItem(timerStorageKey(state)); } catch (e) {}
    state.sessionId = null;
    state.sessionToken = null;
  }

  function timerCredentials(state) {
    if (state.sessionToken) {
      return { session_id: state.sessionId, token: state.sessionToken };
    }

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(timerStorageKey(state)) || "null"); } catch (e) {}
    if (saved && typeof saved.token === "string" && /^[0-9a-f]{64}$/.test(saved.token)) {
      state.sessionToken = saved.token;
      state.sessionId = typeof saved.session_id === "string" ? saved.session_id : null;
    } else {
      if (!window.crypto || !window.crypto.getRandomValues) {
        throw new Error("secure_random_unavailable");
      }
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      state.sessionToken = Array.from(bytes).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
      state.sessionId = null;
      saveTimerCredentials(state);
    }
    return { session_id: state.sessionId, token: state.sessionToken };
  }

  async function timerRequest(action, state) {
    const credentials = timerCredentials(state);
    const response = await fetch(SB_URL + "/functions/v1/focus-timer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SB_KEY
      },
      body: JSON.stringify({
        action: action,
        stage_minutes: state.min,
        session_id: credentials.session_id,
        token: credentials.token
      })
    });
    let result = null;
    try { result = await response.json(); } catch (e) {}
    if (!response.ok || !result || result.ok !== true) {
      throw new Error(result && result.error ? result.error : "timer_request_failed");
    }
    if (typeof result.session_id === "string") {
      state.sessionId = result.session_id;
      saveTimerCredentials(state);
    }
    return result;
  }

  function timerErrorText() {
    return currentLang === "el"
      ? "Δεν μπορέσαμε να συνδεθούμε με τον έλεγχο του χρονόμετρου. Έλεγξε το ίντερνετ και πάτησε ξανά."
      : "We could not reach timer verification. Check your internet connection and try again.";
  }

  function stopTimerLocally(state) {
    state.running = false;
    clearInterval(state.id);
    state.id = null;
    state.endAt = null;
    syncStageVisual(state);
    updateTabTitle();
  }

  function finishTimer(state) {
    stopTimerLocally(state);
    state.left = 0;
    state.busy = false;
    state.verifying = false;
    clearTimerCredentials(state);
    draw(state);
    markStage(state.min);
    showAfter(state);
    state.el.classList.add("is-complete");
    state.el.querySelector("[data-msg]").textContent = currentLang === "el"
      ? "Ολοκληρώθηκε."
      : "Session complete.";
    renderStageLabels();
  }

  async function start(state) {
    if (state.busy) return;
    state.busy = true;
    state.el.querySelector("[data-msg]").textContent = currentLang === "el"
      ? "Έλεγχος χρονόμετρου…"
      : "Checking timer…";
    renderStageLabels();
    try {
      const result = await timerRequest("start", state);
      if (result.completed) {
        finishTimer(state);
        return;
      }
      state.left = Math.max(0, Number(result.remaining_seconds) || 0);
      if (result.active !== true) {
        stopTimerLocally(state);
        draw(state);
        state.el.querySelector("[data-msg]").textContent = timerErrorText();
        return;
      }
      state.running = true;
      state.endAt = Date.now() + state.left * 1000;
      syncStageVisual(state);
      updateTabTitle();
      clearInterval(state.id);
      state.id = setInterval(function () { tickState(state); }, 250);
      draw(state);
      state.el.querySelector("[data-msg]").textContent = "";
      if (state.left === 0) {
        state.busy = false;
        await verifyTimerCompletion(state);
        return;
      }
    } catch (err) {
      stopTimerLocally(state);
      state.el.querySelector("[data-msg]").textContent = timerErrorText();
      draw(state);
    } finally {
      state.busy = false;
      renderStageLabels();
    }
  }

  async function pause(state) {
    if (!state.running || state.busy) return;
    state.busy = true;
    renderStageLabels();
    let verifyAfterPause = false;
    try {
      const result = await timerRequest("pause", state);
      if (result.completed) {
        finishTimer(state);
        return;
      }
      state.left = Math.max(0, Number(result.remaining_seconds) || 0);
      stopTimerLocally(state);
      draw(state);
      verifyAfterPause = state.left === 0;
      state.el.querySelector("[data-msg]").textContent = "";
    } catch (err) {
      state.el.querySelector("[data-msg]").textContent = timerErrorText();
    } finally {
      state.busy = false;
      renderStageLabels();
    }
    if (verifyAfterPause) await verifyTimerCompletion(state);
  }

  async function verifyTimerCompletion(state) {
    if (state.busy || state.verifying) return;
    state.busy = true;
    state.verifying = true;
    try {
      const result = await timerRequest("complete", state);
      if (result.completed) {
        finishTimer(state);
        return;
      }
      state.left = Math.max(0, Number(result.remaining_seconds) || 0);
      state.running = result.active === true && state.left > 0;
      if (state.running) {
        state.endAt = Date.now() + state.left * 1000;
        clearInterval(state.id);
        state.id = setInterval(function () { tickState(state); }, 250);
      } else {
        stopTimerLocally(state);
      }
      draw(state);
      state.el.querySelector("[data-msg]").textContent = state.left > 0
        ? (currentLang === "el"
          ? "Ο server επιβεβαίωσε ότι απομένουν " + fmt(state.left) + ". Το χρονόμετρο συνεχίζεται."
          : "The server confirms " + fmt(state.left) + " remaining. The timer continues.")
        : timerErrorText();
    } catch (err) {
      stopTimerLocally(state);
      state.left = 0;
      draw(state);
      state.el.querySelector("[data-msg]").textContent = timerErrorText();
    } finally {
      state.busy = false;
      state.verifying = false;
      renderStageLabels();
    }
  }

  function pageTitle() {
    const el = document.querySelector("title");
    if (!el) return "Nepsis";
    return (currentLang === "en" ? el.dataset.en : el.dataset.el) || el.textContent || "Nepsis";
  }
  function syncStageVisual(state) {
    state.el.classList.toggle("is-running", !!state.running);
    if (state.running) state.el.classList.remove("is-complete");
  }
  function updateTabTitle() {
    let running = null;
    Object.keys(timers).forEach(function (k) {
      if (timers[k] && timers[k].running) running = timers[k];
    });
    if (running && running.left > 0) document.title = fmt(running.left) + " · " + pageTitle();
    else document.title = pageTitle();
  }
  function tickState(state) {
    if (!state.running || state.busy) return;
    state.left = Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000));
    draw(state);
    updateTabTitle();
    if (state.left === 0) verifyTimerCompletion(state);
  }

  function renderStageLabels() {
    STAGES.forEach(function (s, i) {
      const st = timers[s.min];
      if (!st) return;
      const card = st.el;
      card.querySelector("[data-stage-name]").textContent = currentLang === "el" ? s.el + " · " + s.min + " λεπτά" : s.en + " · " + s.min + " min";
      card.querySelector("[data-stage-desc]").textContent = currentLang === "el" ? s.d : s.de;
      card.querySelector("[data-start]").disabled = st.busy;
      card.querySelector("[data-start]").textContent = st.busy
        ? (currentLang === "el" ? "Έλεγχος…" : "Checking…")
        : st.running
          ? (currentLang === "el" ? "❚❚ Παύση" : "❚❚ Pause")
          : (currentLang === "el" ? "▷ Έναρξη" : "▷ Start");
      card.querySelector(".top span").textContent = (currentLang === "el" ? "ΣΤΑΔΙΟ " : "STAGE ") + (i + 1);
    });
  }

  async function restoreTimers() {
    await Promise.all(STAGES.map(async function (stage) {
      const state = timers[stage.min];
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(timerStorageKey(state)) || "null"); } catch (e) {}
      if (!saved || typeof saved.token !== "string" || !/^[0-9a-f]{64}$/.test(saved.token) ||
          typeof saved.session_id !== "string") return;

      state.sessionToken = saved.token;
      state.sessionId = saved.session_id;
      state.busy = true;
      renderStageLabels();
      try {
        const result = await timerRequest("status", state);
        if (result.completed) {
          finishTimer(state);
          return;
        }
        state.left = Math.max(0, Number(result.remaining_seconds) || 0);
        state.running = result.active === true && state.left > 0;
        if (state.running) {
          state.endAt = Date.now() + state.left * 1000;
          state.id = setInterval(function () { tickState(state); }, 250);
        } else {
          stopTimerLocally(state);
        }
        draw(state);
      } catch (err) {
        state.el.querySelector("[data-msg]").textContent = timerErrorText();
      } finally {
        state.busy = false;
        renderStageLabels();
      }
    }));
  }

  // ---------- progress on this device (no account) ----------
  const PROGRESS_KEY = "nepsis-progress:guest";
  function progressStorageKey() { return sbUser && sbUser.id ? PROGRESS_KEY + ":user:" + sbUser.id : PROGRESS_KEY; }
  const FACTS = {
    5:  { el: "Η Gloria Mark (UC Irvine) βρήκε ότι ο μέσος χρόνος σε μία οθόνη πριν την αλλαγή έπεσε από περίπου 2,5 λεπτά το 2004 σε περίπου 47 δευτερόλεπτα γύρω στο 2020.",
          en: "Gloria Mark (UC Irvine) found that the average time people spend on one screen before switching fell from about 2.5 minutes in 2004 to about 47 seconds around 2020.",
          src: '<a href="https://www.universityofcalifornia.edu/news/cant-pay-attention-youre-not-alone" target="_blank" rel="noopener noreferrer">Gloria Mark · University of California</a>' },
    10: { el: "Σε παλιότερη έρευνα του Florida State University, όσοι έπαιρναν ειδοποιήσεις έκαναν περισσότερα λάθη σε δύσκολο έργο προσοχής, ακόμα και χωρίς να αγγίξουν το κινητό.",
          en: "In an older Florida State University study, people who received notifications made more errors on a demanding attention task, even without touching their phone.",
          src: '<a href="https://pubmed.ncbi.nlm.nih.gov/26121498/" target="_blank" rel="noopener noreferrer">Stothart, Mitchum & Yehnert · 2015 · PubMed</a>' },
    25: { el: "Μελέτη του 2026 στο Computers in Human Behavior (180 φοιτητές) εκτίμησε ότι μία ειδοποίηση μπορεί να επιβραδύνει την επεξεργασία πληροφοριών για περίπου 7 δευτερόλεπτα. Είναι μέση τιμή ενός πειράματος, όχι καθολικός κανόνας.",
          en: "A 2026 study in Computers in Human Behavior (180 students) estimated that one notification can slow information processing by about 7 seconds. This is an average from one experiment, not a universal rule.",
          src: '<a href="https://doi.org/10.1016/j.chb.2026.108926" target="_blank" rel="noopener noreferrer">Fournier et al. · Computers in Human Behavior · 2026</a>' },
    45: { el: "Μελέτη με 221 προπτυχιακούς φοιτητές του University of British Columbia, σε δύο περιόδους μίας εβδομάδας, βρήκε ότι ανέφεραν περισσότερη απροσεξία όταν είχαν ενεργές ειδοποιήσεις και το κινητό κοντά τους.",
          en: "A study of 221 University of British Columbia undergraduates across two one-week periods found that they reported more inattention when notifications were on and their phones were nearby.",
          src: '<a href="https://doi.org/10.1145/2858036.2858359" target="_blank" rel="noopener noreferrer">Kushlev, Proulx & Dunn · CHI 2016</a>' },
    60: { el: "Στην ίδια μελέτη, όταν οι ειδοποιήσεις ήταν απενεργοποιημένες και τα κινητά μακριά, οι φοιτητές ανέφεραν λιγότερη απροσεξία σε σύγκριση με την εβδομάδα των ειδοποιήσεων.",
          en: "In the same study, participants reported less inattention when notifications were off and their phones were kept away, compared with the notification week.",
          src: "University of British Columbia" }
  };
  const DISTRACTIONS = [
    ["notification", "Ειδοποίηση", "Notification"],
    ["phone", "Κινητό", "Phone"],
    ["thought", "Σκέψη", "Thought"],
    ["tired", "Κούραση", "Tiredness"],
    ["none", "Τίποτα", "Nothing"]
  ];
  function fmtKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function loadProgress() { try { return JSON.parse(localStorage.getItem(progressStorageKey())) || { days: {}, distractions: {} }; } catch (e) { return { days: {}, distractions: {} }; } }
  function storeProgress(p) { try { localStorage.setItem(progressStorageKey(), JSON.stringify(p)); } catch (e) {} }
  function saveProgress(p) { storeProgress(p); sbPush(p); }
  function markStage(min) {
    const p = loadProgress(), k = fmtKey(new Date());
    p.days[k] = p.days[k] || [];
    if (!p.days[k].includes(min)) p.days[k].push(min);
    saveProgress(p);
    renderProgress();
  }
  function currentStreak(p) {
    const d = new Date();
    const has = function (k) { return p.days[k] && p.days[k].length > 0; };
    if (!has(fmtKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (has(fmtKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function totalDays(p) { return Object.keys(p.days).filter(function (k) { return p.days[k].length > 0; }).length; }
  function distractionLine(p) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6);
    const from = fmtKey(cutoff), counts = {};
    Object.keys(p.distractions || {}).forEach(function (k) {
      if (k >= from) p.distractions[k].forEach(function (w) { counts[w] = (counts[w] || 0) + 1; });
    });
    const words = Object.keys(counts).filter(function (w) { return w !== "none"; });
    const isEl = currentLang === "el";
    if (!words.length) return isEl ? "Αυτή την εβδομάδα δεν έχεις σημειώσει ακόμα τι σε αποσπά." : "You have not noted what distracts you this week yet.";
    words.sort(function (a, b) { return counts[b] - counts[a]; });
    const top = DISTRACTIONS.filter(function (d) { return d[0] === words[0]; })[0];
    return (isEl ? "Η συχνότερη αποσπαστική σου σκέψη αυτή την εβδομάδα: " + top[1] : "Your most frequent distraction this week: " + top[2]) + ".";
  }
  function renderProgress() {
    const el = $("progress");
    if (!el) return;
    const p = loadProgress(), today = p.days[fmtKey(new Date())] || [];
    const isEl = currentLang === "el";
    const streak = currentStreak(p), total = totalDays(p);
    const streakLabel = isEl ? "Μέρες σερί" : "Day streak";
    const totalLabel = isEl ? "Ημέρες με προσπάθεια" : "Active days";
    const todayLine = today.length > 0
      ? (isEl ? "Σήμερα ολοκλήρωσες τουλάχιστον ένα στάδιο. Μπράβο!" : "You completed at least one stage today. Well done!")
      : (isEl ? "Κάθε μικρή προσπάθεια μετράει. Ξεκίνα σήμερα όποτε θέλεις." : "Every small effort counts. Start whenever you are ready.");
    const badges = [5, 10, 25, 45, 60].map(function (m, i) {
      const done = today.includes(m);
      return '<span class="badge2' + (done ? ' done' : '') + '">' + (done ? "✓ " : "") + (i + 1) + " · " + m + (isEl ? " λ." : " min") + '</span>';
    }).join("");
    const deviceLine = sbUser
      ? (isEl ? "Η πρόοδός σου αποθηκεύεται στη συσκευή και συγχρονίζεται στον λογαριασμό σου." : "Your progress is saved on this device and synced to your account.")
      : (isEl ? "Μένει σε αυτή τη συσκευή μέχρι να συνδεθείς." : "It stays on this device until you sign in.");
    el.innerHTML =
      '<div class="streak">' + (isEl ? "Η προσπάθειά σου μέχρι σήμερα" : "Your progress so far") + '</div>' +
      '<div class="progress-overview">' +
        '<div class="progress-stat"><span>' + streakLabel + '</span><strong>' + streak + '</strong></div>' +
        '<div class="progress-stat"><span>' + totalLabel + '</span><strong>' + total + '</strong></div>' +
      '</div>' +
      '<div>' + todayLine + '</div>' +
      '<details class="progress-section">' +
        '<summary>' + (isEl ? "Η πρόοδός μου στα πέντε στάδια" : "My progress across the five stages") + '</summary>' +
        '<div class="section-content"><div class="badges">' + badges + '</div><div class="dayline">' + dayBars(today) + '</div></div>' +
      '</details>' +
      '<details class="progress-section" id="achievements">' +
        '<summary>' + (isEl ? "Τα παράσημα και τα επιτεύγματά μου" : "My medals and achievements") + '</summary>' +
        '<div class="section-content"><div class="medals">' + medalsHtml(p, streak, total) + '</div></div>' +
      '</details>' +
      '<div class="progress-section">' +
        '<button type="button" class="btn btn-primary" id="shareBtn">' + (isEl ? "Μοιράσου το σερί μου" : "Share my streak") + '</button>' +
        '<div class="sub" style="margin-top:12px">' + distractionLine(p) + '</div>' +
        (sbUser ? '<div class="sub" id="syncMsg" style="font-size:.85rem">' + syncMsg + '</div>' : '') +
        '<div class="sub" style="font-size:.85rem">' + deviceLine + '</div>' +
      '</div>';
    const shareEl = el.querySelector('#shareBtn');
    if (shareEl) shareEl.addEventListener('click', shareStreak);
    renderCalendar();
  }
  function showAfter(state) {
    const box = state.el.querySelector("[data-after]");
    const f = FACTS[state.min];
    const isEl = currentLang === "el";
    box.innerHTML =
      '<div class="fact"><div style="font-weight:800">' + (isEl ? "Γνώση" : "Did you know") + '</div>' +
      '<div style="margin-top:6px">' + (isEl ? f.el : f.en) + '</div>' +
      '<div class="src">' + (isEl ? "Πηγή: " : "Source: ") + f.src + '</div></div>' +
      '<div style="font-weight:800;margin-top:14px">' + (isEl ? "Τι σε απέσπασε;" : "What distracted you?") + '</div>' +
      '<div class="chips">' + DISTRACTIONS.map(function (d) {
        return '<button type="button" data-word="' + d[0] + '">' + (isEl ? d[1] : d[2]) + '</button>';
      }).join("") + '</div><div class="saved" data-saved></div>';
    box.querySelectorAll("[data-word]").forEach(function (b) {
      b.addEventListener("click", function () {
        const p = loadProgress(), k = fmtKey(new Date());
        p.distractions = p.distractions || {};
        p.distractions[k] = p.distractions[k] || [];
        p.distractions[k].push(b.dataset.word);
        saveProgress(p);
        box.querySelector("[data-saved]").textContent = isEl ? "Αποθηκεύτηκε για σήμερα." : "Saved for today.";
        renderProgress();
      });
    });
  }


  // ---------- calendar (uses the same progress data) ----------
  let calMonth = new Date(); calMonth.setDate(1);
  function renderCalendar() {
    const el = $("calendar");
    if (!el) return;
    const isEl = currentLang === "el";
    const p = loadProgress();
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;      // week starts on Monday
    const days = new Date(y, m + 1, 0).getDate();
    const names = isEl ? ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const title = new Date(y, m, 1).toLocaleDateString(isEl ? "el-GR" : "en-GB", { month: "long", year: "numeric" });
    const today = fmtKey(new Date());
    let cells = names.map(function (n) { return '<div class="dow">' + n + '</div>'; }).join("");
    for (let i = 0; i < offset; i++) cells += '<div></div>';
    for (let d = 1; d <= days; d++) {
      const k = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      const list = p.days[k] || [];
      const maxMin = list.length ? Math.max.apply(null, list) : 0;
      const lvl = maxMin >= 60 ? 4 : maxMin >= 45 ? 3 : maxMin >= 25 ? 2 : maxMin >= 5 ? 1 : 0;
      cells += '<div class="day lvl' + lvl + (k === today ? ' today' : '') + '" title="' + k + '">' + d + '</div>';
    }
    el.innerHTML =
      '<div style="font-weight:800;font-size:1.15rem;margin-bottom:12px">' + (isEl ? "Το ημερολόγιο συγκέντρωσής μου" : "My focus calendar") + '</div>' +
      '<div class="cal-head"><button type="button" class="nav" data-prev aria-label="' + (isEl ? "Προηγούμενος μήνας" : "Previous month") + '">‹</button><strong>' + title + '</strong><button type="button" class="nav" data-next aria-label="' + (isEl ? "Επόμενος μήνας" : "Next month") + '">›</button></div>' +
      '<div class="cal-grid">' + cells + '</div>' +
      '<div class="sub" style="margin-top:10px">' + (isEl
        ? "Κάθε μέρα που ολοκλήρωσες στάδιο έχει χρώμα. Πιο σκούρο σημαίνει μεγαλύτερο στάδιο."
        : "Each day you completed a stage is coloured. Darker means a longer stage.") + '</div>';
    el.querySelector("[data-prev]").addEventListener("click", function () { calMonth = new Date(y, m - 1, 1); renderCalendar(); });
    el.querySelector("[data-next]").addEventListener("click", function () { calMonth = new Date(y, m + 1, 1); renderCalendar(); });
  }

  // ---------- quiz: suggests a starting stage ----------
  const QUIZ = [
    { q: ["Πόσο συχνά ελέγχεις το κινητό σου;", "How often do you check your phone?"],
      o: [["Συνέχεια", "All the time", 0], ["Κάποιες φορές", "Sometimes", 1], ["Σπάνια", "Rarely", 2]] },
    { q: ["Πόσο διαρκεί η προσοχή σου σε μία εργασία;", "How long does your focus last on one task?"],
      o: [["Λιγότερο από 5 λεπτά", "Less than 5 minutes", 0], ["5 έως 15 λεπτά", "5 to 15 minutes", 1], ["Πάνω από 15 λεπτά", "More than 15 minutes", 2]] },
    { q: ["Έχεις κάνει ποτέ μία ώρα χωρίς διακοπή;", "Have you ever done one hour without interruption?"],
      o: [["Όχι ακόμα", "Not yet", 0], ["Μερικές φορές", "Sometimes", 1], ["Ναι, συχνά", "Yes, often", 2]] }
  ];
  let quizAns = [];
  function buildQuiz() {
    const el = $("quiz");
    if (!el) return;
    const L = currentLang === "el" ? 0 : 1;
    let html = '<span class="eyebrow">' + (L === 0 ? "Κουίζ" : "Quiz") + '</span>' +
      '<h2>' + (L === 0 ? "Ποιο στάδιο να ξεκινήσεις;" : "Which stage should you start with?") + '</h2>';
    QUIZ.forEach(function (item, qi) {
      html += '<div class="qbox"><div class="qtext">' + (qi + 1) + '. ' + item.q[L] + '</div><div class="chips">' +
        item.o.map(function (o, oi) {
          return '<button type="button" data-q="' + qi + '" data-o="' + oi + '"' + (quizAns[qi] === oi ? ' class="sel"' : '') + '>' + o[L] + '</button>';
        }).join("") + '</div></div>';
    });
    if (quizAns.length === QUIZ.length && quizAns.every(function (v) { return v !== undefined; })) {
      const score = quizAns.reduce(function (a, oi, qi) { return a + QUIZ[qi].o[oi][2]; }, 0);
      const min = score <= 1 ? 5 : score === 2 ? 10 : score === 3 ? 25 : score === 4 ? 45 : 60;
      html += '<div class="fact" style="margin-top:16px"><strong>' +
        (L === 0 ? "Σου προτείνω το στάδιο των " + min + " λεπτών." : "I suggest the " + min + "-minute stage.") + '</strong> ' +
        '<button type="button" class="btn btn-primary" data-goto="' + min + '" style="margin-left:8px;padding:10px 16px">' +
        (L === 0 ? "Πήγαινε στο στάδιο" : "Go to stage") + '</button></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll("[data-o]").forEach(function (b) {
      b.addEventListener("click", function () { quizAns[Number(b.dataset.q)] = Number(b.dataset.o); buildQuiz(); });
    });
    const go = el.querySelector("[data-goto]");
    if (go) go.addEventListener("click", function () {
      const idx = [5, 10, 25, 45, 60].indexOf(Number(go.dataset.goto));
      const card = document.querySelectorAll("#stageGrid .stage")[idx];
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }


  // ---------- subscribe panel (opens inside the site) ----------
  function setSub(open) {
    $("subModal").classList.toggle("open", open);
    $("subScrim").classList.toggle("open", open);
  }
  // The practice page primary button now scrolls directly to the stages.
  $("subClose").addEventListener("click", function () { setSub(false); });
  $("subScrim").addEventListener("click", function () { setSub(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setSub(false); });

  // ---------- account (Supabase: email link, no password) ----------
  const SB_URL = "https://emhukqvetlhjgadgskbl.supabase.co";
  const SB_KEY = "sb_publishable_sdWqagLvXYQsmveUrmmw9g_neLoRMCl";
  const sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SB_URL, SB_KEY) : null;
  let sbUser = null;
  let authGeneration = 0;
  function isCurrentAuth(expectedUser, expectedGeneration) {
    return !!expectedUser && !!sbUser &&
      sbUser.id === expectedUser.id && authGeneration === expectedGeneration;
  }

  function mergeProgress(a, b) {
    const out = { days: {}, distractions: {} };
    [a, b].forEach(function (src) {
      Object.keys(src.days || {}).forEach(function (k) {
        out.days[k] = Array.from(new Set([].concat(out.days[k] || [], src.days[k])));
      });
    });
    [a, b].forEach(function (src) {
      Object.keys(src.distractions || {}).forEach(function (k) {
        const cur = out.distractions[k] || [];
        out.distractions[k] = src.distractions[k].length > cur.length ? src.distractions[k] : cur;
      });
    });
    return out;
  }
  // The device always keeps the progress. When signed in, we also save it to the account and say what happened.
  let syncMsg = "", syncRetries = 0, syncTimer = null, syncReady = false;
  function setSync(msg) { syncMsg = msg; const el = document.getElementById("syncMsg"); if (el) el.textContent = msg; }
  async function sbPush(p, expectedUser, expectedGeneration) {
    const targetUser = expectedUser || sbUser;
    const generation = expectedGeneration === undefined ? authGeneration : expectedGeneration;
    if (!sb || !isCurrentAuth(targetUser, generation) || !syncReady) return;
    setSync(currentLang === "el" ? "Αποθήκευση στον λογαριασμό…" : "Saving to your account…");
    try {
      const res = await sb.from("progress").upsert({ user_id: targetUser.id, data: p, updated_at: new Date().toISOString() });
      if (!isCurrentAuth(targetUser, generation)) return;
      if (res.error) throw res.error;
      syncRetries = 0;
      setSync(currentLang === "el" ? "Αποθηκεύτηκε στον λογαριασμό σου." : "Saved to your account.");
    } catch (err) {
      if (!isCurrentAuth(targetUser, generation)) return;
      setSync(currentLang === "el" ? "Δεν αποθηκεύτηκε στον λογαριασμό. Η πρόοδος μένει στη συσκευή." : "Not saved to your account. Progress stays on this device.");
      if (syncRetries < 3) {
        syncRetries++;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function () {
          if (isCurrentAuth(targetUser, generation) && syncReady) sbPush(loadProgress(), targetUser, generation);
        }, 15000);
      }
    }
  }
  async function sbPull(expectedUser, expectedGeneration) {
    const targetUser = expectedUser || sbUser;
    const generation = expectedGeneration === undefined ? authGeneration : expectedGeneration;
    if (!sb || !isCurrentAuth(targetUser, generation)) return;
    syncReady = false;
    clearTimeout(syncTimer);
    syncRetries = 0;
    try {
      const res = await sb.from("progress").select("data").eq("user_id", targetUser.id).maybeSingle();
      if (!isCurrentAuth(targetUser, generation)) return;
      if (res.error) throw res.error;
      const remote = res.data && res.data.data ? res.data.data : { days: {}, distractions: {} };
      const merged = mergeProgress(loadProgress(), remote);
      if (!isCurrentAuth(targetUser, generation)) return;
      storeProgress(merged);
      syncReady = true;
      await sbPush(merged, targetUser, generation);
      if (!isCurrentAuth(targetUser, generation)) return;
      renderProgress();
    } catch (err) {
      if (!isCurrentAuth(targetUser, generation)) return;
      syncReady = false;
      clearTimeout(syncTimer);
      setSync(currentLang === "el"
        ? "Δεν ήταν δυνατή η ανάγνωση της αποθηκευμένης προόδου. Δεν αντικαταστάθηκαν τα δεδομένα σου. Η πρόοδός σου παραμένει σε αυτή τη συσκευή."
        : "Could not read saved progress. Your data was not overwritten. Progress remains on this device.");
      renderProgress();
    }
  }
  function renderAcc(msg) {
    const isEl = currentLang === "el";
    $("accBtn").textContent = sbUser ? (isEl ? "Λογαριασμός" : "Account") : (isEl ? "Σύνδεση" : "Sign in");
    $("accEyebrow").textContent = isEl ? "Λογαριασμός" : "Account";
    $("accTitle").textContent = sbUser ? (isEl ? "Είσαι συνδεδεμένος" : "You are signed in") : (isEl ? "Σύνδεση" : "Sign in");
    $("accText").textContent = sbUser
      ? (isEl ? "Η πρόοδός σου αποθηκεύεται στον λογαριασμό σου και φαίνεται σε όλες τις συσκευές." : "Your progress is saved to your account and shows on all your devices.")
      : (isEl ? "Συνδέσου με Google ή με σύνδεσμο που θα σταλεί στο email σου. Η πρόοδός σου θα συγχρονίζεται στις συσκευές σου." : "Sign in with Google or a link sent to your email. Your progress will sync across your devices.");
    $("accLogged").hidden = !sbUser;
    $("accForm").hidden = !!sbUser;
    $("accWho").textContent = sbUser ? sbUser.email : "";
    $("accOut").textContent = isEl ? "Αποσύνδεση" : "Sign out";
    $("accGoogleLabel").textContent = isEl ? "Συνέχεια με Google" : "Continue with Google";
    $("accMsg").textContent = msg || "";
  }
  function setAcc(open) {
    $("accModal").classList.toggle("open", open);
    $("accScrim").classList.toggle("open", open);
    if (open) renderAcc("");
  }
  $("accBtn").addEventListener("click", function () { setAcc(true); });
  $("accClose").addEventListener("click", function () { setAcc(false); });
  $("accScrim").addEventListener("click", function () { setAcc(false); });
  $("accGoogle").addEventListener("click", async function () {
    if (!sb) {
      renderAcc(currentLang === "el" ? "Η σύνδεση δεν φορτώθηκε. Ανανέωσε τη σελίδα." : "Sign-in did not load. Refresh the page.");
      return;
    }
    try {
      const result = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname }
      });
      if (result.error) {
        renderAcc(currentLang === "el" ? "Δεν ήταν δυνατή η σύνδεση με Google. Δοκίμασε ξανά." : "Google sign-in could not start. Please try again.");
      }
    } catch (error) {
      renderAcc(currentLang === "el" ? "Δεν ήταν δυνατή η σύνδεση με Google. Δοκίμασε ξανά." : "Google sign-in could not start. Please try again.");
    }
  });
  $("accOut").addEventListener("click", async function () {
    try {
      if (sb) {
        const result = await sb.auth.signOut({ scope: "local" });
        if (result.error) throw result.error;
      }
      authGeneration++;
      sbUser = null;
      syncReady = false;
      clearTimeout(syncTimer);
      syncRetries = 0;
      renderProgress();
      renderAcc(currentLang === "el" ? "Αποσυνδέθηκες. Η πρόοδος μένει στη συσκευή." : "You are signed out. Progress stays on this device.");
    } catch (error) {
      renderAcc(currentLang === "el" ? "Δεν ολοκληρώθηκε η αποσύνδεση. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά." : "Sign-out did not complete. Check your connection and try again.");
    }
  });
  if (sb) {
    sb.auth.onAuthStateChange(function (event, session) {
      const nextUser = session ? session.user : null;
      const identityChanged = (sbUser ? sbUser.id : null) !== (nextUser ? nextUser.id : null);
      if (identityChanged || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        authGeneration++;
        syncReady = false;
        clearTimeout(syncTimer);
        syncRetries = 0;
      }
      const generation = authGeneration;
      sbUser = nextUser;
      if (identityChanged) { setSync(""); renderProgress(); }
      renderAcc("");
      if (sbUser && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        const activeUser = sbUser;
        sbPull(activeUser, generation);
      } else if (!sbUser && (event === "SIGNED_OUT" || event === "INITIAL_SESSION")) {
        setSync("");
        renderProgress();
      }
    });
  }

  // ---------- share card: a square image with only the streak (no name, no email) ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawShareCard(p) {
    const c = document.createElement("canvas");
    c.width = 1080; c.height = 1080;
    const x = c.getContext("2d");
    const isEl = currentLang === "el";
    x.fillStyle = "#FFF8EE"; x.fillRect(0, 0, 1080, 1080);
    const glow = x.createRadialGradient(540, 380, 40, 540, 380, 620);
    glow.addColorStop(0, "rgba(247,209,90,0.7)"); glow.addColorStop(1, "rgba(247,209,90,0)");
    x.fillStyle = glow; x.fillRect(0, 0, 1080, 1080);
    const dotG = x.createLinearGradient(436, 176, 504, 244);
    dotG.addColorStop(0, "#F7D15A"); dotG.addColorStop(0.55, "#F0702A"); dotG.addColorStop(1, "#D8392B");
    x.beginPath(); x.arc(470, 210, 34, 0, Math.PI * 2); x.fillStyle = dotG; x.fill();
    x.fillStyle = "#3A2418"; x.font = "900 84px Nunito, sans-serif"; x.textAlign = "left";
    x.fillText("Nepsis", 524, 226);
    const streak = currentStreak(p);
    x.textAlign = "center"; x.fillStyle = "#3A2418";
    x.font = "900 260px Nunito, sans-serif";
    x.fillText(String(streak), 540, 560);
    x.font = "800 60px Nunito, sans-serif";
    x.fillText(isEl ? (streak === 1 ? "μέρα σερί" : "μέρες σερί") : (streak === 1 ? "day in a row" : "days in a row"), 540, 650);
    const today = p.days[fmtKey(new Date())] || [];
    const line = today.length > 0
      ? (isEl ? "Σήμερα ολοκλήρωσα ένα στάδιο" : "Today I completed a stage")
      : (isEl ? "Κάθε μέρα μετράει" : "Every day counts");
    x.font = "600 44px Nunito, sans-serif"; x.fillStyle = "#7A5F50";
    x.fillText(line, 540, 730);
    const pillG = x.createLinearGradient(240, 860, 840, 950);
    pillG.addColorStop(0, "#F7D15A"); pillG.addColorStop(0.55, "#F0702A"); pillG.addColorStop(1, "#D8392B");
    x.fillStyle = pillG; roundRect(x, 240, 860, 600, 90, 45); x.fill();
    x.fillStyle = "#FFFFFF"; x.font = "800 44px Nunito, sans-serif";
    x.fillText("nepsis-focus.github.io/nepsis-site", 540, 918);
    return c;
  }
  function shareStreak() {
    const p = loadProgress();
    const canvas = drawShareCard(p);
    canvas.toBlob(async function (blob) {
      const file = new File([blob], "nepsis-streak.png", { type: "image/png" });
      const text = currentLang === "el" ? "Το σερί μου στο Nepsis" : "My streak on Nepsis";
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Nepsis", text: text }); return; } catch (e) { /* cancelled */ }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "nepsis-streak.png";
      document.body.appendChild(a); a.click(); a.remove();
    }, "image/png");
  }

  // ---------- motion: smooth scroll (Lenis) and entrance animations (GSAP) ----------
  // Turned off for people who ask their device to reduce motion.
  const REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!REDUCE && window.Lenis) {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function loop(t) { lenis.raf(t); requestAnimationFrame(loop); })(0);
    }
  }
  if (!REDUCE && window.gsap && window.ScrollTrigger) {
    gsap.from(".badge, .hero h1, .hero .lead, .hero .btns", {
      y: 30, opacity: 0, duration: 0.9, stagger: 0.12, ease: "power3.out", clearProps: "transform,opacity"
    });
    gsap.utils.toArray(".card:not(.stage)").forEach(function (el) {
      gsap.from(el, {
        y: 40, opacity: 0, duration: 0.8, ease: "power2.out", clearProps: "transform,opacity",
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });
  }

  // ---------- medals, day bars, music and 3D tilt ----------
  function medalsHtml(p, streak, total) {
    const isEl = currentLang === "el";
    const everyMin = function (m) { return Object.keys(p.days).some(function (k) { return p.days[k].includes(m); }); };
    const dayHas = function (k, m) { return p.days[k] && p.days[k].includes(m); };
    const allFive = Object.keys(p.days).some(function (k) { return [5, 10, 25, 45, 60].every(function (m) { return p.days[k].includes(m); }); });
    const list = [
      { ok: total >= 1,   icon: "✦",  el: "Πρώτο βήμα",       en: "First step" },
      { ok: streak >= 3,  icon: "🔥", el: "3 μέρες σερί",     en: "3-day streak" },
      { ok: total >= 7,   icon: "🌱", el: "7 μέρες μέσα",     en: "7 days in" },
      { ok: streak >= 7,  icon: "🏅", el: "Εβδομάδα σερί",    en: "Week streak" },
      { ok: total >= 14,  icon: "🚀", el: "14 μέρες",         en: "14 days" },
      { ok: streak >= 14, icon: "💥", el: "Δεκαπενθήμερο σερί", en: "Two-week streak" },
      { ok: total >= 30,  icon: "👑", el: "30 μέρες",         en: "30 days" },
      { ok: everyMin(25), icon: "◎",  el: "Το 25λεπτο",       en: "The 25-min" },
      { ok: everyMin(45), icon: "📘", el: "Το 45λεπτο",       en: "The 45-min" },
      { ok: everyMin(60), icon: "☀",  el: "Μία ολόκληρη ώρα", en: "A full hour" },
      { ok: allFive,      icon: "🎯", el: "Και τα πέντε",     en: "All five" }
    ];
    return list.map(function (m) {
      return '<div class="medal-wrap"><div class="medal' + (m.ok ? '' : ' locked') + '">' + (m.ok ? m.icon : '🔒') + '</div>' +
        '<div class="medal-label">' + (isEl ? m.el : m.en) + '</div>' +
        '<div class="sub">' + (m.ok ? (isEl ? "Ξεκλειδώθηκε" : "Unlocked") : (isEl ? "Κλειδωμένο" : "Locked")) + '</div></div>';
    }).join("");
  }
  function dayBars(today) {
    const isEl = currentLang === "el";
    if (!today.length) return '<div class="sub">' + (isEl ? "Σήμερα ακόμα δεν έχεις ολοκληρώσει στάδιο." : "No stage completed yet today.") + '</div>';
    return [5, 10, 25, 45, 60].filter(function (m) { return today.includes(m); }).map(function (m) {
      return '<div class="dayrow"><span>' + m + (isEl ? " λεπτά" : " min") + '</span><div class="daybar"><i style="width:' + (m / 60 * 100) + '%"></i></div></div>';
    }).join("");
  }

  const MUSIC = [
    ["2nAoTMLXOfhOwq8BziSopv"],
    ["0bf0PLg5I856ySoVv7HCIR"],
    ["7wHb7vPGyj1BKBhAnZS73T"]
  ];
  let currentMusicIdx = null;
  let currentAmbientIdx = null;
  function playMusic(i) {
    currentMusicIdx = i;
    const id = MUSIC[i][0];
    $("musicFrame").innerHTML =
      '<iframe title="Spotify playlist" style="border-radius:20px" src="https://open.spotify.com/embed/playlist/' + id +
      '?utm_source=generator" width="100%" height="352" frameborder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>' +
      '<p style="margin-top:10px"><a href="https://open.spotify.com/playlist/' + id + '" target="_blank" rel="noopener" style="color:var(--ember);font-weight:800">' +
      (currentLang === "el" ? "Άνοιγμα στο Spotify" : "Open in Spotify") + '</a></p>';
    document.querySelectorAll("#musicPicks button").forEach(function (b, j) { b.classList.toggle("active", j === i); });
  }
  const AMBIENT_PLAYLISTS = [
    { id: "37i9dQZF1DXbcPC6Vvqudd", label: "Βροχή / Rain" },
    { id: "37i9dQZF1DWV90ZWj21ygB", label: "Θάλασσα / Ocean" },
    { id: "37i9dQZF1DX4PP3DA4J0N8", label: "Φύση / Nature" }
  ];
  function playAmbientPlaylist(i) {
    const playlist = AMBIENT_PLAYLISTS[i];
    if (!playlist) return;
    currentAmbientIdx = i;
    const id = playlist.id;
    $("ambientFrame").innerHTML =
      '<iframe title="Spotify ambient playlist" style="border-radius:16px" src="https://open.spotify.com/embed/playlist/' + id +
      '?utm_source=generator" width="100%" height="232" frameborder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>' +
      '<p style="margin-top:8px"><a href="https://open.spotify.com/playlist/' + id + '" target="_blank" rel="noopener" style="color:var(--ember);font-weight:800">' +
      (currentLang === "el" ? "Άνοιγμα στο Spotify" : "Open in Spotify") + '</a></p>';
    document.querySelectorAll("#ambientPicks button").forEach(function (b, j) {
      b.classList.toggle("active", j === i);
    });
  }
  document.querySelectorAll("#musicPicks button").forEach(function (b) {
    b.addEventListener("click", function () { playMusic(Number(b.dataset.idx)); });
  });
  document.querySelectorAll("#ambientPicks button").forEach(function (b) {
    b.addEventListener("click", function () { playAmbientPlaylist(Number(b.dataset.ambient)); });
  });
  if (document.body.classList.contains("practice-page")) playMusic(0);

  // 3D tilt for cards that the pointer is over (only on devices with a mouse or pen)
  let tiltEl = null;
  document.addEventListener("pointermove", function (e) {
    if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) return;
    const c = e.target.closest ? e.target.closest(".card") : null;
    if (tiltEl && tiltEl !== c) tiltEl.style.transform = "";
    tiltEl = c;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = "perspective(1000px) rotateY(" + (x * 8) + "deg) rotateX(" + (-y * 8) + "deg) translateY(-4px)";
  });
  document.addEventListener("pointerleave", function () { if (tiltEl) { tiltEl.style.transform = ""; tiltEl = null; } });
  // ---------- start ----------
  renderSelect(); renderCalc(); renderStageLabels();
  try { setLang(localStorage.getItem("nepsis-lang") === "en" ? "en" : "el"); } catch (e) { setLang("el"); }
  if (document.body.classList.contains("practice-page")) restoreTimers();
