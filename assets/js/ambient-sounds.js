(() => {
  if (document.getElementById("nepsisAmbient")) return;

  const STORAGE_KEY = "nepsis-ambient-v1";
  const SOUNDS = [
    { id: "brown", el: "Καφέ θόρυβος", en: "Brown noise" },
    { id: "rain", el: "Βροχή", en: "Rain" },
    { id: "cafe", el: "Καφετέρια", en: "Cafe" },
    { id: "binaural", el: "Binaural", en: "Binaural" }
  ];

  let audioCtx = null;
  let masterGain = null;
  let activeNodes = [];
  let currentSound = null;
  let volume = 0.35;
  let panelOpen = false;
  let noiseBuffer = null;

  function lang() {
    try {
      if (localStorage.getItem("nepsis-lang") === "en") return "en";
    } catch (_) {}
    return document.documentElement.lang === "en" ? "en" : "el";
  }

  function t(el, en) {
    return lang() === "en" ? en : el;
  }

  function readPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.volume === "number" && data.volume >= 0 && data.volume <= 1) volume = data.volume;
    } catch (_) {}
  }

  function writePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: volume }));
    } catch (_) {}
  }

  function ensureContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) {
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function stopSound() {
    activeNodes.forEach(function (node) {
      try {
        if (typeof node.stop === "function") node.stop();
      } catch (_) {}
      try {
        node.disconnect();
      } catch (_) {}
    });
    activeNodes = [];
    currentSound = null;
    syncUi();
  }

  function makeNoiseBuffer(seconds) {
    if (!audioCtx) return null;
    if (noiseBuffer && noiseBuffer.duration >= seconds) return noiseBuffer;
    const length = Math.floor(audioCtx.sampleRate * seconds);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Brown-ish integration with soft clamp for a warm focus bed.
      last = (last + 0.02 * white) / 1.02;
      data[i] = Math.max(-1, Math.min(1, last * 3.5));
    }
    noiseBuffer = buffer;
    return buffer;
  }

  function startLoop(buffer, options) {
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    let node = src;
    if (options.filterType) {
      const filter = audioCtx.createBiquadFilter();
      filter.type = options.filterType;
      filter.frequency.value = options.frequency || 800;
      if (options.Q) filter.Q.value = options.Q;
      src.connect(filter);
      node = filter;
    }
    const gain = audioCtx.createGain();
    gain.gain.value = options.gain == null ? 1 : options.gain;
    node.connect(gain);
    gain.connect(masterGain);
    src.start();
    activeNodes.push(src, gain);
    if (node !== src) activeNodes.push(node);
    return { src: src, gain: gain };
  }

  function startBrown() {
    const buffer = makeNoiseBuffer(4);
    startLoop(buffer, { filterType: "lowpass", frequency: 280, gain: 0.7 });
  }

  function startRain() {
    const buffer = makeNoiseBuffer(4);
    startLoop(buffer, { filterType: "bandpass", frequency: 1400, Q: 0.55, gain: 0.55 });
    startLoop(buffer, { filterType: "highpass", frequency: 3200, Q: 0.7, gain: 0.18 });
  }

  function startCafe() {
    const buffer = makeNoiseBuffer(4);
    startLoop(buffer, { filterType: "bandpass", frequency: 520, Q: 0.9, gain: 0.45 });
    startLoop(buffer, { filterType: "bandpass", frequency: 1800, Q: 0.7, gain: 0.22 });
    // Soft room tone under the murmur.
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 95;
    gain.gain.value = 0.015;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    activeNodes.push(osc, gain);
  }

  function startBinaural() {
    // Mild 10 Hz alpha beat around a soft carrier — calming, not piercing.
    const carrier = 180;
    const beat = 10;
    const merger = audioCtx.createChannelMerger(2);
    const left = audioCtx.createOscillator();
    const right = audioCtx.createOscillator();
    const leftGain = audioCtx.createGain();
    const rightGain = audioCtx.createGain();
    left.type = "sine";
    right.type = "sine";
    left.frequency.value = carrier;
    right.frequency.value = carrier + beat;
    leftGain.gain.value = 0.08;
    rightGain.gain.value = 0.08;
    left.connect(leftGain);
    right.connect(rightGain);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);
    merger.connect(masterGain);
    left.start();
    right.start();
    activeNodes.push(left, right, leftGain, rightGain, merger);
  }

  function playSound(id) {
    if (!ensureContext()) return;
    if (currentSound === id) {
      stopSound();
      return;
    }
    stopSound();
    currentSound = id;
    if (id === "brown") startBrown();
    else if (id === "rain") startRain();
    else if (id === "cafe") startCafe();
    else if (id === "binaural") startBinaural();
    else currentSound = null;
    syncUi();
  }

  function setVolume(next) {
    volume = Math.max(0, Math.min(1, next));
    if (masterGain && audioCtx) {
      masterGain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.03);
    }
    writePrefs();
    syncUi();
  }

  function buildWidget() {
    const root = document.createElement("div");
    root.id = "nepsisAmbient";
    root.className = "nepsis-ambient";
    root.innerHTML =
      '<button type="button" class="nepsis-ambient-toggle" id="nepsisAmbientToggle" aria-expanded="false" aria-controls="nepsisAmbientPanel">' +
      '<svg class="nepsis-ambient-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M4 10v4h3l4 3V7L7 10H4zm11.5 2a2.5 2.5 0 0 0-1.5-2.3v4.6a2.5 2.5 0 0 0 1.5-2.3zm0-5.2v1.6a4.5 4.5 0 0 1 0 7.2v1.6a6.1 6.1 0 0 0 0-10.4z"/>' +
      "</svg>" +
      '<span class="nepsis-ambient-pulse" aria-hidden="true"></span>' +
      '<span class="visually-hidden" data-el="Ήχοι συγκέντρωσης" data-en="Focus sounds">Ήχοι συγκέντρωσης</span>' +
      "</button>" +
      '<div class="nepsis-ambient-panel" id="nepsisAmbientPanel" hidden>' +
      '<div class="nepsis-ambient-head">' +
      '<p class="nepsis-ambient-title" data-el="Ήχοι συγκέντρωσης" data-en="Focus sounds">Ήχοι συγκέντρωσης</p>' +
      '<button type="button" class="nepsis-ambient-close" id="nepsisAmbientClose" aria-label="Κλείσιμο">×</button>' +
      "</div>" +
      '<p class="nepsis-ambient-hint" data-el="Μικροί ήχοι για διάβασμα και δουλειά, χωρίς άλλη εφαρμογή." data-en="Soft sounds for reading and work, without another app.">Μικροί ήχοι για διάβασμα και δουλειά, χωρίς άλλη εφαρμογή.</p>' +
      '<div class="nepsis-ambient-picks" id="nepsisAmbientPicks" role="group" aria-label="Ambient sounds"></div>' +
      '<label class="nepsis-ambient-vol">' +
      '<span data-el="Ένταση" data-en="Volume">Ένταση</span>' +
      '<input type="range" id="nepsisAmbientVolume" min="0" max="100" step="1" value="35">' +
      "</label>" +
      '<button type="button" class="nepsis-ambient-stop" id="nepsisAmbientStop" data-el="Διακοπή" data-en="Stop">Διακοπή</button>' +
      "</div>";

    const picks = root.querySelector("#nepsisAmbientPicks");
    SOUNDS.forEach(function (sound) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nepsis-ambient-pick";
      btn.dataset.sound = sound.id;
      btn.dataset.el = sound.el;
      btn.dataset.en = sound.en;
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = t(sound.el, sound.en);
      picks.appendChild(btn);
    });

    const host =
      document.querySelector(".head-right, .coach-controls, .controls, .top-actions") ||
      document.querySelector("header .lang")?.parentElement ||
      null;
    const before =
      (host && host.querySelector(".menu-btn, .nepsis-menu-button, #menuBtn")) ||
      null;
    if (host) {
      if (before) host.insertBefore(root, before);
      else host.appendChild(root);
    } else {
      document.body.appendChild(root);
    }
    return root;
  }

  function applyLangTexts(root) {
    const current = lang();
    root.querySelectorAll("[data-el][data-en]").forEach(function (el) {
      const next = current === "en" ? el.dataset.en : el.dataset.el;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      if (el.classList.contains("nepsis-ambient-toggle")) return;
      el.textContent = next;
    });
    const toggle = root.querySelector("#nepsisAmbientToggle");
    if (toggle) toggle.setAttribute("aria-label", t("Ήχοι συγκέντρωσης", "Focus sounds"));
    const close = root.querySelector("#nepsisAmbientClose");
    if (close) close.setAttribute("aria-label", t("Κλείσιμο", "Close"));
    const group = root.querySelector("#nepsisAmbientPicks");
    if (group) group.setAttribute("aria-label", t("Ήχοι περιβάλλοντος", "Ambient sounds"));
  }

  function syncUi() {
    const root = document.getElementById("nepsisAmbient");
    if (!root) return;
    root.classList.toggle("is-playing", !!currentSound);
    root.classList.toggle("is-open", panelOpen);
    const toggle = root.querySelector("#nepsisAmbientToggle");
    const panel = root.querySelector("#nepsisAmbientPanel");
    if (toggle) toggle.setAttribute("aria-expanded", panelOpen ? "true" : "false");
    if (panel) panel.hidden = !panelOpen;
    root.querySelectorAll(".nepsis-ambient-pick").forEach(function (btn) {
      const on = btn.dataset.sound === currentSound;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const vol = root.querySelector("#nepsisAmbientVolume");
    if (vol && Number(vol.value) !== Math.round(volume * 100)) vol.value = String(Math.round(volume * 100));
    const stop = root.querySelector("#nepsisAmbientStop");
    if (stop) stop.disabled = !currentSound;
  }

  function setOpen(open) {
    panelOpen = !!open;
    syncUi();
  }

  function bind(root) {
    root.querySelector("#nepsisAmbientToggle").addEventListener("click", function () {
      setOpen(!panelOpen);
    });
    root.querySelector("#nepsisAmbientClose").addEventListener("click", function () {
      setOpen(false);
    });
    root.querySelector("#nepsisAmbientStop").addEventListener("click", function () {
      stopSound();
    });
    root.querySelector("#nepsisAmbientVolume").addEventListener("input", function (event) {
      setVolume(Number(event.target.value) / 100);
    });
    root.querySelectorAll(".nepsis-ambient-pick").forEach(function (btn) {
      btn.addEventListener("click", function () {
        playSound(btn.dataset.sound);
      });
    });

    document.querySelectorAll("[data-lang]").forEach(function (button) {
      button.addEventListener("click", function () {
        window.setTimeout(function () {
          applyLangTexts(root);
          syncUi();
        }, 0);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && panelOpen) setOpen(false);
    });

    // Keep audio running in zen mode; only tuck the open panel away if needed.
    // Soft pause when the tab is fully hidden saves battery without surprising the user on return.
    document.addEventListener("visibilitychange", function () {
      if (!audioCtx || !currentSound) return;
      if (document.hidden) {
        if (audioCtx.state === "running") audioCtx.suspend();
      } else if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    });
  }

  readPrefs();
  const root = buildWidget();
  applyLangTexts(root);
  syncUi();
  bind(root);
})();
