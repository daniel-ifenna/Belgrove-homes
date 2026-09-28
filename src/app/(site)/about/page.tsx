"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function AboutPage() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add("in-view"); io.unobserve(e.target); } }); }, { threshold: 0.14 });
    els.forEach((el) => io.observe(el));
    const vg = document.querySelector(".values-grid");
    if (vg) {
      const io2 = new IntersectionObserver(([ent]) => { if (ent.isIntersecting) { vg.classList.add("in-view"); (vg.querySelectorAll(":scope > div") as NodeListOf<HTMLElement>).forEach((card,i)=>{ card.style.transitionDelay = `${i*90}ms`; }); io2.disconnect(); } }, { threshold: 0.2 });
      io2.observe(vg);
    }
    return () => { io.disconnect(); };
  }, []);
  return (
    <div className="bg-[#F7EFE2] text-[#1C2B20]">
      <style>{`.fraunces{font-family:var(--font-fraunces),Georgia,serif} .mono{font-family:var(--font-plex-mono),'IBM Plex Mono',monospace} .public{font-family:var(--font-inter),-apple-system,'Segoe UI',sans-serif} .reveal{opacity:0; transform:translateY(22px); transition:opacity .55s cubic-bezier(0.16,1,0.3,1), transform .55s cubic-bezier(0.16,1,0.3,1)} .reveal.in-view{opacity:1; transform:translateY(0)} .values-grid > div{opacity:0; transform:translateY(16px); transition:opacity .5s cubic-bezier(0.16,1,0.3,1), transform .5s cubic-bezier(0.16,1,0.3,1)} .values-grid.in-view > div{opacity:1; transform:translateY(0)} .btn-lift{transition:transform .2s ease, box-shadow .2s ease, background-color .2s ease} .btn-lift:hover{transform:translateY(-1px); box-shadow:0 8px 20px rgba(22,40,29,0.12)}`}</style>

      {/* Page header */}
      <section className="bg-[#F7EFE2] texture-cream pt-16 lg:pt-[128px] pb-8 reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C89B3C]">ABOUT US · THE BELGROVE STORY</span><div className="hairline-gold"></div>
          <h1 className="fraunces text-[36px] lg:text-[42px] leading-[0.95] tracking-[-0.02em] text-[#1C2B20] mt-3">Who we are, and why land</h1>
        </div>
      </section>

      {/* 1. Two-column intro WHO WE ARE + photo */}
      <section className="bg-[#F7EFE2] texture-cream pb-12 lg:pb-16 reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
            <div className="space-y-8 flex flex-col">
              <div>
                <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1C2B20]">WHO WE ARE</h3>
                <div className="public text-[14px] leading-[1.7] text-[#1C2B20] mt-3 space-y-4 text-justify">
                  <p>At Belgrove Homes &amp; Properties Limited, we believe a piece of land is the most honest investment there is. It does not move, decline, or wear out; it waits for you. Build the home you have imagined. Hold an asset that grows with the years. Or lay the foundation of a future your family can stand on. Whatever your dream, it begins with the right ground beneath it.</p>
                  <p>Belgrove Homes &amp; Properties Limited is a real estate company built on one conviction: real estate is far more than the acquisition of ground or buildings. It is a foundation for financial growth, for security, and for a generational legacy. We have made land the heart of that belief, and we are building that promise from Abuja outward, one verified plot at a time.</p>
                  <p>Founded in 2025 and headquartered in Abuja, Belgrove exists to do one thing well: put verified, honestly priced land in front of people who are ready to build, hold, or pass something on. We intend to earn trust the only way that lasts — by being right about the land, every single time.</p>
                </div>
              </div>

              {/* 2. WHY LAND / OUR DIFFERENCE */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1C2B20]">WHY LAND</h3>
                  <p className="public text-[14px] leading-[1.7] text-[#1C2B20] mt-2 text-justify">We chose land as our first love for a simple reason: it is where everything meaningful in property begins. A building ages; a plot endures. It gives you the freedom to build when you are ready, to hold while you plan, and to pass on something lasting. Land, well chosen, is the firmest ground on which to build wealth.</p>
                </div>
                <div>
                  <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1C2B20]">OUR DIFFERENCE</h3>
                  <p className="public text-[14px] leading-[1.7] text-[#1C2B20] mt-2 text-justify">We are premium in quality and warm in manner. No pressure, no jargon, no hidden process. Every client receives a named adviser, verified land, transparent fees, and an honest view even when honesty means advising you to wait.</p>
                </div>
              </div>

              {/* 3. WHO WE SERVE */}
              <div>
                <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1C2B20]">WHO WE SERVE</h3>
                <p className="public text-[14px] leading-[1.7] text-[#1C2B20] mt-2 text-justify">First-time heirs to land and seasoned portfolio builders alike. Families planning their first home, investors building a portfolio, and communities across Abuja watching their neighborhoods flourish.</p>
              </div>

              {/* 4. Stat capsule */}
              <div className="mt-auto pt-2">
                <div className="bg-white border border-[#E4D8C1] rounded-[8px] p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-[6px] bg-[#16281D] grid place-items-center text-[#E8C77A] text-[16px]">◆</div>
                  <div>
                    <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#C89B3C]">FOUNDED 2025 · ABUJA · FCTA APPROVED</div>
                    <div className="public text-[13px] text-[#1C2B20]">100+ properties sold · 33,000 sqm sold · 6 estates</div>
                  </div>
                </div>
              </div>
            </div>

            {/* photo with dark panel behind */}
            <div className="relative flex">
              <div className="absolute -z-0 inset-0 lg:left-6 bg-[#16281D] rounded-[8px] hidden lg:block" />
              <div className="relative rounded-[16px] overflow-hidden border border-[#E4D8C1] bg-white photo-warm shadow-[0_12px_24px_rgba(22,40,29,0.08)] w-full h-full min-h-[560px] z-10">
                <img src="/manager-dp.jpg" alt="Belgrove Story — General Manager" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "top" }} />
              </div>
            </div>
          </div>

          {/* 5. OUR VALUES */}
          <div className="mt-12 pt-10 border-t border-[#E4D8C1]">
            <h3 className="mono text-[11px] tracking-[0.18em] uppercase text-[#5B5346]">OUR VALUES</h3>
            <div className="grid md:grid-cols-5 gap-3 mt-4 values-grid">
              {[
                ["Integrity","We verify, disclose, and tell the truth even when it costs a sale. In marketing, trust is the only campaign that never ends."],
                ["Clarity","If you do not understand something, we have not finished our job. Jargon is a failure of service, not a sign of expertise."],
                ["Value","We position every opportunity for long-term worth, not short-term gain. A quick flip is not a Belgrove story."],
                ["Warmth","Premium service with a human welcome at every step. You will know your adviser’s name and direct line."],
                ["Legacy","We help you build assets that outlast you. The best brief we ever receive is from your future grandchildren."],
              ].map(([k,v])=>(
                <div key={k} className="bg-white border border-[#E4D8C1] rounded-[8px] p-4">
                  <div className="fraunces text-[15px] font-semibold text-[#1C2B20]">{k}</div>
                  <div className="public text-[12.5px] leading-[1.6] text-[#5B5346] mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Pull-quote */}
          <div className="mt-12 py-8 border-y border-[#E4D8C1] text-center max-w-[64ch] mx-auto">
            <p className="fraunces italic text-[18px] lg:text-[20px] leading-[1.5] text-[#1C2B20]">At Belgrove, we do not simply sell land or properties. We create opportunities for people to own assets, build wealth, and secure their future.</p>
          </div>
        </div>
      </section>

      {/* 10. Bottom CTA banner */}
      <section className="bg-[#F7EFE2] texture-cream py-24 lg:py-[128px] reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="rounded-[16px] p-8 lg:p-12 text-center" style={{ background: "linear-gradient(135deg, #C89B3C, #9A6F2A)" }}>
            <h2 className="fraunces text-[28px] lg:text-[34px] leading-[1.05] text-white">Find the plot that&apos;s actually yours to build on.</h2>
            <p className="public text-[14px] leading-[1.6] text-white/90 mt-3 max-w-[60ch] mx-auto">Link up with a named adviser, get a shortlist that matches your budget, and see the verification pack before you commit to anything.</p>
            <Link href="/book-inspection" className="public inline-flex mt-6 bg-white text-[#16281D] px-8 py-3.5 rounded-[6px] text-[14px] font-semibold hover:bg-[#F7EFE2] btn-lift">
              Book Inspection →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
