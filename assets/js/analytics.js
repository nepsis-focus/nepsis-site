(() => {
  const events = new Set([
    "stage_selected", "timer_started", "timer_paused", "timer_resumed", "session_completed",
    "quiz_started", "quiz_completed", "calendar_opened", "login_started", "library_searched",
    "library_saved"
  ]);
  window.nepsisAnalytics = Object.freeze({
    events: Object.freeze([...events]),
    track(name, properties = {}) {
      if (!events.has(name)) return false;
      const safe = {};
      for (const [key, value] of Object.entries(properties)) {
        if (/^(stage|duration|result|section|item_id)$/.test(key) &&
            ["string", "number", "boolean"].includes(typeof value)) safe[key] = value;
      }
      window.dispatchEvent(new CustomEvent("nepsis:analytics", { detail: { name, properties: safe } }));
      // Analytics transmission stays disabled until a consent-aware staging policy is configured.
      return true;
    }
  });
})();
