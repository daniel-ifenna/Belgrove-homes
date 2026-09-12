"use client";

import { useEffect } from "react";

/**
 * Bootstraps the static /cinematic-intro.js control logic. A plain <script>
 * tag rendered in JSX only executes on a full page load browsers don't
 * run scripts that arrive via DOM patching (client-side navigation back to
 * "/" from another page). Creating and appending the element manually does
 * execute every time, so the intro correctly re-evaluates its
 * sessionStorage gate on every mount, not just the first hard load.
 */
export default function CinematicIntroLoader() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/cinematic-intro.js";
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}
