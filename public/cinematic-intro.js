/* Belgrove Homes — cinematic homepage intro control logic.
   Plain static JS, no build step, no framework dependency. Session-gated:
   plays once per browser session, then stays dismissed for the rest of it. */

(function () {
  var STORAGE_KEY = "belgrove_intro_done";
  var AUTO_DISMISS_MS = 5600;
  var FADE_MS = 600;

  function init() {
    var el = document.getElementById("cinematic");
    if (!el) return;

    // Guard against double-init (e.g. if this script gets loaded twice on
    // the same live DOM, such as a fast remount in dev).
    if (el.dataset.cinInitialized === "1") return;
    el.dataset.cinInitialized = "1";

    if (sessionStorage.getItem(STORAGE_KEY)) {
      el.classList.add("gone");
      return;
    }

    document.body.style.overflow = "hidden";

    var dismissed = false;
    var timers = [];

    function after(ms, fn) {
      timers.push(setTimeout(fn, ms));
    }

    // The 3D building (blueprint -> assembled volumes -> recede) is driven
    // from here via class toggles + CSS transitions, not @keyframes — see
    // the comment above .cin-building in cinematic-intro.css for why that
    // distinction actually matters (it's not a style preference).
    var building = el.querySelector(".cin-building");
    var blocks = el.querySelectorAll(".cin-block");
    var blockDelays = [1050, 1180, 1310, 1440, 1570];

    if (building) {
      after(1050, function () {
        building.classList.add("is-visible");
      });
      after(3200, function () {
        building.classList.add("is-receded");
      });
    }
    blocks.forEach(function (block, i) {
      after(blockDelays[i] !== undefined ? blockDelays[i] : 1050 + i * 130, function () {
        block.classList.add("is-settled");
      });
    });

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      timers.forEach(clearTimeout);

      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // sessionStorage can throw in some privacy modes — the intro just
        // replays next time in that case, which is an acceptable fallback.
      }

      el.classList.add("out");
      setTimeout(function () {
        el.classList.add("gone");
        document.body.style.overflow = "";
      }, FADE_MS);
    }

    el.addEventListener("click", dismiss);
    after(AUTO_DISMISS_MS, dismiss);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
