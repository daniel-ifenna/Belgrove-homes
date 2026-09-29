"use client";

import { useEffect, useRef, useState } from "react";
import { SITE_STATS } from "@/lib/site";

const STORAGE_KEY = "belgrove_intro_done";
const FULL_TEXT = "Welcome to Belgrove Homes";

// Cinematic entrance. Plays once per browser session (flag is set the moment
// it starts, so closing the tab mid-play never replays it). Skippable via the
// Skip button or Escape. prefers-reduced-motion skips it entirely.
// Sequence: logo pops in first, fades out into the "Welcome to Belgrove
// Homes" typewriter, then figures + bar, then the whole overlay fades into
// the site (~4.3s total). Figures come from the shared SITE_STATS config —
// the same source as the "Trusted by families" section. Without JavaScript
// this renders nothing, so the homepage is never blocked behind it.
export default function CinematicIntroLoader() {
  // Decided during render (read-only): SSR renders null, and a session that
  // already saw the intro never mounts it. The session flag is *written* in
  // the effect below, keeping render pure.
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      if (sessionStorage.getItem(STORAGE_KEY)) return false;
    } catch {
      return false;
    }
    return true;
  });
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"logo" | "text">("logo");
  const [logoLeaving, setLogoLeaving] = useState(false);
  const [metaVisible, setMetaVisible] = useState(false);
  const [fill, setFill] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const dismissRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!show) return;

    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Every timer lives here so Skip/Escape/unmount can cancel all of them.
    const timers: number[] = [];
    let interval = 0;
    let dismissed = false;
    const later = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    // Single guarded exit: clears the typewriter and all pending timeouts,
    // fades out, then unmounts and restores scroll exactly once.
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      window.clearInterval(interval);
      timers.forEach((t) => window.clearTimeout(t));
      setFadingOut(true);
      const done = window.setTimeout(() => {
        setShow(false);
        document.body.style.overflow = prevOverflow;
      }, 420);
      timers.push(done);
    };
    dismissRef.current = dismiss;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);

    // Phase 1 — logo pops in first, then fades out into the typewriter.
    const startTyping = () => {
      setPhase("text");
      let idx = 0;
      interval = window.setInterval(() => {
        idx += 1;
        setTyped(FULL_TEXT.slice(0, idx));
        if (idx >= FULL_TEXT.length) {
          window.clearInterval(interval);
          later(150, () => setMetaVisible(true));
          later(250, () => setFill(true));
        }
      }, 40);
    };
    later(950, () => setLogoLeaving(true));
    later(1300, startTyping);

    later(3900, dismiss);

    return () => {
      dismissed = true;
      window.clearInterval(interval);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ background: "#FFFFFF" }}
    >
      {phase === "logo" ? (
        <div
          className={`pop-in transition-opacity duration-[350ms] ${logoLeaving ? "opacity-0" : "opacity-100"}`}
          aria-hidden="true"
        >
          <img src="/belgrove-icon.png" alt="" width={88} height={71} />
        </div>
      ) : (
        <div className="flex items-center justify-center px-6 text-center">
          <span
            className="font-serif font-semibold tracking-[-0.02em] leading-none inline-flex items-baseline"
            style={{ fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif", color: "#0A170F", fontSize: "clamp(24px, 4.5vw, 36px)" }}
          >
            <span className="whitespace-nowrap">{typed}</span>
            <span
              className="ml-[2px] inline-block w-[2px] h-[1em] bg-[#C89B3C] translate-y-[1px]"
              style={{ opacity: typed.length < FULL_TEXT.length ? 1 : 0, animation: typed.length < FULL_TEXT.length ? "blink 0.9s step-end infinite" : "none" }}
              aria-hidden="true"
            />
          </span>
        </div>
      )}

      <div
        className={`mt-5 flex items-center gap-6 transition-opacity duration-[400ms] ${metaVisible ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
      >
        {SITE_STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div
              className="font-serif font-semibold"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#0A170F", fontSize: "20px" }}
            >
              {s.display}
            </div>
            <div
              className="mono"
              style={{ fontFamily: "var(--font-plex-mono), monospace", fontSize: "9px", letterSpacing: "0.14em", color: "#5B5346" }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div
        className={`mt-6 transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${metaVisible ? "opacity-100" : "opacity-0"}`}
        style={{ width: "220px", height: "3px", background: "rgba(10,23,15,0.08)", borderRadius: "999px", overflow: "hidden" }}
        role="progressbar"
        aria-label="Loading Belgrove Homes"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fill ? 100 : 0}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: fill ? "100%" : "0%",
            background: "#C89B3C",
            transition: fill ? "width 1200ms cubic-bezier(0.16,1,0.3,1)" : "none",
            willChange: "width",
          }}
        />
      </div>

      <button
        onClick={() => dismissRef.current()}
        className="mono absolute bottom-8 text-[12px] tracking-[0.12em] uppercase text-[#1C2B20] underline decoration-[#C49A3A] underline-offset-4 hover:text-[#8a6d2b]"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        Skip
      </button>

      <style>{`@keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } } @keyframes popIn { 0% { opacity: 0; transform: scale(0.4); } 60% { opacity: 1; transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } } .pop-in { animation: popIn 0.55s cubic-bezier(0.2,0.8,0.2,1) both; }`}</style>
    </div>
  );
}
