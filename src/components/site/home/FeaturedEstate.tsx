"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Ruler, Banknote, CalendarDays, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { SITE_ESTATES, SITE_CONTACT, formatNaira } from "@/lib/site";

const ICON = { size: 20, strokeWidth: 1.75 } as const;
const ROTATE_MS = 6000;
const FADE_MS = 350;

export default function FeaturedEstate() {
  const [estateIdx, setEstateIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const swapTimer = useRef(0);
  const estate = SITE_ESTATES[estateIdx];
  const images = estate.images;

  // True in-and-out fade: fade the current estate out, swap content mid-fade,
  // then fade the next estate in.
  const show = useCallback((i: number) => {
    window.clearTimeout(swapTimer.current);
    setVisible(false);
    swapTimer.current = window.setTimeout(() => {
      setEstateIdx((i + SITE_ESTATES.length) % SITE_ESTATES.length);
      setImgIdx(0);
      setVisible(true);
    }, FADE_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(swapTimer.current), []);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => show(estateIdx + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, estateIdx, show]);

  const phase = estate.name.match(/Phase \d/)?.[0];
  const plotsHref = `/estates/${estate.slug}${phase ? `?phase=${encodeURIComponent(phase)}` : ""}`;
  const facts = [
    { icon: <MapPin {...ICON} aria-hidden="true" />, value: estate.area, sub: estate.landmark },
    { icon: <Ruler {...ICON} aria-hidden="true" />, value: estate.sizes, sub: "Plot sizes" },
    { icon: <Banknote {...ICON} aria-hidden="true" />, value: `From ${formatNaira(estate.from)}`, sub: "Starting price" },
    ...(estate.paymentPlan
      ? [{ icon: <CalendarDays {...ICON} aria-hidden="true" />, value: estate.paymentPlan, sub: "Payment plan" }]
      : []),
    ...(estate.titleType
      ? [{ icon: <ShieldCheck {...ICON} aria-hidden="true" />, value: estate.titleType, sub: "Title type" }]
      : []),
  ];

  const fadeCls = `transition-all duration-300 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`;

  return (
    <div
      className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={fadeCls}>
        <div className="relative rounded-[14px] overflow-hidden aspect-[16/10] sm:aspect-[21/9] lg:aspect-[16/10]">
          {images.map((g, i) => (
            <Image
              key={g.src}
              src={g.src}
              alt={g.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              loading={i === 0 ? undefined : "lazy"}
              className={`object-cover transition-opacity duration-700 ${i === imgIdx ? "opacity-100" : "opacity-0"}`}
              aria-hidden={i !== imgIdx}
            />
          ))}
          <span className={`absolute top-3 left-3 mono text-[10px] tracking-[0.06em] uppercase px-2.5 py-1 rounded-full ${estate.status === "Pre-sale" ? "bg-[#C49A3A] text-[#12291F]" : estate.status === "Sold out" ? "bg-[#12291F]/90 text-[#E7C77A]" : "bg-black/55 text-white"}`}>
            {estate.status}
          </span>
        </div>
        <div className="strip flex gap-3 mt-3 overflow-x-auto pb-1">
          {images.map((g, i) => (
            <button
              key={g.src}
              onClick={() => setImgIdx(i)}
              aria-label={`View ${i + 1}: ${g.alt}`}
              aria-pressed={i === imgIdx}
              className={`shrink-0 w-28 h-[72px] rounded-[10px] overflow-hidden border-2 transition-all relative ${i === imgIdx ? "border-[#C49A3A]" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <Image src={g.src} alt="" fill sizes="112px" loading="lazy" className="object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className={fadeCls}>
        <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#C49A3A]">Featured estates</div>
        <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">{estate.name}</h2>
        <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
          Verified {estate.status === "Pre-sale" ? "pre-sale" : estate.status === "Sold out" ? "sold-out" : "available"} plots in {estate.area}, {estate.landmark}.
        </p>
        <ul className="mt-6 grid grid-cols-2 lg:grid-cols-1 gap-3">
          {facts.map((f, i) => (
            <li
              key={f.value}
              className={`flex items-center gap-3 rounded-[10px] border border-[#E4D8C1] bg-[#FAF4EA] px-4 py-3 min-w-0 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}
            >
              <span className="text-[#8a6d2b] shrink-0">{f.icon}</span>
              <span className="min-w-0">
                <span className="public block text-[14px] font-semibold leading-tight break-words">{f.value}</span>
                <span className="mono block text-[11px] tracking-[0.1em] uppercase text-[#5B5346] mt-0.5">{f.sub}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href={plotsHref}
            className="public inline-flex items-center justify-center bg-[#12291F] text-white px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors"
          >
            View plots
          </Link>
          <a
            href={`${SITE_CONTACT.whatsapp}?text=${encodeURIComponent(`Hello Belgrove, I want to enquire about ${estate.name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="public inline-flex items-center justify-center border border-[#12291F] text-[#12291F] px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#12291F] hover:text-white transition-colors"
          >
            Enquire on WhatsApp
          </a>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-3">
          <button
            onClick={() => show(estateIdx - 1)}
            aria-label="Previous estate"
            className="h-10 w-10 sm:h-11 sm:w-11 grid place-items-center rounded-[10px] border border-[#E4D8C1] text-[#12291F] hover:bg-[#FAF4EA] transition-colors shrink-0"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            onClick={() => show(estateIdx + 1)}
            aria-label="Next estate"
            className="h-10 w-10 sm:h-11 sm:w-11 grid place-items-center rounded-[10px] border border-[#E4D8C1] text-[#12291F] hover:bg-[#FAF4EA] transition-colors shrink-0"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <div className="flex gap-1.5 sm:gap-2 ml-1 min-w-0" role="tablist" aria-label="Choose estate">
            {SITE_ESTATES.map((e, i) => (
              <button
                key={e.name}
                role="tab"
                aria-selected={i === estateIdx}
                aria-label={`Show ${e.name}`}
                onClick={() => show(i)}
                className="h-6 min-w-[20px] flex items-center justify-center shrink-0"
              >
                <span className={`h-1.5 rounded-full transition-all ${i === estateIdx ? "w-7 sm:w-8 bg-[#C49A3A]" : "w-1.5 bg-[#12291F]/20 hover:bg-[#12291F]/40"}`} />
              </button>
            ))}
          </div>
          <span className="mono text-[12px] text-[#5B5346] ml-auto tabular-nums shrink-0">
            {estateIdx + 1} / {SITE_ESTATES.length}
          </span>
        </div>
      </div>
    </div>
  );
}
