/* Dark-launch switches for the isolated Nepsis Coach. No secrets belong here. */
(function (window) {
  "use strict";
  window.NepsisFeatureFlags = Object.assign({}, window.NepsisFeatureFlags || {}, {
    aiCoach: true
  });
})(window);
