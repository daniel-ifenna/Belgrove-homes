"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "belgrove_intro_done";
const FULL_TEXT = "Welcome to Belgrove Homes";

export default function CinematicIntroLoader() {
  const [show, setShow] = useState(false);
  const [typed, setTyped] = useState("");
  const [barVisible, setBarVisible] = useState(false);
  const [fill, setFill] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
      setShow(false);
      return;
    }

    try {
      if (sessionStorage.getItem(STORAGE_KEY)) {
        setShow(false);
        return;
      }
    } catch {}

    setShow(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Typwriter: ~65ms per char for longer phrase (~1.5s total), then bar loads
    let idx = 0;
    const typeInterval = window.setInterval(() => {
      idx += 1;
      setTyped(FULL_TEXT.slice(0, idx));
      if (idx >= FULL_TEXT.length) {
        window.clearInterval(typeInterval);
        // After typing completes, show bar and start fill
        window.setTimeout(() => setBarVisible(true), 180);
        window.setTimeout(() => setFill(true), 320);
      }
    }, 65);

    // Fallback: ensure bar appears even if interval somehow stalls
    const fallbackBar = window.setTimeout(() => setBarVisible(true), 1800);
    const fallbackFill = window.setTimeout(() => setFill(true), 1950);

    // Auto-continue once bar finishes (1.6s fill) + pause, then fade
    const totalVisible = 1750 + 1600 + 500; // typing ~1.55s + 0.3s gap + 1.6s fill + 0.5s pause
    const t4 = window.setTimeout(() => setFadingOut(true), totalVisible);
    const t5 = window.setTimeout(() => {
      setShow(false);
      document.body.style.overflow = prevOverflow;
      try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
    }, totalVisible + 420);

    return () => {
      window.clearInterval(typeInterval);
      window.clearTimeout(fallbackBar);
      window.clearTimeout(fallbackFill);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ background: "#FFFFFF" }}
    >
      {/* Lockup: Welcome to Belgrove Homes with typwriter — no icon */}
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

      {/* Progress bar — appears after text, then loads */}
      <div
        className={`mt-6 transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${barVisible ? "opacity-100" : "opacity-0"}`}
        style={{ width: "220px", height: "3px", background: "rgba(10,23,15,0.08)", borderRadius: "999px", overflow: "hidden" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fill ? 100 : 0}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: fill ? "100%" : "0%",
            background: "#C89B3C",
            transition: fill ? "width 1600ms cubic-bezier(0.16,1,0.3,1)" : "none",
            willChange: "width",
          }}
        />
      </div>

      <style>{`@keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }`}</style>
    </div>
  );
}
