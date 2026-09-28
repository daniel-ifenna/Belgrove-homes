"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { MapPin, Ruler, Banknote, CalendarDays, ShieldCheck, Map as MapIcon, Play } from "lucide-react";
import { SITE_ESTATES, FEATURED_GALLERY, FEATURED_VIDEO, SITE_CONTACT, formatNaira } from "@/lib/site";

const ICON = { size: 20, strokeWidth: 1.75 } as const;

export default function FeaturedEstate() {
  const estate = SITE_ESTATES.find((e) => e.slug === "belgrove-peninsula")!;
  const [main, setMain] = useState(0);
  const facts = [
    { icon: <MapPin {...ICON} aria-hidden="true" />, value: estate.area, sub: estate.landmark },
    { icon: <Ruler {...ICON} aria-hidden="true" />, value: estate.sizes, sub: "Plot sizes" },
    { icon: <Banknote {...ICON} aria-hidden="true" />, value: `From ${formatNaira(estate.from)}`, sub: "Starting price" },
    { icon: <CalendarDays {...ICON} aria-hidden="true" />, value: estate.paymentPlan ?? "", sub: "Payment plan" },
    ...(estate.titleType
      ? [{ icon: <ShieldCheck {...ICON} aria-hidden="true" />, value: estate.titleType, sub: "Title type" }]
      : []),
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
      <div>
        <div className="relative rounded-[14px] overflow-hidden aspect-[16/10] sm:aspect-[21/9] lg:aspect-[16/10]">
          <Image
            src={FEATURED_GALLERY[main].src}
            alt={FEATURED_GALLERY[main].alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <span className="absolute bottom-3 right-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full">
            Artist&apos;s impression
          </span>
        </div>
        <div className="strip flex gap-3 mt-3 overflow-x-auto pb-1">
          {FEATURED_GALLERY.map((g, i) => (
            <button
              key={g.src}
              onClick={() => setMain(i)}
              aria-label={`View ${i + 1}: ${g.alt}`}
              aria-pressed={i === main}
              className={`shrink-0 w-28 h-[72px] rounded-[10px] overflow-hidden border-2 transition-all relative ${i === main ? "border-[#C49A3A]" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <Image src={g.src} alt="" fill sizes="112px" loading="lazy" className="object-cover" />
            </button>
          ))}
          <div
            className="shrink-0 w-28 h-[72px] rounded-[10px] overflow-hidden border border-[#E4D8C1] bg-[#F6EEE3] flex flex-col items-center justify-center gap-1 text-[#5B5346]"
            role="img"
            aria-label="Layout plan placeholder"
          >
            <MapIcon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="mono text-[9px] tracking-[0.1em] uppercase">Layout plan</span>
          </div>
          <Link
            href="#ground"
            className="shrink-0 w-28 h-[72px] rounded-[10px] overflow-hidden border border-[#E4D8C1] bg-[#12291F] flex flex-col items-center justify-center gap-1 text-white hover:bg-[#1B2E23] transition-colors"
            aria-label={`${FEATURED_VIDEO.label}: jump to site footage`}
          >
            <Play size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="mono text-[9px] tracking-[0.1em] uppercase">{FEATURED_VIDEO.label}</span>
          </Link>
        </div>
      </div>

      <div>
        <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#C49A3A]">Featured estate</div>
        <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">Belgrove Peninsula</h2>
        <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
          Terrace duplex plots in Kabusa-Ketti North, ready for your build.
        </p>
        <ul className="mt-6 grid grid-cols-2 lg:grid-cols-1 gap-3">
          {facts.map((f, i) => (
            <li
              key={f.value}
              className={`flex items-center gap-3 rounded-[10px] border border-[#E4D8C1] bg-[#FAF4EA] px-4 py-3 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}
            >
              <span className="text-[#8a6d2b] shrink-0">{f.icon}</span>
              <span>
                <span className="public block text-[14px] font-semibold leading-tight">{f.value}</span>
                <span className="mono block text-[11px] tracking-[0.1em] uppercase text-[#5B5346] mt-0.5">{f.sub}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/estates/belgrove-peninsula"
            className="public inline-flex items-center justify-center bg-[#12291F] text-white px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors"
          >
            View plots
          </Link>
          <a
            href={`${SITE_CONTACT.whatsapp}?text=Hello%20Belgrove%2C%20I%20want%20to%20enquire%20about%20Belgrove%20Peninsula`}
            target="_blank"
            rel="noopener noreferrer"
            className="public inline-flex items-center justify-center border border-[#12291F] text-[#12291F] px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#12291F] hover:text-white transition-colors"
          >
            Enquire on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
