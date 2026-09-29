import Image from "next/image";
import { Check } from "lucide-react";
import CinematicIntroLoader from "@/components/site/CinematicIntroLoader";
import Hero from "@/components/site/home/Hero";
import EstatesSection from "@/components/site/home/EstatesSection";
import FeaturedEstate from "@/components/site/home/FeaturedEstate";
import Ground from "@/components/site/home/Ground";
import MethodTabs from "@/components/site/home/MethodTabs";
import VisitForm from "@/components/site/home/VisitForm";
import Reveal from "@/components/site/home/Reveal";
import { SITE_CONTACT, SITE_STATS } from "@/lib/site";

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

      {/* 5 — WEALTH STEPS */}
      <section style={{ background: "#F6EEE3" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[64px] lg:py-[112px]">
          <Reveal>
            <Label>Wealth steps · The Belgrove method</Label>
            <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">
              Build. Hold. Grow.
            </h2>
            <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
              Three words that shape every advisory conversation. Whether you are pouring a foundation next quarter or holding for a decade, the discipline is the same.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {[
              {
                t: "Build: The plot for the home you have imagined.",
                c: "We start with your vision not our inventory. How many bedrooms? How close to work? What does “home” feel like at 7am? From that warm first conversation we curate plots where that life fits, verify each, handle transfer and registration, and stay through foundation. You don’t just buy ground; you buy a clear path to front door.",
                i: "Ideal for families ready to build within 0–24 months.",
              },
              {
                t: "Hold: An asset that waits for you.",
                c: "Not every plot must be built tomorrow. Held land, well chosen, is patient capital hedged against inflation, free of tenant headaches, quietly appreciating as roads, schools and commerce arrive. We help you select corridors with real long-term potential and we tell you honestly when to wait. Land rewards patience; we reward it with discipline.",
                i: "Ideal for investors building a 3–10 year portfolio.",
              },
              {
                t: "Grow: A legacy for your family.",
                c: "Property, well planned, is one of the surest foundations of enduring wealth because it compounds beyond you. A plot bought wisely today becomes a home for your children, a rental that funds education, or a parcel that multiplies when the neighborhood matures. Value that grows while you sleep, and a story your family will tell long after the transfer papers fade.",
                i: "Ideal for generational wealth 10+ year horizon.",
              },
            ].map((s) => (
              <Reveal key={s.t} className="bg-white border border-[#E4D8C1] rounded-[14px] p-6">
                <h3 className="fraunces text-[19px] leading-[1.3] text-[#1C2B20]">{s.t}</h3>
                <p className="public text-[15px] leading-[1.6] text-[#5B5346] mt-2">{s.c}</p>
                <p className="mono text-[12px] tracking-[0.06em] uppercase text-[#1C2B20] mt-4">→ {s.i}</p>
              </Reveal>
            ))}
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
      <section id="book" className="relative overflow-hidden scroll-mt-20">
        <Image src="/admin-login-house.jpg" alt="" aria-hidden fill sizes="100vw" loading="lazy" className="object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(18,41,31,0.82), rgba(18,41,31,0.92))" }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6 lg:px-12 py-[64px] lg:py-[112px] grid lg:grid-cols-2 gap-10 items-start">
          <Reveal>
            <Label light>Book an inspection</Label>
            <h2 className="fraunces text-white text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">
              See the land for yourself.
            </h2>
            <p className="public text-[17px] leading-[1.6] text-white/80 mt-3 max-w-[60ch]">
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
