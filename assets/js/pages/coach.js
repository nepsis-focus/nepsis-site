/* Nepsis Coach MVP: local-first planner, existing timer handoff, read-only auth. */
(function (window, document) {
  "use strict";
  var GUEST_LIMIT = 2;
  var MAX_FILE_BYTES = 8 * 1024 * 1024;
  var MAX_DOCUMENT_CHARS = 28000;
  var USAGE_KEY = "nepsis-ai-coach:guest-usage:v1";
  var CHECKIN_KEY = "nepsis-ai-coach:guest-checkin:v1";
  var HISTORY_KEY = "nepsis-ai-coach:guest-history:v1";
  var HISTORY_LIMIT = 8;
  var WHOP_URL = "https://whop.com/nepsis-focus";
  var SUPABASE_URL = "https://emhukqvetlhjgadgskbl.supabase.co";
  var SUPABASE_KEY = "sb_publishable_sdWqagLvXYQsmveUrmmw9g_neLoRMCl";
  var STAGES = [5, 10, 25, 45, 60];
  var lastPlan = null;
  var currentLang = "el";
  var signedIn = false;
  var authClient = null;
  var memoryGuestCount = 0;
  var memoryCheckin = null;
  var memoryHistory = [];
  var selectedFile = null;
  var extractedDocumentText = "";
  var extractionPromise = Promise.resolve("");

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function localDay(now) {
    var d = now || new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }
  function normalized(input) {
    var topic = String(input && input.topic || "").trim().slice(0, 140);
    var type = input && input.type === "task" ? "task" : "study";
    var energy = clamp(Math.round(Number(input && input.energy) || 3), 1, 5);
    var available = clamp(Math.round(Number(input && input.available) || 5), 5, 180);
    var focusCandidate = input && input.focusMinutes !== "" ? Number(input.focusMinutes) : 0;
    var focusMinutes = Number.isInteger(focusCandidate) ? focusCandidate : 0;
    if (focusMinutes !== 0 && (focusMinutes < 5 || focusMinutes > 180 || focusMinutes > available)) focusMinutes = 0;
    return { topic: topic, type: type, energy: energy, available: available, focusMinutes: focusMinutes };
  }
  function applyFocusChoice(timer, focusMinutes, available, energy) {
    var requested = focusMinutes === "" || focusMinutes == null ? 0 : Number(focusMinutes);
    var base = timer;
    if (!base || base.focus > available) base = recommend({ available: available, energy: energy });
    else base = { focus: base.focus, rest: Math.min(Number(base.rest) || 0, Math.max(0, available - base.focus)), style: base.style, available: available, energy: energy };
    if (!Number.isInteger(requested) || requested < 5 || requested > 180 || requested > available) return base;
    return { focus: requested, rest: Math.min(Number(base.rest) || 0, Math.max(0, available - requested)), style: "manual", available: available, energy: energy };
  }
  function timerPattern(timer, lang) {
    if (lang === "en") return timer.focus + " min focus" + (timer.rest ? " · then " + timer.rest + " min break" : "");
    return timer.focus + "′ εστίαση" + (timer.rest ? " · μετά " + timer.rest + "′ παύση" : "");
  }
  function manualTimerReason(focus, rest, lang) {
    if (lang === "en") return "You chose " + focus + " minutes of focus" + (rest ? ". A " + rest + "-minute break is suggested afterward." : ". This uses your full available time.");
    return "Επέλεξες " + focus + "′ εστίασης" + (rest ? ". Το πλάνο προτείνει μετά παύση " + rest + "′." : "· είναι όλος ο διαθέσιμος χρόνος σου.");
  }
  function recommend(input) {
    var v = normalized(input);
    var focus = 5;
    var rest = 2;
    var style = "gentle";
    if (v.energy <= 2) {
      focus = 5;
      rest = v.available >= 7 ? 2 : 0;
      style = "gentle";
    } else if (v.available >= 75 && v.energy >= 4) {
      focus = 60;
      rest = 10;
      style = "flow";
    } else if (v.available >= 55 && v.energy >= 4) {
      focus = 45;
      rest = 10;
      style = "deep";
    } else if (v.available >= 50 && v.energy >= 3) {
      focus = 45;
      rest = 5;
      style = "steady";
    } else if (v.available >= 30) {
      focus = 25;
      rest = 5;
      style = "pomodoro";
    } else if (v.available >= 15) {
      focus = 10;
      rest = 3;
      style = "warmup";
    }
    while (focus > v.available && STAGES.indexOf(focus) > 0) focus = STAGES[STAGES.indexOf(focus) - 1];
    rest = Math.min(rest, Math.max(0, v.available - focus));
    return { focus: focus, rest: rest, style: style, available: v.available, energy: v.energy };
  }
  function createPlan(input, lang, documentText) {
    var v = normalized(input);
    var recommendedTimer = recommend(v);
    var timer = recommendedTimer;
    var en = lang === "en";
    var topic = v.topic || (en ? "your task" : "την εργασία σου");
    var title = en ? (v.type === "study" ? "Study " + topic : "Task: " + topic) : (v.type === "study" ? "Διάβασμα: " + topic : "Εργασία: " + topic);
    var reason;
    if (timer.style === "gentle") reason = en ? "Low energy is a cue to start gently: use Nepsis's 5-minute stage, then take a short reset." : "Με χαμηλή ενέργεια, ξεκίνα ήπια: βάλε το υπάρχον στάδιο Nepsis των 5 λεπτών και μετά κάνε μικρή παύση.";
    else if (timer.style === "deep") reason = en ? "Your time and focus allow a deep block. Nepsis has a 45-minute stage (not 50), followed by a 10-minute break." : "Ο διαθέσιμος χρόνος και η συγκέντρωσή σου σηκώνουν βαθύτερο κύκλο. Το Nepsis έχει στάδιο 45΄ (όχι 50΄) και μετά 10΄ διάλειμμα.";
    else if (timer.style === "flow") reason = en ? "For a strong-focus day, use Nepsis's existing 60-minute stage, then rest for 10 minutes." : "Για μέρα με καλή συγκέντρωση, χρησιμοποίησε το υπάρχον στάδιο Nepsis των 60΄ και μετά ξεκουράσου 10΄.";
    else if (timer.style === "steady") reason = en ? "A 45-minute Nepsis stage fits your available time; leave the remaining 5 minutes for a reset." : "Το υπάρχον στάδιο Nepsis των 45΄ χωρά στον χρόνο σου· κράτησε τα υπόλοιπα 5΄ για παύση.";
    else if (timer.style === "pomodoro") reason = en ? "A familiar 25-minute focus / 5-minute break cycle fits your available time." : "Ένας γνώριμος κύκλος 25΄ συγκέντρωσης / 5΄ παύσης χωρά στον διαθέσιμο χρόνο σου.";
    else if (timer.style === "warmup") reason = en ? "Start with Nepsis's 10-minute warm-up stage and a 3-minute reset." : "Ξεκίνα με το υπάρχον στάδιο ζεστάματος Nepsis των 10΄ και κάνε παύση 3΄.";
    else reason = en ? "Start with Nepsis's 5-minute stage and take a short pause if you have time." : "Ξεκίνα με το υπάρχον στάδιο Nepsis των 5΄ και κάνε μικρή παύση αν έχεις χρόνο.";
    var recommendedReason = reason;
    timer = applyFocusChoice(recommendedTimer, v.focusMinutes, v.available, v.energy);
    if (timer.style === "manual") reason = manualTimerReason(timer.focus, timer.rest, lang);
    var pattern = timerPattern(timer, lang);

    var tasks;
    var questions;
    if (v.type === "study") {
      tasks = en ? [
        "Open " + topic + " and choose one small section or heading to cover.",
        "Turn that heading into a question; read to answer it, not to highlight everything.",
        "Close the notes and recall three key points aloud or on paper.",
        "Check the source, correct only gaps, and write one next question."
      ] : [
        "Άνοιξε το " + topic + " και διάλεξε μία μικρή ενότητα ή επικεφαλίδα.",
        "Κάνε την επικεφαλίδα ερώτηση· διάβασε για να απαντήσεις, όχι για να υπογραμμίσεις τα πάντα.",
        "Κλείσε τις σημειώσεις και ανάκλησε τρία βασικά σημεία προφορικά ή γραπτώς.",
        "Έλεγξε το βιβλίο, διόρθωσε μόνο τα κενά και γράψε την επόμενη ερώτηση."
      ];
      questions = en ? [
        "What are the three most important ideas in " + topic + "?",
        "How would you explain one idea to someone who has not studied it?",
        "What is still unclear, and what example could make it concrete?"
      ] : [
        "Ποιες είναι οι τρεις πιο σημαντικές ιδέες στο " + topic + ";",
        "Πώς θα εξηγούσες μία ιδέα σε κάποιον που δεν την έχει διαβάσει;",
        "Τι παραμένει ασαφές και ποιο παράδειγμα θα το έκανε πιο συγκεκριμένο;"
      ];
    } else {
      tasks = en ? [
        "Define what 'done' looks like for " + topic + " in one visible sentence.",
        "Pick the smallest next action that takes two minutes or less and begin it.",
        "Work on one chunk only; park unrelated thoughts instead of switching tasks.",
        "Use the final minutes to check the result and note the next concrete action."
      ] : [
        "Όρισε με μία πρόταση πώς θα φαίνεται ολοκληρωμένο το " + topic + ".",
        "Διάλεξε το μικρότερο επόμενο βήμα που γίνεται σε δύο λεπτά ή λιγότερο και ξεκίνα.",
        "Δούλεψε μόνο ένα κομμάτι· σημείωσε τις άσχετες σκέψεις αντί να αλλάξεις εργασία.",
        "Κράτησε τα τελευταία λεπτά για έλεγχο και γράψε το επόμενο συγκεκριμένο βήμα."
      ];
      questions = en ? [
        "What single result would make this session useful?",
        "What is the first action I can do without more preparation?",
        "What can wait until after this focus block?"
      ] : [
        "Ποιο ένα αποτέλεσμα θα έκανε χρήσιμη αυτή τη συνεδρία;",
        "Ποιο είναι το πρώτο βήμα που μπορώ να κάνω χωρίς άλλη προετοιμασία;",
        "Τι μπορεί να περιμένει μέχρι να τελειώσει αυτός ο κύκλος;"
      ];
    }
    var excerpts = String(documentText || "").split(/(?<=[.!?])\s+/).map(function (part) { return part.trim(); }).filter(function (part) { return part.length >= 28; }).slice(0, 3).map(function (part) { return part.slice(0, 180); });
    if (excerpts.length) {
      tasks[0] = en ? "Review this extracted point from your file: “" + excerpts[0] + "”" : "Μελέτησε αυτό το σημείο από το αρχείο σου: «" + excerpts[0] + "»";
      questions = excerpts.map(function (part) { return (en ? "Explain in your own words: “" : "Εξήγησε με δικά σου λόγια: «") + part + (en ? "”" : "»"); });
    }
    return { title: title, topic: topic, type: v.type, timer: timer, recommendedTimer: recommendedTimer, pattern: pattern, reason: reason, recommendedReason: recommendedReason, tasks: tasks, questions: questions, quiz: [] };
  }
  function readUsage(now) {
    var today = localDay(now);
    try {
      var data = JSON.parse(window.localStorage.getItem(USAGE_KEY) || "null");
      if (!data || data.day !== today || !Number.isFinite(data.used)) return { day: today, used: 0, persistent: true };
      return { day: today, used: clamp(Math.floor(data.used), 0, GUEST_LIMIT), persistent: true };
    } catch (e) {
      return { day: today, used: memoryGuestCount, persistent: false };
    }
  }
  function writeUsage(value) {
    memoryGuestCount = clamp(value.used, 0, GUEST_LIMIT);
    try { window.localStorage.setItem(USAGE_KEY, JSON.stringify({ day: value.day, used: memoryGuestCount })); } catch (e) { /* keep this-tab limit in memory if storage is blocked */ }
  }
  function consumeGuestPlan(now) {
    var count = readUsage(now);
    if (count.used >= GUEST_LIMIT) return { allowed: false, used: count.used, remaining: 0 };
    count.used += 1;
    writeUsage(count);
    return { allowed: true, used: count.used, remaining: GUEST_LIMIT - count.used };
  }
  function copyCheckin(value) {
    var v = normalized(value);
    return { type: v.type, topic: v.topic, energy: v.energy, available: v.available, focusMinutes: v.focusMinutes };
  }
  function readGuestCheckin() {
    try {
      var raw = window.localStorage.getItem(CHECKIN_KEY);
      if (raw) { memoryCheckin = copyCheckin(JSON.parse(raw)); return copyCheckin(memoryCheckin); }
    } catch (e) { /* retain this-tab values if storage is blocked */ }
    return memoryCheckin ? copyCheckin(memoryCheckin) : null;
  }
  function saveGuestCheckin(value) {
    memoryCheckin = copyCheckin(value);
    try { window.localStorage.setItem(CHECKIN_KEY, JSON.stringify(memoryCheckin)); return true; }
    catch (e) { return false; }
  }
  function cleanHistoryEntry(value) {
    if (!value || typeof value !== "object") return null;
    var checkin = copyCheckin(value.checkin || value.values || value);
    var focus = Number(value.focusMinutes), rest = Number(value.breakMinutes);
    if (!checkin.topic || !Number.isInteger(focus) || focus < 5 || focus > 180 || focus > checkin.available) return null;
    if (!Number.isInteger(rest) || rest < 0 || rest > 180) rest = 0;
    return { createdAt: String(value.createdAt || "").slice(0, 40), checkin: checkin, focusMinutes: focus, breakMinutes: Math.min(rest, checkin.available - focus) };
  }
  function readGuestHistory() {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        memoryHistory = parsed.map(cleanHistoryEntry).filter(Boolean).slice(0, HISTORY_LIMIT);
        return memoryHistory.slice();
      }
    } catch (e) { /* retain this-tab history if storage is blocked */ }
    return memoryHistory.slice(0, HISTORY_LIMIT);
  }
  function saveGuestHistory(values, plan, now) {
    var timer = plan && plan.timer || recommend(values);
    var stamp = now && typeof now.toISOString === "function" ? now.toISOString() : new Date().toISOString();
    var entry = cleanHistoryEntry({ createdAt: stamp, checkin: copyCheckin(values), focusMinutes: timer.focus, breakMinutes: timer.rest });
    if (!entry) return false;
    memoryHistory = [entry].concat(readGuestHistory()).slice(0, HISTORY_LIMIT);
    try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(memoryHistory)); return true; }
    catch (e) { return false; }
  }
  function buildAiRequest(values, documentText) {
    var v = copyCheckin(values);
    return { consent: true, topic: v.topic, taskType: v.type, energy: v.energy, available: v.available, documentText: String(documentText || "").slice(0, MAX_DOCUMENT_CHARS) };
  }
  function validateAiResponse(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.steps) || !Array.isArray(data.questions) || !data.timer || typeof data.timer !== "object") throw new Error("bad_ai_response");
    return data;
  }
  function loadPdfJs() {
    if (window.pdfjsLib && window.pdfjsLib.getDocument) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = function () { window.pdfjsLib && window.pdfjsLib.getDocument ? resolve(window.pdfjsLib) : reject(new Error("PDF reader unavailable")); };
      script.onerror = function () { reject(new Error("PDF reader could not load")); };
      document.head.appendChild(script);
    });
  }
  async function extractDocument(file) {
    var ext = String(file && file.name || "").toLowerCase().split(".").pop();
    if (!file || file.size > MAX_FILE_BYTES || ["pdf", "txt", "md"].indexOf(ext) < 0) throw new Error("unsupported_file");
    var text = "";
    if (ext === "txt" || ext === "md") {
      text = await file.text();
    } else {
      var pdfjs = await loadPdfJs();
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      var task = pdfjs.getDocument({ data: await file.arrayBuffer() });
      var pdf = await task.promise;
      var pages = Math.min(pdf.numPages, 40);
      for (var pageNo = 1; pageNo <= pages && text.length < MAX_DOCUMENT_CHARS; pageNo += 1) {
        var page = await pdf.getPage(pageNo);
        var content = await page.getTextContent();
        text += content.items.map(function (item) { return item.str || ""; }).join(" ") + "\n";
      }
      if (task.destroy) task.destroy();
    }
    text = String(text).replace(/\u0000/g, " ").trim().slice(0, MAX_DOCUMENT_CHARS);
    if (text.length < 20) throw new Error("no_text_found");
    return text;
  }
  function appendItems(list, items) {
    if (!list) return;
    list.replaceChildren();
    items.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
  }
  function loadSupabase() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    return new Promise(function (resolve) {
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
      script.async = true;
      script.onload = function () { resolve(window.supabase || null); };
      script.onerror = function () { resolve(null); };
      document.head.appendChild(script);
    });
  }
  function init() {
    var enabled = !!(window.NepsisFeatureFlags && window.NepsisFeatureFlags.aiCoach === true);
    var disabled = document.getElementById("coachDisabled");
    var app = document.getElementById("coachApp");
    if (!enabled) {
      if (disabled) disabled.hidden = false;
      return;
    }
    if (app) app.hidden = false;
    var form = document.getElementById("coachForm");
    var topic = document.getElementById("coachTopic");
    var type = document.getElementById("taskType");
    var energy = document.getElementById("coachEnergy");
    var minutes = document.getElementById("coachMinutes");
    var focusDuration = document.getElementById("coachFocusMinutes");
    var energyValue = document.getElementById("coachEnergyValue");
    var message = document.getElementById("coachMessage");
    var usageNote = document.getElementById("coachUsage");
    var result = document.getElementById("coachResult");
    var upsell = document.getElementById("coachUpsell");
    var accountStatus = document.getElementById("coachAccountStatus");
    var activeTimerLink = document.getElementById("launchTimer");
    var recommendedFocusButton = document.getElementById("coachUseRecommended");
    var historySection = document.getElementById("coachHistory");
    var historyList = document.getElementById("coachHistoryList");
    var storageStatus = document.getElementById("coachStorageStatus");
    var initialCheckin = readGuestCheckin();
    if (initialCheckin) {
      type.value = initialCheckin.type;
      topic.value = initialCheckin.topic;
      energy.value = String(initialCheckin.energy);
      minutes.value = String(initialCheckin.available);
      if (focusDuration) focusDuration.value = initialCheckin.focusMinutes ? String(initialCheckin.focusMinutes) : "";
      var initialEnergyChoice = document.querySelector('input[name="coachEnergyChoice"][value="' + initialCheckin.energy + '"]');
      if (initialEnergyChoice) initialEnergyChoice.checked = true;
      if (energyValue) energyValue.textContent = initialCheckin.energy + "/5";
    }

    function tr(el, elText, enText) { if (el) el.textContent = currentLang === "en" ? enText : elText; }
    function usage() { return readUsage(); }
    function renderStatus() {
      if (accountStatus) accountStatus.textContent = signedIn ? (currentLang === "en" ? "Signed in · unlimited plans" : "Συνδεδεμένος · απεριόριστα πλάνα") : (currentLang === "en" ? "Guest · 2 free plans/day" : "Επισκέπτης · 2 δωρεάν πλάνα/ημέρα");
      if (!signedIn && usageNote) {
        var left = Math.max(0, GUEST_LIMIT - usage().used);
        usageNote.textContent = currentLang === "en" ? left + " of 2 guest plans left today · history stays on this device" : "Απομένουν " + left + " από 2 πλάνα επισκέπτη · το ιστορικό μένει σε αυτή τη συσκευή";
      } else if (usageNote) usageNote.textContent = currentLang === "en" ? "AI requests remain subject to service limits · check-ins stay on this device" : "Τα αιτήματα AI έχουν όριο υπηρεσίας · οι έλεγχοι μένουν σε αυτή τη συσκευή";
      if (storageStatus) {
        var persistent = usage().persistent;
        storageStatus.textContent = persistent ? (currentLang === "en" ? "Check-ins and recent history are stored only in this browser; they are never synced." : "Οι έλεγχοι και το πρόσφατο ιστορικό αποθηκεύονται μόνο σε αυτόν τον browser· δεν συγχρονίζονται.") : (currentLang === "en" ? "This browser blocks local storage; saved check-ins may not survive closing this tab." : "Ο browser μπλοκάρει την τοπική αποθήκευση· οι έλεγχοι ίσως χαθούν όταν κλείσει η καρτέλα.");
      }
    }
    function renderPlan(plan) {
      if (!plan || !result) return;
      tr(document.getElementById("resultTitle"), plan.title, plan.title);
      var pill = document.getElementById("timerPattern");
      if (pill) pill.textContent = "Nepsis · " + plan.pattern;
      tr(document.getElementById("timerWhy"), plan.reason, plan.reason);
      appendItems(document.getElementById("microTasks"), plan.tasks);
      appendItems(document.getElementById("studyQuestions"), plan.questions);
      var quizBlock = document.getElementById("quizBlock");
      if (quizBlock) { appendItems(document.getElementById("recallQuiz"), (plan.quiz || []).map(function (item) { return item.question + " — " + item.answer; })); quizBlock.hidden = !(plan.quiz && plan.quiz.length); }
      if (activeTimerLink) {
        activeTimerLink.href = "practice.html?coachStart=" + encodeURIComponent(plan.timer.focus) + "#stage-" + encodeURIComponent(plan.timer.focus);
        activeTimerLink.textContent = currentLang === "en" ? "Start " + plan.timer.focus + " min on the Nepsis timer" : "Ξεκίνα " + plan.timer.focus + "′ στο χρονόμετρο Nepsis";
        activeTimerLink.setAttribute("aria-disabled", "false");
        activeTimerLink.classList.remove("is-disabled");
      }
      result.hidden = false;
      if (upsell) upsell.hidden = false;
    }
    function formValues() {
      return normalized({ type: type.value, topic: topic.value, energy: energy.value, available: minutes.value, focusMinutes: focusDuration ? focusDuration.value : 0 });
    }
    function renderHistory() {
      if (!historyList) return;
      while (historyList.firstChild) historyList.removeChild(historyList.firstChild);
      var entries = readGuestHistory();
      if (historySection) historySection.hidden = entries.length === 0;
      entries.forEach(function (entry, index) {
        var item = document.createElement("li");
        item.className = "coach-history-item";
        var copy = document.createElement("div");
        copy.className = "coach-history-copy";
        var title = document.createElement("strong");
        title.textContent = entry.checkin.topic;
        var detail = document.createElement("span");
        var date = new Date(entry.createdAt);
        var dateText = Number.isFinite(date.getTime()) ? date.toLocaleDateString(currentLang === "en" ? "en-US" : "el-GR", { month: "short", day: "numeric" }) : "";
        detail.textContent = (currentLang === "en" ? entry.focusMinutes + " min focus · " + entry.checkin.available + " min available" : entry.focusMinutes + "′ εστίαση · " + entry.checkin.available + "′ διαθέσιμα") + (dateText ? " · " + dateText : "");
        copy.appendChild(title);
        copy.appendChild(detail);
        var button = document.createElement("button");
        button.type = "button";
        button.className = "coach-history-load";
        button.textContent = currentLang === "en" ? "Load check-in" : "Φόρτωσε";
        button.setAttribute("aria-label", (currentLang === "en" ? "Load saved check-in: " : "Φόρτωσε τον αποθηκευμένο έλεγχο: ") + entry.checkin.topic);
        button.addEventListener("click", function () { restoreHistoryEntry(entry); });
        item.appendChild(copy);
        item.appendChild(button);
        historyList.appendChild(item);
      });
    }
    function restoreHistoryEntry(entry) {
      if (!entry || !entry.checkin) return;
      type.value = entry.checkin.type;
      topic.value = entry.checkin.topic;
      energy.value = String(entry.checkin.energy);
      minutes.value = String(entry.checkin.available);
      if (focusDuration) focusDuration.value = String(entry.focusMinutes);
      var choices = document.querySelectorAll('input[name="coachEnergyChoice"]');
      Array.prototype.forEach.call(choices, function (choice) { choice.checked = choice.value === String(entry.checkin.energy); });
      if (energyValue) energyValue.textContent = entry.checkin.energy + "/5";
      var values = formValues();
      saveGuestCheckin(values);
      lastPlan = createPlan(values, currentLang, "");
      renderPlan(lastPlan);
      if (message) message.textContent = currentLang === "en" ? "Restored from this browser. Nothing was sent to AI." : "Επαναφέρθηκε από αυτόν τον browser. Δεν στάλθηκε κάτι στο AI.";
      renderStatus();
    }
    function syncDurationField() {
      if (!focusDuration) return true;
      var available = Number(minutes.value);
      var raw = focusDuration.value;
      var max = Number.isInteger(available) && available >= 5 && available <= 180 ? available : 180;
      focusDuration.max = String(max);
      var chosen = raw === "" ? 0 : Number(raw);
      var invalid = raw !== "" && (!Number.isInteger(chosen) || chosen < 5 || chosen > 180 || chosen > max);
      focusDuration.setCustomValidity(invalid ? (currentLang === "en" ? "Choose a whole number from 5 minutes up to the time available." : "Διάλεξε ακέραιο αριθμό από 5 λεπτά έως τον διαθέσιμο χρόνο.") : "");
      focusDuration.setAttribute("aria-invalid", invalid ? "true" : "false");
      return !invalid && focusDuration.validity.valid && minutes.validity.valid;
    }
    function disableTimerLaunch() {
      if (!activeTimerLink) return;
      activeTimerLink.removeAttribute("href");
      activeTimerLink.setAttribute("aria-disabled", "true");
      activeTimerLink.classList.add("is-disabled");
    }
    function updateFocusChoice() {
      var durationValid = syncDurationField();
      var currentValues = formValues();
      saveGuestCheckin(currentValues);
      if (!lastPlan) return;
      if (!durationValid) { disableTimerLaunch(); return; }
      var values = formValues();
      var baseTimer = lastPlan.recommendedTimer || recommend(values);
      lastPlan.timer = applyFocusChoice(baseTimer, values.focusMinutes, values.available, values.energy);
      lastPlan.pattern = timerPattern(lastPlan.timer, currentLang);
      lastPlan.reason = lastPlan.timer.style === "manual" ? manualTimerReason(lastPlan.timer.focus, lastPlan.timer.rest, currentLang) : (lastPlan.recommendedReason || lastPlan.reason);
      renderPlan(lastPlan);
    }
    function showUpsellLimit() {
      if (message) {
        message.classList.add("coach-error");
        message.textContent = currentLang === "en" ? "You've reached today's two-plan guest limit. Optional access is available through Whop." : "Έφτασες το ημερήσιο όριο των δύο πλάνων επισκέπτη. Υπάρχει προαιρετική πρόσβαση μέσω Whop.";
      }
      if (upsell) upsell.hidden = false;
      if (result) result.hidden = true;
    }
    async function requestAiPlan(values, documentText) {
      var session = null;
      if (signedIn && authClient && authClient.auth) {
        try {
          var sessionResult = await authClient.auth.getSession();
          session = sessionResult && sessionResult.data && sessionResult.data.session;
        } catch (e) { /* expired account sessions fall back to the guest request path */ }
      }
      var bearer = session && session.access_token ? session.access_token : SUPABASE_KEY;
      var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
      var timeout = null;
      var request = {
        method: "POST",
        headers: { "content-type": "application/json", apikey: SUPABASE_KEY, authorization: "Bearer " + bearer },
        body: JSON.stringify(buildAiRequest(values, documentText))
      };
      if (controller) request.signal = controller.signal;
      var data;
      try {
        data = await Promise.race([
          (async function () {
            var response = await window.fetch(SUPABASE_URL + "/functions/v1/ai-study-coach", request);
            if (!response.ok) throw new Error(response.status === 429 ? "daily_limit_reached" : "ai_unavailable");
            return validateAiResponse(await response.json());
          })(),
          new Promise(function (_resolve, reject) {
            timeout = window.setTimeout(function () {
              if (controller) controller.abort();
              reject(new Error("ai_timeout"));
            }, 10000);
          })
        ]);
      } finally { if (timeout !== null) window.clearTimeout(timeout); }
      var timer = recommend(values);
      var focus = Number(data.timer.focusMinutes);
      if ([5, 10, 25, 45, 60].indexOf(focus) < 0 || focus > values.available) focus = timer.focus;
      var rest = Number(data.timer.breakMinutes);
      if (!Number.isInteger(rest) || rest < 0 || rest > 15) rest = timer.rest;
      rest = Math.min(rest, Math.max(0, values.available - focus));
      var recommendedTimer = { focus: focus, rest: rest, style: "ai", available: values.available, energy: values.energy };
      var selectedTimer = applyFocusChoice(recommendedTimer, values.focusMinutes, values.available, values.energy);
      var recommendedReason = String(data.timer.why || "").slice(0, 420);
      return { title: currentLang === "en" ? "Study & focus: " + values.topic : "Μελέτη και συγκέντρωση: " + values.topic,
        topic: values.topic, type: values.type, timer: selectedTimer, recommendedTimer: recommendedTimer,
        pattern: timerPattern(selectedTimer, currentLang), reason: selectedTimer.style === "manual" ? manualTimerReason(selectedTimer.focus, selectedTimer.rest, currentLang) : recommendedReason, recommendedReason: recommendedReason,
        tasks: data.steps.slice(0, 6).map(function (item) { return String(item).slice(0, 420); }),
        questions: data.questions.slice(0, 5).map(function (item) { return String(item).slice(0, 280); }),
        quiz: Array.isArray(data.quiz) ? data.quiz.slice(0, 8).filter(function (item) { return item && item.question && item.answer; }).map(function (item) { return { question: String(item.question).slice(0, 280), answer: String(item.answer).slice(0, 420) }; }) : [] };
    }
    async function submit(event) {
      event.preventDefault();
      if (message) { message.textContent = ""; message.classList.remove("coach-error"); }
      if (form && !form.reportValidity()) return;
      var values = formValues();
      if (!values.topic) {
        if (message) message.textContent = currentLang === "en" ? "Add a subject or task to build a plan." : "Γράψε ένα μάθημα ή εργασία για να φτιάξουμε πλάνο.";
        topic.focus();
        return;
      }
      if (selectedFile && !extractedDocumentText) {
        if (message) message.textContent = currentLang === "en" ? "Wait for the file to finish extracting, or remove it to continue." : "Περίμενε να ολοκληρωθεί η εξαγωγή ή αφαίρεσε το αρχείο για να συνεχίσεις.";
        return;
      }
      if (!signedIn && !consumeGuestPlan().allowed) { showUpsellLimit(); return; }
      var submitButton = form.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      var localPlan = createPlan(values, currentLang, extractedDocumentText);
      var aiConsent = document.getElementById("aiConsent");
      var useAi = !!(aiConsent && aiConsent.checked);
      if (useAi) {
        if (message) message.textContent = currentLang === "en" ? "Generating a plan… Your check-in and extracted text are being sent to Nepsis AI." : "Δημιουργείται πλάνο… Οι απαντήσεις και το εξαγμένο κείμενο στέλνονται στο Nepsis AI.";
        try {
          var aiPlan = await requestAiPlan(values, extractedDocumentText);
          if (aiPlan.tasks.length) localPlan.tasks = aiPlan.tasks;
          if (aiPlan.questions.length) localPlan.questions = aiPlan.questions;
          localPlan.timer = aiPlan.timer; localPlan.recommendedTimer = aiPlan.recommendedTimer; localPlan.pattern = aiPlan.pattern; localPlan.reason = aiPlan.reason || localPlan.reason; localPlan.recommendedReason = aiPlan.recommendedReason || localPlan.recommendedReason; localPlan.quiz = aiPlan.quiz;
          lastPlan = localPlan;
          if (message) message.textContent = currentLang === "en" ? "Personalized plan generated with Nepsis AI." : "Το εξατομικευμένο πλάνο δημιουργήθηκε από το Nepsis AI.";
        } catch (error) {
          lastPlan = localPlan;
          if (message) message.textContent = currentLang === "en" ? "AI is unavailable, slow, or at its daily limit. Here is your local plan; your file was not saved." : "Το AI δεν είναι διαθέσιμο, καθυστερεί ή έφτασε το ημερήσιο όριο. Ορίστε το τοπικό πλάνο· το αρχείο δεν αποθηκεύτηκε.";
        }
      } else {
        lastPlan = localPlan;
        if (message) message.textContent = currentLang === "en" ? "Local plan ready. Nothing was sent to an AI service." : "Το τοπικό πλάνο είναι έτοιμο. Δεν στάλθηκε τίποτα σε υπηρεσία AI.";
      }
      renderPlan(lastPlan);
      saveGuestCheckin(values);
      saveGuestHistory(values, lastPlan);
      renderHistory();
      renderStatus();
      if (submitButton) submitButton.disabled = false;
      if (result) result.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function setLanguage(lang) {
      currentLang = lang === "en" ? "en" : "el";
      document.documentElement.lang = currentLang;
      document.querySelectorAll("[data-el][data-en]").forEach(function (el) {
        const next = el.getAttribute("data-" + currentLang);
        if (el.tagName === "TITLE") {
          document.title = next || document.title;
          el.textContent = next || el.textContent;
          return;
        }
        el.textContent = next;
      });
      document.querySelectorAll("[data-placeholder-el][data-placeholder-en]").forEach(function (el) {
        el.placeholder = el.getAttribute("data-placeholder-" + currentLang);
      });
      document.querySelectorAll("[data-set-lang]").forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-set-lang") === currentLang ? "true" : "false");
      });
      if (energyValue) energyValue.textContent = energy.value + "/5";
      renderStatus();
      if (lastPlan && !document.getElementById("aiConsent")?.checked) { lastPlan = createPlan({ type: type.value, topic: topic.value, energy: energy.value, available: minutes.value, focusMinutes: focusDuration ? focusDuration.value : 0 }, currentLang, extractedDocumentText); renderPlan(lastPlan); }
      if (!syncDurationField()) disableTimerLaunch();
    }
    form.addEventListener("submit", submit);
    form.addEventListener("input", function () { saveGuestCheckin(formValues()); renderStatus(); });
    form.addEventListener("change", function () { saveGuestCheckin(formValues()); renderStatus(); });
    if (focusDuration) {
      focusDuration.addEventListener("input", updateFocusChoice);
      focusDuration.addEventListener("change", updateFocusChoice);
    }
    if (recommendedFocusButton) recommendedFocusButton.addEventListener("click", function () {
      if (!focusDuration) return;
      focusDuration.value = "";
      updateFocusChoice();
      focusDuration.focus();
    });
    minutes.addEventListener("input", updateFocusChoice);
    minutes.addEventListener("change", updateFocusChoice);
    syncDurationField();
    renderHistory();
    var energyChoices = document.querySelectorAll('input[name="coachEnergyChoice"]');
    Array.prototype.forEach.call(energyChoices, function (choice) {
      choice.addEventListener("change", function () {
        if (!choice.checked) return;
        energy.value = choice.value;
        if (energyValue) energyValue.textContent = choice.value + "/5";
        if (lastPlan && !document.getElementById("aiConsent")?.checked) {
          lastPlan = createPlan({ type: type.value, topic: topic.value, energy: energy.value, available: minutes.value, focusMinutes: focusDuration ? focusDuration.value : 0 }, currentLang, extractedDocumentText);
          renderPlan(lastPlan);
        }
      });
    });
    var fileInput = document.getElementById("coachFile");
    var docStatus = document.getElementById("coachDocumentStatus");
    var saveDocumentButton = document.getElementById("saveDocument");
    if (fileInput) fileInput.addEventListener("change", function () {
      selectedFile = fileInput.files && fileInput.files[0] || null;
      extractedDocumentText = "";
      if (saveDocumentButton) saveDocumentButton.hidden = true;
      if (!selectedFile) { if (docStatus) docStatus.textContent = ""; return; }
      if (selectedFile.size > MAX_FILE_BYTES) { selectedFile = null; fileInput.value = ""; if (docStatus) docStatus.textContent = currentLang === "en" ? "File exceeds the 8 MB limit." : "Το αρχείο ξεπερνά το όριο των 8 MB."; return; }
      if (docStatus) docStatus.textContent = currentLang === "en" ? "Extracting text on this device…" : "Εξαγωγή κειμένου σε αυτή τη συσκευή…";
      extractionPromise = extractDocument(selectedFile).then(function (text) {
        extractedDocumentText = text;
        if (docStatus) docStatus.textContent = currentLang === "en" ? "Extracted " + text.length + " characters locally from “" + selectedFile.name + "”. Not sent unless you give consent." : "Εξήχθησαν τοπικά " + text.length + " χαρακτήρες από «" + selectedFile.name + "». Δεν στέλνονται χωρίς συγκατάθεση.";
        if (saveDocumentButton) saveDocumentButton.hidden = !signedIn;
        return text;
      }).catch(function (error) {
        selectedFile = null; extractedDocumentText = ""; fileInput.value = "";
        if (docStatus) docStatus.textContent = error && error.message === "no_text_found" ? (currentLang === "en" ? "No readable text found. Scanned PDFs need OCR." : "Δεν βρέθηκε αναγνώσιμο κείμενο. Τα σαρωμένα PDF χρειάζονται OCR.") : (currentLang === "en" ? "Could not read this file. Choose a PDF, TXT, or MD under 8 MB." : "Δεν ήταν δυνατή η ανάγνωση. Διάλεξε PDF, TXT ή MD έως 8 MB.");
        throw error;
      });
      extractionPromise.catch(function () {});
    });
    if (saveDocumentButton) saveDocumentButton.addEventListener("click", async function () {
      if (!signedIn || !selectedFile || !authClient) { if (docStatus) docStatus.textContent = currentLang === "en" ? "Sign in and choose a file first." : "Συνδέσου και διάλεξε πρώτα αρχείο."; return; }
      saveDocumentButton.disabled = true;
      try {
        var sessionState = await authClient.auth.getSession();
        var session = sessionState && sessionState.data && sessionState.data.session;
        if (!session || !session.user) throw new Error("sign_in_required");
        var suffix = selectedFile.name.toLowerCase().split(".").pop();
        var objectPath = session.user.id + "/" + (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) + "." + suffix;
        var typeByExt = { pdf: "application/pdf", txt: "text/plain", md: "text/markdown" };
        var saved = await authClient.storage.from("nepsis-study-materials").upload(objectPath, selectedFile, { upsert: false, contentType: typeByExt[suffix] });
        if (saved.error) throw saved.error;
        if (docStatus) docStatus.textContent = currentLang === "en" ? "Private copy saved in your account. It was not shared." : "Το ιδιωτικό αντίγραφο αποθηκεύτηκε στον λογαριασμό σου. Δεν κοινοποιήθηκε.";
      } catch (error) {
        if (docStatus) docStatus.textContent = currentLang === "en" ? "Could not save the private copy. Your local file is unchanged." : "Δεν αποθηκεύτηκε το ιδιωτικό αντίγραφο. Το τοπικό αρχείο δεν άλλαξε.";
      } finally { saveDocumentButton.disabled = false; }
    });
    document.querySelectorAll("[data-set-lang]").forEach(function (button) {
      button.addEventListener("click", function () { setLanguage(button.getAttribute("data-set-lang")); });
    });
    var whopLinks = document.querySelectorAll("a[href='https://whop.com/nepsis-focus']");
    Array.prototype.forEach.call(whopLinks, function (a) { a.href = WHOP_URL; });
    renderStatus();
    loadSupabase().then(function (supabaseLib) {
      if (!supabaseLib || !supabaseLib.createClient) return;
      try {
        authClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY, window.NepsisGoogleAuth ? window.NepsisGoogleAuth.clientOptions() : undefined);
        if (window.NepsisGoogleAuth) window.NepsisGoogleAuth.watchPopupCompletion(authClient);
        authClient.auth.getSession().then(function (result) {
          signedIn = !!(result && !result.error && result.data && result.data.session && result.data.session.user);
          if (saveDocumentButton && selectedFile) saveDocumentButton.hidden = !signedIn;
          renderStatus();
        }).catch(function () { signedIn = false; renderStatus(); });
        authClient.auth.onAuthStateChange(function (_event, session) {
          signedIn = !!(session && session.user);
          if (saveDocumentButton && selectedFile) saveDocumentButton.hidden = !signedIn;
          renderStatus();
        });
      } catch (e) { signedIn = false; renderStatus(); }
    });
  }

  window.NepsisCoach = Object.freeze({ recommend: recommend, createPlan: createPlan, normalize: normalized, applyFocusChoice: applyFocusChoice, timerPattern: timerPattern, guestLimit: GUEST_LIMIT, readGuestUsage: readUsage, consumeGuestPlan: consumeGuestPlan, readGuestCheckin: readGuestCheckin, saveGuestCheckin: saveGuestCheckin, readGuestHistory: readGuestHistory, saveGuestHistory: saveGuestHistory, buildAiRequest: buildAiRequest, validateAiResponse: validateAiResponse });
  if (document && typeof document.getElementById === "function") init();
})(typeof window === "undefined" ? globalThis : window, typeof document === "undefined" ? null : document);
