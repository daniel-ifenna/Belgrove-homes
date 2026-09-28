import Link from "next/link";
import { Check, FileCheck, Ruler, Route } from "lucide-react";
import CinematicIntroLoader from "@/components/site/CinematicIntroLoader";
import Hero from "@/components/site/home/Hero";
import EstatesSection from "@/components/site/home/EstatesSection";
import FeaturedEstate from "@/components/site/home/FeaturedEstate";
import Ground from "@/components/site/home/Ground";
import MethodTabs from "@/components/site/home/MethodTabs";
import VisitForm from "@/components/site/home/VisitForm";
import Reveal from "@/components/site/home/Reveal";
import { SITE_CONTACT, SITE_STATS, VERIFICATION_PHOTO } from "@/lib/site";

const ICON = { size: 20, strokeWidth: 1.75 } as const;

function Label({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`mono text-[12px] tracking-[0.14em] uppercase ${light ? "text-[#D9B25C]" : "text-[#7A5C17]"}`}>
      {children}
    </div>
  );
}

export default function HomePage() {
  return (
    <div style={{ background: "#F6EEE3" }} className="text-[#1C2B20]">
      <style>{`
        .fraunces{font-family:var(--font-fraunces),Georgia,serif}
        .mono{font-family:var(--font-plex-mono),'IBM Plex Mono',monospace}
        .public{font-family:var(--font-inter),-apple-system,'Segoe UI',sans-serif}
        .reveal{opacity:0; transform:translateY(26px); transition:opacity .7s cubic-bezier(0.16,1,0.3,1), transform .7s cubic-bezier(0.16,1,0.3,1)}
        .reveal.in-view{opacity:1; transform:translateY(0)}
        .strip{scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none}
        .strip::-webkit-scrollbar{display:none}
        .strip > *{scroll-snap-align:start}
      `}</style>
      <CinematicIntroLoader />

      <Hero />
      <EstatesSection />

      {/* 4 — FEATURED ESTATE */}
      <section className="bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[64px] lg:py-[112px]">
          <Reveal>
            <FeaturedEstate />
          </Reveal>
        </div>
      </section>

      {/* 5 — VERIFICATION */}
      <section style={{ background: "#F6EEE3" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[64px] lg:py-[112px]">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <Reveal className="relative rounded-[14px] overflow-hidden aspect-[4/3]">
              <img src={VERIFICATION_PHOTO.src} alt={VERIFICATION_PHOTO.alt} className="absolute inset-0 w-full h-full object-cover" />
              <div
                className="absolute inset-x-0 bottom-0 h-[40%]"
                style={{ background: "linear-gradient(180deg, rgba(18,41,31,0), rgba(18,41,31,0.7))" }}
              />
              <span className="absolute bottom-3 left-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full">
                {VERIFICATION_PHOTO.caption}
              </span>
            </Reveal>
            <Reveal>
              <Label>Verified, not promised</Label>
              <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">
                Checked before you see it.
              </h2>
              <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
                Our 7-point standard runs on every plot, before publication.
              </p>
              <ul className="mt-8 space-y-5">
                {[
                  { icon: <FileCheck {...ICON} aria-hidden="true" />, t: "Title", c: "Ownership confirmed" },
                  { icon: <Ruler {...ICON} aria-hidden="true" />, t: "Boundaries", c: "Pegged and measured" },
                  { icon: <Route {...ICON} aria-hidden="true" />, t: "Access", c: "Roads you can drive" },
                ].map((v) => (
                  <li key={v.t} className="flex items-center gap-4">
                    <span className="h-12 w-12 rounded-[10px] grid place-items-center shrink-0 text-white" style={{ background: "#12291F" }} aria-hidden="true">
                      {v.icon}
                    </span>
                    <span>
                      <span className="fraunces block text-[19px] leading-tight">{v.t}</span>
                      <span className="public block text-[13px] text-[#5B5346]">{v.c}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/about"
                className="mono text-[12px] tracking-[0.14em] uppercase text-[#12291F] underline decoration-[#C49A3A] decoration-2 underline-offset-4 mt-8 inline-block hover:text-[#8a6d2b]"
              >
                How we verify →
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 6 — ON THE GROUND */}
      <section id="ground" className="bg-white scroll-mt-20">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[64px] lg:py-[112px]">
          <Reveal>
            <Label>On the ground</Label>
            <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">
              Real sites. Real progress.
            </h2>
            <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
              Filmed and photographed on site. No renders here.
            </p>
          </Reveal>
          <Reveal className="mt-8">
            <Ground />
          </Reveal>
        </div>
      </section>

      {/* 7 — TRUSTED BY FAMILIES */}
      <section style={{ background: "#12291F" }} className="text-[#F5EFE2]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[64px] lg:py-[112px]">
          <Reveal>
            <Label light>Trusted by families</Label>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {SITE_STATS.map((s) => (
                <div key={s.label}>
                  <div className="fraunces text-[26px] sm:text-[30px] lg:text-[52px] leading-none tabular-nums whitespace-nowrap">
                    {s.display}
                  </div>
                  <div className="mono text-[12px] tracking-[0.14em] uppercase text-white/60 mt-2">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal>
            <div className="my-8 h-px bg-white/15" aria-hidden="true" />
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
              {["Verified", "No hidden fees", "Named adviser", "Stop renting, start owning"].map((p, i, arr) => (
                <li
                  key={p}
                  className="flex items-center justify-center gap-2 mono text-[12px] tracking-[0.14em] uppercase text-white/85 text-center"
                >
                  <Check size={16} strokeWidth={2.5} className="text-[#C49A3A] shrink-0" aria-hidden="true" />
                  <span className={i === arr.length - 1 ? "lg:inline" : ""}>
                    <span className="lg:hidden">{i === arr.length - 1 ? "Stop renting" : p}</span>
                    <span className="hidden lg:inline">{p}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="my-8 h-px bg-white/15" aria-hidden="true" />
          </Reveal>
          <Reveal>
            <MethodTabs />
          </Reveal>
        </div>
      </section>

      {/* 8 — BOOK AN INSPECTION */}
      <section id="book" className="scroll-mt-20" style={{ background: "#F6EEE3" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[64px] lg:py-[112px] grid lg:grid-cols-2 gap-10 items-start">
          <Reveal>
            <Label>Book an inspection</Label>
            <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">
              See the land for yourself.
            </h2>
            <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
              Pick a date. We&apos;ll walk the plot with you.
            </p>
            <div className="mt-8 bg-white rounded-[14px] border border-[#E4D8C1] p-6">
              <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#7A5C17]">Visit our office</div>
              <p className="public text-[15px] leading-[1.6] mt-3">{SITE_CONTACT.address}</p>
              <p className="public text-[15px] mt-2">
                {SITE_CONTACT.phones.map((p, i) => (
                  <span key={p}>
                    {i > 0 && " · "}
                    <a href={`tel:${p.replace(/\s/g, "")}`} className="underline decoration-[#C49A3A] underline-offset-4 hover:text-[#8a6d2b]">
                      {p}
                    </a>
                  </span>
                ))}
              </p>
              <div className="mt-4 rounded-[10px] overflow-hidden border border-[#E4D8C1]">
                <iframe
                  title="Belgrove Homes office map"
                  src={SITE_CONTACT.mapEmbed}
                  className="w-full h-[220px] border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </Reveal>
          <Reveal>
            <VisitForm />
            {SITE_CONTACT.adviserConfirmHours && (
              <p className="public text-[13px] text-[#5B5346] mt-3 text-center">
                An adviser confirms your visit by phone within {SITE_CONTACT.adviserConfirmHours} hours.
              </p>
            )}
          </Reveal>
        </div>
      </section>
    </div>
  );
}
