/* Shared, deterministic Coach safety and custom-session helpers. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NepsisCoachCore = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const LIBRARY_IDS = Object.freeze(["article-1","article-2","article-3","article-4","article-5","article-6","article-7","article-8","article-9","article-10","article-11","article-12","article-13"]);
  const CRISIS = /(|crisis|mental health crisis|panic attack|having a panic attack|κρίση|κρίση πανικού|βρίσκομαι σε κρίση|δεν είμαι ασφαλήςsuicid|kill myself|end my life|end it all|hurt myself|self[- ]harm|want to die|don't want to live|do not want to live|can't go on|\bno reason to live\b|\bin crisis\b|\bunsafe\b|\bnot safe\b|need help now|αυτοκτον|αυτοτραυματισ|κρίση|κινδυνεύω|δεν είμαι ασφαλής|δεν νιώθω ασφαλής|να κάνω κακό στον εαυτό μου|να βλάψω τον εαυτό μου|να βάλω τέλος στη ζωή μου|να τελειώσω τη ζωή μου|δεν θέλω να ζω|δεν θέλω να υπάρχω|θέλω να πεθάνω|δεν αντέχω άλλο)/i;
  const OFF_TOPIC = /(tell me a joke|write (me )?a poem|make (me )?a recipe|recipe for|weather forecast|what is the weather|stock price|crypto price|translate this unrelated|ποιος είναι ο καιρός|τι καιρό θα κάνει|πες μου ένα ανέκδοτο|γράψε ένα ποίημα|συνταγή για)/i;
  function detectCrisis(value) { return CRISIS.test(String(value || "")); }
  function isClearlyOffTopic(value) { return OFF_TOPIC.test(String(value || "")); }
  function isValidLibraryId(value) { return LIBRARY_IDS.indexOf(String(value || "")) !== -1; }
  function isWithinInputLimit(value) { return Array.from(String(value || "")).length <= 1000; }
  function buildBlocks(totalMinutes, blockMinutes, breakMinutes) {
    const total = Number(totalMinutes), block = Number(blockMinutes), rest = Number(breakMinutes);
    if (!Number.isInteger(total) || total < 5 || total > 180) throw new RangeError("invalid_total_minutes");
    if (!((block === 25 && rest === 5) || (block === 50 && rest === 10))) throw new RangeError("invalid_break_pattern");
    const blocks = [];
    let remaining = total;
    while (remaining > 0) {
      const focus = Math.min(block, remaining);
      remaining -= focus;
      blocks.push({ focusMinutes: focus, breakAfterMinutes: remaining > 0 ? rest : 0 });
    }
    return blocks;
  }
  return Object.freeze({ LIBRARY_IDS, detectCrisis, isClearlyOffTopic, isValidLibraryId, isWithinInputLimit, buildBlocks });
});
