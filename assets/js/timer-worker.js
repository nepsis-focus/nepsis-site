// Keeps the practice timer ticking in background tabs, where browsers slow down
// page timers. It only sends "tick"; the page still computes time from endAt.
setInterval(function () { postMessage("tick"); }, 250);
