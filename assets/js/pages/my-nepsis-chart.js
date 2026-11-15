/* Optional, additive weekly progress chart for the My Nepsis dashboard.
 * Load this after assets/js/pages/my-nepsis-1.js. It does not change the
 * existing timer, progress format, authentication, or storage behavior.
 */
(function () {
  "use strict";

  var CHART_URL = "https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js";
  var chart = null;
  var refreshTimer = 0;
  var panel;
  var canvas;
  var title;
  var summary;

  function language() {
    return document.documentElement.lang === "en" ? "en" : "el";
  }

  function text() {
    return language() === "en"
      ? {
          title: "Your focus this week",
          description: "Minutes of focus for each day, Monday to Sunday.",
          minutes: "Focus minutes",
          empty: "Complete a focus session to see your chart.",
          chartLabel: "Focus minutes for the current week",
          weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          total: function (n) { return n + " minutes this week"; }
        }
      : {
          title: "Η συγκέντρωσή σου αυτή την εβδομάδα",
          description: "Λεπτά συγκέντρωσης ανά ημέρα, από Δευτέρα έως Κυριακή.",
          minutes: "Λεπτά συγκέντρωσης",
          empty: "Ολοκλήρωσε μία συνεδρία για να εμφανιστεί το γράφημα.",
          chartLabel: "Λεπτά συγκέντρωσης για την τρέχουσα εβδομάδα",
          weekdays: ["Δευ", "Τρι", "Τετ", "Πέμ", "Παρ", "Σάβ", "Κυρ"],
          total: function (n) { return n + " λεπτά αυτή την εβδομάδα"; }
        };
  }

  function addStyles() {
    if (document.getElementById("nepsis-progress-chart-styles")) return;
    var style = document.createElement("style");
    style.id = "nepsis-progress-chart-styles";
    style.textContent = [
      ".nepsis-chart-panel{margin-top:24px;padding-top:20px;border-top:1px solid var(--border,#eadccb)}",
      ".nepsis-chart-panel h3{font-size:1.15rem;line-height:1.3;margin:0 0 5px;color:var(--fg,#3a2418)}",
      ".nepsis-chart-panel p{margin:0;color:var(--muted,#8a6f5e);font-size:.9rem}",
      ".nepsis-chart-summary{font-weight:800;margin:12px 0!important}",
      ".nepsis-chart-canvas-wrap{position:relative;width:100%;height:220px;margin-top:8px}",
      ".nepsis-chart-panel canvas{display:block;width:100%;height:100%}",
      "@media(prefers-reduced-motion:reduce){.nepsis-chart-panel *{scroll-behavior:auto!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function mount() {
    var anchor = document.getElementById("weekBars");
    var host = anchor && anchor.closest(".tool-panel");
    if (!host) return false;

    addStyles();
    panel = document.createElement("section");
    panel.className = "nepsis-chart-panel";
    panel.setAttribute("aria-labelledby", "nepsisProgressChartTitle");

    title = document.createElement("h3");
    title.id = "nepsisProgressChartTitle";
    var description = document.createElement("p");
    summary = document.createElement("p");
    summary.className = "nepsis-chart-summary";
    summary.setAttribute("aria-live", "polite");

    var wrap = document.createElement("div");
    wrap.className = "nepsis-chart-canvas-wrap";
    canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    wrap.appendChild(canvas);

    panel.append(title, description, summary, wrap);
    host.appendChild(panel);
    updateCopy(description);
    return true;
  }

  function updateCopy(description) {
    var copy = text();
    title.textContent = copy.title;
    description.textContent = copy.description;
    canvas.setAttribute("aria-label", copy.chartLabel);
  }

  function dateKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function minutesForDay(days, key) {
    var entries = days && Array.isArray(days[key]) ? days[key] : [];
    return entries.reduce(function (total, value) {
      return total + Math.max(0, Number(value) || 0);
    }, 0);
  }

  function readProgress() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && /^nepsis-progress:(guest|user:.+)$/.test(key)) keys.push(key);
      }
    } catch (error) {
      return { days: {} };
    }

    var candidates = keys.map(function (key) {
      try {
        var parsed = JSON.parse(localStorage.getItem(key) || "{}");
        return { key: key, days: parsed.days || {} };
      } catch (error) {
        return { key: key, days: {} };
      }
    });

    // The existing dashboard already displays this week's total. Match that
    // value to select the same guest/account progress record it is showing.
    var displayed = document.getElementById("weekMinutes");
    var expected = displayed ? Number(displayed.textContent) : NaN;
    if (Number.isFinite(expected) && candidates.length) {
      var monday = new Date();
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      var matching = candidates.filter(function (candidate) {
        var total = 0;
        for (var day = 0; day < 7; day++) {
          var date = new Date(monday);
          date.setDate(monday.getDate() + day);
          total += minutesForDay(candidate.days, dateKey(date));
        }
        return total === expected;
      });
      if (matching.length) {
        return matching.find(function (item) { return item.key === "nepsis-progress:guest"; }) || matching[matching.length - 1];
      }
    }

    return candidates.find(function (item) { return item.key === "nepsis-progress:guest"; }) || candidates[candidates.length - 1] || { days: {} };
  }

  function getWeekData() {
    var progress = readProgress();
    var monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    var values = [];
    for (var day = 0; day < 7; day++) {
      var date = new Date(monday);
      date.setDate(monday.getDate() + day);
      values.push(minutesForDay(progress.days, dateKey(date)));
    }
    return values;
  }

  function draw() {
    if (!canvas || !window.Chart) return;
    var copy = text();
    var values = getWeekData();
    var total = values.reduce(function (sum, value) { return sum + value; }, 0);
    summary.textContent = total ? copy.total(total) : copy.empty;
    updateCopy(panel.querySelector(".nepsis-chart-panel > p"));

    if (chart) chart.destroy();
    chart = new window.Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: copy.weekdays,
        datasets: [{
          label: copy.minutes,
          data: values,
          backgroundColor: "rgba(185, 85, 42, 0.72)",
          hoverBackgroundColor: "#B9552A",
          borderRadius: 7,
          maxBarThickness: 34
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (context) { return context.parsed.y + " " + copy.minutes.toLowerCase(); } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#8A6F5E" } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#8A6F5E" },
            grid: { color: "rgba(138,111,94,.16)" }
          }
        }
      }
    });
  }

  function loadChart() {
    if (window.Chart) return Promise.resolve();
    var existing = document.querySelector('script[data-nepsis-chartjs]');
    if (existing) {
      return new Promise(function (resolve) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", resolve, { once: true });
      });
    }
    return new Promise(function (resolve) {
      var script = document.createElement("script");
      script.src = CHART_URL;
      script.async = true;
      script.dataset.nepsisChartjs = "true";
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  function scheduleDraw() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(function () {
      if (window.Chart) draw();
    }, 120);
  }

  function start() {
    if (!mount()) return;
    loadChart().then(function () {
      if (window.Chart) draw();
      else summary.textContent = language() === "en"
        ? "The chart needs an internet connection the first time it loads. Your progress is unchanged."
        : "Το γράφημα χρειάζεται σύνδεση στο διαδίκτυο την πρώτη φορά. Η πρόοδός σου δεν επηρεάζεται.";
    });

    var weeklyTotal = document.getElementById("weekMinutes");
    if (weeklyTotal && window.MutationObserver) {
      new MutationObserver(scheduleDraw).observe(weeklyTotal, { childList: true, characterData: true, subtree: true });
    }
    new MutationObserver(scheduleDraw).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
