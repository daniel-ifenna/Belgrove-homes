"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { PLOT_SIZES, BUDGETS, SITE_ESTATES, HERO_SLIDES } from "@/lib/site";

export default function Hero() {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (m.matches) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section
      className="relative h-[620px] lg:h-[780px]"
      style={{ background: "#12291F" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Featured estates"
    >
      <div className="absolute inset-0 overflow-hidden">
        {HERO_SLIDES.map((h, i) => (
          <div key={h.src} className={`hero-slide ${i === slide ? "on" : ""}`} aria-hidden={i !== slide}>
            <img
              src={h.src}
              alt={h.alt}
              fetchPriority={i === 0 ? "high" : undefined}
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(18,41,31,0.15) 0%, rgba(18,41,31,0.12) 35%, rgba(18,41,31,0.7) 100%)" }}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-12 w-full h-full flex flex-col justify-end pb-36 sm:pb-32">
        <div key={slide} className="fade-up">
          <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#E7C77A]">Verified land · Abuja</div>
          <h1
            className="fraunces text-white font-medium text-[36px] lg:text-[64px] leading-[1.05] tracking-[-0.02em] mt-3"
            style={{ textShadow: "0 2px 28px rgba(18,41,31,0.6)" }}
          >
            Verified land in Abuja.
          </h1>
          <p
            className="public text-white/90 text-[17px] leading-[1.6] mt-4 max-w-[60ch]"
            style={{ textShadow: "0 1px 16px rgba(18,41,31,0.6)" }}
          >
            Every plot checked for title, boundaries and access before it reaches you.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="#estates"
              className="public inline-flex items-center justify-center bg-[#F6EEE3] text-[#12291F] px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-white transition-colors"
            >
              Explore estates
            </Link>
            <Link
              href="#ground"
              className="public inline-flex items-center justify-center gap-2 border border-white/80 text-white px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-white/10 transition-colors"
            >
              <Play size={16} strokeWidth={2} aria-hidden="true" />
              Watch the site walk
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute z-10 right-6 lg:right-12 bottom-40 sm:bottom-36 flex gap-2">
        {HERO_SLIDES.map((h, i) => (
          <button
            key={h.src}
            onClick={() => setSlide(i)}
            aria-label={`Slide ${i + 1}: ${h.caption}`}
            className={`h-1.5 rounded-full transition-all ${i === slide ? "w-8 bg-[#C49A3A]" : "w-1.5 bg-white/50 hover:bg-white"}`}
          />
        ))}
      </div>

      <style>{`
        .hero-slide{position:absolute; inset:0; opacity:0; transform:scale(1.06); transition:opacity 1.4s ease, transform 7s linear}
        .hero-slide.on{opacity:1; transform:scale(1)}
        .fade-up{animation:fadeUp 1s cubic-bezier(0.16,1,0.3,1) both}
        @keyframes fadeUp{from{opacity:0; transform:translateY(24px)} to{opacity:1; transform:none}}
      `}</style>
    </section>
  );
}

export function SearchBar({ onFilter }: { onFilter: (estate: string, size: string, budget: string) => void }) {
  const [qEstate, setQEstate] = useState("any");
  const [qSize, setQSize] = useState("any");
  const [qBudget, setQBudget] = useState("any");

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    onFilter(qEstate, qSize, qBudget);
    document.getElementById("estates")?.scrollIntoView({ behavior: "smooth" });
  }

  const selectCls =
    "mt-1 w-full bg-transparent public text-[15px] font-semibold text-[#1C2B20] focus:outline-none cursor-pointer";
  const labelCls = "mono text-[12px] tracking-[0.14em] uppercase text-[#5B5346]";

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-[14px] border border-[#E4D8C1] p-4 sm:p-5 grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end shadow-[0_20px_44px_rgba(18,41,31,0.22)]"
      aria-label="Search plots"
    >
      <label className="block">
        <span className={labelCls}>Estate</span>
        <select value={qEstate} onChange={(e) => setQEstate(e.target.value)} className={selectCls}>
          <option value="any">Any estate</option>
          {SITE_ESTATES.map((e) => (
            <option key={e.name} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-4 sm:contents">
        <label className="block sm:border-l sm:border-[#E4D8C1] sm:pl-5">
          <span className={labelCls}>Plot size</span>
          <select value={qSize} onChange={(e) => setQSize(e.target.value)} className={selectCls}>
            <option value="any">Any size</option>
            {PLOT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}sqm
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:border-l sm:border-[#E4D8C1] sm:pl-5">
          <span className={labelCls}>Budget</span>
          <select value={qBudget} onChange={(e) => setQBudget(e.target.value)} className={selectCls}>
            {BUDGETS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        className="public bg-[#12291F] text-white rounded-[10px] px-8 h-[52px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors whitespace-nowrap w-full sm:w-auto"
      >
        Search plots
      </button>
    </form>
  );
}
