"use client";

import { useEffect, useState } from "react";
import { SITE_STATS } from "@/lib/site";

const STORAGE_KEY = "belgrove_intro_done";
const FULL_TEXT = "Welcome to Belgrove Homes";

// Cinematic entrance. Plays once per browser session (flag is set the moment
// it starts, so closing the tab mid-play never replays it). Skippable via the
// Skip button or Escape. prefers-reduced-motion skips it entirely.
// Total runtime is ~3s: ~0.9s typewriter, figures + bar, 1.2s fill, out.
// Figures come from the shared SITE_STATS config — the same source as the
// "Trusted by families" section. Without JavaScript this renders nothing,
// so the homepage is never blocked behind it.
export default function CinematicIntroLoader() {
  const [show, setShow] = useState(false);
  const [typed, setTyped] = useState("");
  const [metaVisible, setMetaVisible] = useState(false);
  const [fill, setFill] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}

    setShow(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const finish = () => {
      setFadingOut(true);
      window.setTimeout(() => {
        setShow(false);
        document.body.style.overflow = prevOverflow;
      }, 420);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);

    // Typwriter: ~40ms per char (~0.9s), then figures + bar fade in.
    let idx = 0;
    const typeInterval = window.setInterval(() => {
      idx += 1;
      setTyped(FULL_TEXT.slice(0, idx));
      if (idx >= FULL_TEXT.length) {
        window.clearInterval(typeInterval);
        window.setTimeout(() => setMetaVisible(true), 150);
        window.setTimeout(() => setFill(true), 250);
      }
    }, 40);

    const t4 = window.setTimeout(() => setFadingOut(true), 2900);
    const t5 = window.setTimeout(() => {
      setShow(false);
      document.body.style.overflow = prevOverflow;
    }, 3320);

    return () => {
      window.clearInterval(typeInterval);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!show) return null;

  const skip = () => {
    setFadingOut(true);
    window.setTimeout(() => {
      setShow(false);
      document.body.style.overflow = "";
    }, 420);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ background: "#FFFFFF" }}
    >
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
        onClick={skip}
        className="mono absolute bottom-8 text-[12px] tracking-[0.12em] uppercase text-[#5B5346] underline decoration-[#E4D8C1] underline-offset-4 hover:text-[#0A170F]"
        style={{ fontFamily: "var(--font-plex-mono), monospace" }}
      >
        Skip
      </button>

      <style>{`@keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }`}</style>
    </div>
  );
}
