"use client";

import Link from "next/link";
import { useState } from "react";
import { SITE_CONTACT, SITE_ESTATES, estateMatchesBudget, formatNaira } from "@/lib/site";

export type EstateFilter = { estate: string; size: string; budget: string };

function matches(name: string, f: EstateFilter): boolean {
  const e = SITE_ESTATES.find((x) => x.name === name)!;
  if (f.estate !== "any" && e.name !== f.estate) return false;
  if (f.size !== "any" && (Number(f.size) < e.minSize || Number(f.size) > e.maxSize)) return false;
  if (!estateMatchesBudget(e.from, f.budget)) return false;
  return true;
}

function Card({ name }: { name: string }) {
  const e = SITE_ESTATES.find((x) => x.name === name)!;
  return (
    <Link
      href={`/estates/${e.slug}`}
      className="block h-full bg-white rounded-[14px] overflow-hidden border border-[#E4D8C1] shadow-[0_12px_32px_rgba(22,40,29,0.08)] hover:shadow-[0_18px_44px_rgba(22,40,29,0.14)] hover:-translate-y-0.5 transition-all"
      aria-label={`${e.name}, ${e.area}, from ${formatNaira(e.from)}`}
    >
      <div className="relative">
        <div className="strip flex overflow-x-auto">
          {e.images.map((img) => (
            <div key={img.src} className="relative shrink-0 w-full aspect-[4/3] overflow-hidden">
              <img src={img.src} alt={img.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          ))}
        </div>
        <span
          className={`absolute top-3 left-3 mono text-[12px] tracking-[0.14em] uppercase px-2.5 py-1 rounded-full pointer-events-none ${
            e.status === "Pre-sale" ? "bg-[#C49A3A] text-[#12291F]" : "bg-white/95 text-[#12291F]"
          }`}
        >
          {e.status}
        </span>
        <span className="absolute bottom-3 right-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full pointer-events-none">
          Artist&apos;s impression
        </span>
      </div>
      <div className="p-5">
        <h3 className="fraunces text-[22px] font-medium leading-tight">{e.name}</h3>
        <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#5B5346] mt-1">
          {e.area} · {e.landmark}
        </div>
        <div className="h-px bg-[#E4D8C1] my-3" />
        <div className="flex items-center justify-between gap-3">
          <span className="mono text-[12px] tracking-[0.04em] text-[#12291F] font-semibold whitespace-nowrap">
            From {formatNaira(e.from)}
          </span>
          <span className="mono text-[12px] tracking-[0.04em] text-[#5B5346] whitespace-nowrap">{e.sizes}</span>
        </div>
      </div>
    </Link>
  );
}

function AdvisorTile() {
  return (
    <div className="h-full rounded-[14px] p-6 lg:p-8 flex flex-col justify-center text-white" style={{ background: "#12291F" }}>
      <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#D9B25C]">Not sure where to start?</div>
      <p className="public text-[17px] leading-[1.6] mt-3 max-w-[60ch]">Tell us your budget. We&apos;ll shortlist the plots.</p>
      <a
        href={`${SITE_CONTACT.whatsapp}?text=Hello%20Belgrove%2C%20help%20me%20shortlist%20plots%20for%20my%20budget`}
        target="_blank"
        rel="noopener noreferrer"
        className="public inline-flex items-center justify-center bg-[#C49A3A] text-[#12291F] px-6 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#E8C77A] transition-colors mt-6"
      >
        Chat with an adviser
      </a>
    </div>
  );
}

export default function EstatesGrid({ filter, onClear }: { filter: EstateFilter; onClear: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const names = SITE_ESTATES.map((e) => e.name).filter((n) => matches(n, filter));
  const isFiltered = filter.estate !== "any" || filter.size !== "any" || filter.budget !== "any";
  const shown = expanded || isFiltered ? names : names.slice(0, 3);

  return (
    <div>
      {/* desktop: 3 columns, advisor tile always sixth */}
      <div className="hidden md:grid grid-cols-3 gap-6 items-stretch">
        {names.map((n) => (
          <Card key={n} name={n} />
        ))}
        <div className="h-full min-h-[280px]">
          <AdvisorTile />
        </div>
      </div>
      {/* mobile: first 3, then expand */}
      <div className="grid grid-cols-1 gap-5 items-stretch md:hidden">
        {shown.map((n) => (
          <Card key={n} name={n} />
        ))}
      </div>
      {names.length === 0 && (
        <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-8 text-center">
          No estate fits that combination.{" "}
          <button onClick={onClear} className="underline decoration-[#C49A3A] underline-offset-4">
            Clear search
          </button>
        </p>
      )}
      {!expanded && !isFiltered && names.length > 3 && (
        <div className="mt-8 text-center md:hidden">
          <button
            onClick={() => setExpanded(true)}
            className="public inline-flex items-center justify-center border border-[#12291F] text-[#12291F] px-8 h-[52px] rounded-[10px] text-[15px] font-semibold w-full"
            aria-expanded={expanded}
          >
            View all 5 estates
          </button>
        </div>
      )}
      {(expanded || isFiltered) && (
        <div className="mt-8 md:hidden">
          <AdvisorTile />
        </div>
      )}
    </div>
  );
}
