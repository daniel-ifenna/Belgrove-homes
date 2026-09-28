"use client";
import Link from "next/link";
import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const CREAM = "#F6EEE3";
const GREEN = "#12291F";
const GOLD = "#C49A3A";

function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

/* ---------------------------------- data ---------------------------------- */

type Estate = {
  slug: string;
  name: string;
  area: string;
  sizes: string;
  minSize: number;
  maxSize: number;
  from: number;
  status: "Available" | "Pre-sale";
  images: { src: string; alt: string }[];
};

const ESTATES: Estate[] = [
  {
    slug: "aurum-residence",
    name: "Aurum Residence",
    area: "Katampe Extension",
    sizes: "200–400 sqm",
    minSize: 200,
    maxSize: 400,
    from: 16600000,
    status: "Available",
    images: [
      { src: "/aurum-400-fully-detached.jpeg", alt: "Aurum Residence detached duplex" },
      { src: "/aurum-300-semi-detached.jpeg", alt: "Aurum Residence semi-detached duplex" },
      { src: "/aurum-200-terrace.jpeg", alt: "Aurum Residence terrace duplex" },
    ],
  },
  {
    slug: "belgrove-peninsula",
    name: "Belgrove Peninsula",
    area: "Kabusa-Ketti North",
    sizes: "150–900 sqm",
    minSize: 150,
    maxSize: 900,
    from: 5800000,
    status: "Available",
    images: [
      { src: "/peninsula-350-fully-detached.jpeg", alt: "Belgrove Peninsula detached duplex" },
      { src: "/peninsula-150-terrace.jpeg", alt: "Belgrove Peninsula terrace duplex" },
      { src: "/peninsula-250-semi-detached.jpeg", alt: "Belgrove Peninsula semi-detached duplex" },
    ],
  },
  {
    slug: "sunrise-estate",
    name: "Sunrise Estate, Phase 1",
    area: "Kabusa-Ketti North",
    sizes: "150–800 sqm",
    minSize: 150,
    maxSize: 800,
    from: 7500000,
    status: "Available",
    images: [
      { src: "/sunrise-p1-350-fully-detached-bq.png", alt: "Sunrise Phase 1 detached duplex" },
      { src: "/sunrise-p1-150-terrace.png", alt: "Sunrise Phase 1 terrace duplex" },
      { src: "/sunrise-p1-500-fully-detached-bq.png", alt: "Sunrise Phase 1 duplex with BQ" },
    ],
  },
  {
    slug: "sunrise-estate",
    name: "Sunrise Estate, Phase 2",
    area: "Kabusa-Ketti North",
    sizes: "150–800 sqm",
    minSize: 150,
    maxSize: 800,
    from: 4950000,
    status: "Pre-sale",
    images: [
      { src: "/sunrise-p2-350-fully-detached-bq.png", alt: "Sunrise Phase 2 detached duplex" },
      { src: "/sunrise-p2-150-terrace.png", alt: "Sunrise Phase 2 terrace duplex" },
      { src: "/sunrise-p2-500-fully-detached-bq.png", alt: "Sunrise Phase 2 duplex with BQ" },
    ],
  },
  {
    slug: "starlight-estate",
    name: "Starlight Estate",
    area: "Kyami",
    sizes: "150–750 sqm",
    minSize: 150,
    maxSize: 750,
    from: 15000000,
    status: "Available",
    images: [
      { src: "/starlight-200-semi.jpeg", alt: "Starlight Estate semi-detached duplex" },
      { src: "/starlight-150-terrace.jpeg", alt: "Starlight Estate terrace duplex" },
      { src: "/starlight-450-detached.jpeg", alt: "Starlight Estate detached duplex" },
    ],
  },
];

const HERO = [
  { src: "/peninsula-900-apartments.jpeg", alt: "Belgrove Peninsula apartments", caption: "Belgrove Peninsula · Kabusa-Ketti North" },
  { src: "/sunrise-p1-800-apartments.png", alt: "Sunrise Estate apartment block", caption: "Sunrise Estate · Kabusa-Ketti North" },
  { src: "/starlight-750-flats.jpeg", alt: "Starlight Estate flats", caption: "Starlight Estate · Kyami" },
];

const FEATURED_GALLERY = [
  "/peninsula-350-fully-detached.jpeg",
  "/peninsula-150-terrace.jpeg",
  "/peninsula-250-semi-detached.jpeg",
  "/peninsula-500-fully-detached-bq.jpeg",
];

const SIZES = [150, 200, 250, 300, 350, 400, 450, 500, 750, 800, 900];

/* --------------------------------- pieces --------------------------------- */

function Label({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`mono text-[12px] tracking-[0.12em] uppercase ${light ? "text-[#E8C77A]" : "text-[#C49A3A]"}`}>
      {children}
    </div>
  );
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in-view");
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

/* ----------------------------------- page ---------------------------------- */

export default function HomePage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [qEstate, setQEstate] = useState("any");
  const [qSize, setQSize] = useState("any");
  const [featured, setFeatured] = useState(0);
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fEstate, setFEstate] = useState("Belgrove Peninsula");
  const [fDate, setFDate] = useState("");

  useEffect(() => {
    if (paused) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (m.matches) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % HERO.length), 6000);
    return () => clearInterval(id);
  }, [paused]);

  const visible = ESTATES.filter(
    (e) =>
      (qEstate === "any" || e.name === qEstate) &&
      (qSize === "any" || (Number(qSize) >= e.minSize && Number(qSize) <= e.maxSize))
  );

  function onSearch(ev: React.FormEvent) {
    ev.preventDefault();
    document.getElementById("estates")?.scrollIntoView({ behavior: "smooth" });
  }

  function onBook(ev: React.FormEvent) {
    ev.preventDefault();
    const p = new URLSearchParams();
    if (fEstate) p.set("estate", fEstate);
    if (fName.trim()) p.set("name", fName.trim());
    if (fPhone.trim()) p.set("phone", fPhone.trim());
    if (fDate) p.set("date", fDate);
    router.push(`/book-inspection?${p.toString()}`);
  }

  return (
    <div style={{ background: CREAM }} className="text-[#1C2B20]">
      <style>{`
        .fraunces{font-family:var(--font-fraunces),Georgia,serif}
        .mono{font-family:var(--font-plex-mono),'IBM Plex Mono',monospace}
        .public{font-family:var(--font-inter),-apple-system,'Segoe UI',sans-serif}
        .reveal{opacity:0; transform:translateY(26px); transition:opacity .7s cubic-bezier(0.16,1,0.3,1), transform .7s cubic-bezier(0.16,1,0.3,1)}
        .reveal.in-view{opacity:1; transform:translateY(0)}
        .hero-slide{position:absolute; inset:0; opacity:0; transform:scale(1.06); transition:opacity 1.4s ease, transform 7s linear}
        .hero-slide.on{opacity:1; transform:scale(1)}
        .strip{scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none}
        .strip::-webkit-scrollbar{display:none}
        .strip > *{scroll-snap-align:start}
        .fade-up{animation:fadeUp 1s cubic-bezier(0.16,1,0.3,1) both}
        @keyframes fadeUp{from{opacity:0; transform:translateY(24px)} to{opacity:1; transform:none}}
      `}</style>

      {/* 1 — HERO */}
      <section
        className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden"
        style={{ background: GREEN }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {HERO.map((h, i) => (
          <div key={h.src} className={`hero-slide ${i === slide ? "on" : ""}`} aria-hidden={i !== slide}>
            <img src={h.src} alt={h.alt} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        ))}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(18,41,31,0) 0%, rgba(18,41,31,0) 60%, rgba(18,41,31,0.7) 100%)` }}
        />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-12 w-full pt-32 pb-40 sm:pb-36">
          <div key={slide} className="fade-up">
            <Label light>Verified land · Abuja</Label>
            <h1 className="fraunces text-white font-medium text-[36px] lg:text-[64px] leading-[1.05] tracking-[-0.02em] mt-3">
              Verified land in Abuja.
            </h1>
            <p className="public text-white/85 text-[17px] leading-[1.6] mt-4 max-w-[60ch]">
              Every plot checked for title, boundaries and access before it reaches you.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Link
                href="#estates"
                className="public inline-flex items-center justify-center bg-[#12291F] text-white px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors"
              >
                Explore estates
              </Link>
              <div className="hidden sm:flex gap-2">
                {HERO.map((h, i) => (
                  <button
                    key={h.src}
                    onClick={() => setSlide(i)}
                    aria-label={`Slide ${i + 1}: ${h.caption}`}
                    className={`h-1.5 rounded-full transition-all ${i === slide ? "w-8 bg-[#C49A3A]" : "w-1.5 bg-white/50 hover:bg-white"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* search bar on the hero bottom edge */}
        <div className="absolute inset-x-0 bottom-0 translate-y-1/2 z-20">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
            <form
              onSubmit={onSearch}
              className="bg-white rounded-[12px] border border-[#E4D8C1] p-4 sm:p-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] shadow-[0_20px_44px_rgba(18,41,31,0.25)]"
            >
              <label className="block">
                <span className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346]">Estate</span>
                <select
                  value={qEstate}
                  onChange={(e) => setQEstate(e.target.value)}
                  className="mt-1 w-full bg-transparent public text-[15px] font-semibold text-[#1C2B20] focus:outline-none cursor-pointer"
                >
                  <option value="any">Any estate</option>
                  {ESTATES.map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:border-l sm:border-[#E4D8C1] sm:pl-5">
                <span className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346]">Plot size</span>
                <select
                  value={qSize}
                  onChange={(e) => setQSize(e.target.value)}
                  className="mt-1 w-full bg-transparent public text-[15px] font-semibold text-[#1C2B20] focus:outline-none cursor-pointer"
                >
                  <option value="any">Any size</option>
                  {SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}sqm
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="public bg-[#12291F] text-white rounded-[10px] px-8 h-[52px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors whitespace-nowrap"
              >
                Search plots
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 2 — ESTATES */}
      <section id="estates" className="scroll-mt-20" style={{ background: CREAM }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 pt-[130px] lg:pt-[150px] pb-[72px] lg:pb-[120px]">
          <Reveal>
            <Label>Our estates</Label>
            <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">Find your ground.</h2>
            <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
              Five estates across Abuja. Choose a location, then a plot.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
            {visible.map((e) => (
              <Reveal key={e.name} className="h-full">
                <Link
                  href={`/estates/${e.slug}`}
                  className="block h-full bg-white rounded-[12px] overflow-hidden border border-[#E4D8C1] shadow-[0_12px_32px_rgba(22,40,29,0.08)] hover:shadow-[0_18px_44px_rgba(22,40,29,0.14)] hover:-translate-y-0.5 transition-all"
                >
                  <div className="relative">
                    <div className="strip flex overflow-x-auto">
                      {e.images.map((img) => (
                        <div key={img.src} className="relative shrink-0 w-full aspect-[4/3] overflow-hidden">
                          <img src={img.src} alt={img.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <span className={`absolute top-3 left-3 mono text-[12px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-full pointer-events-none ${e.status === "Pre-sale" ? "bg-[#C49A3A] text-[#12291F]" : "bg-white/95 text-[#12291F]"}`}>
                      {e.status}
                    </span>
                    <span className="absolute bottom-3 right-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full pointer-events-none">
                      Artist&apos;s impression
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="fraunces text-[22px] font-medium">{e.name}</h3>
                    <div className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346] mt-1">{e.area}</div>
                    <div className="flex items-center justify-between gap-3 mt-3">
                      <span className="mono text-[12px] tracking-[0.04em] uppercase text-[#12291F] font-semibold whitespace-nowrap">
                        From {naira(e.from)}
                      </span>
                      <span className="mono text-[12px] tracking-[0.04em] uppercase text-[#5B5346] whitespace-nowrap">{e.sizes}</span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          {visible.length === 0 && (
            <p className="public text-[17px] text-[#5B5346] mt-8 text-center">
              No estate fits that combination.{" "}
              <button onClick={() => { setQEstate("any"); setQSize("any"); }} className="underline decoration-[#C49A3A] underline-offset-4">
                Clear search
              </button>
            </p>
          )}
          <Reveal className="mt-8">
            <Link href="/gallery" className="mono text-[12px] tracking-[0.12em] uppercase text-[#12291F] underline decoration-[#C49A3A] decoration-2 underline-offset-4 hover:text-[#8a6d2b]">
              View all estates →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* 3 — FEATURED ESTATE */}
      <section className="bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[72px] lg:py-[120px]">
          <Reveal>
            <Label>Featured estate</Label>
            <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">Belgrove Peninsula</h2>
            <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
              Terrace duplex plots in Kabusa-Ketti North, ready for your build.
            </p>
          </Reveal>
          <Reveal className="mt-8">
            <div className="relative rounded-[12px] overflow-hidden aspect-[16/10] sm:aspect-[21/9]">
              <img
                src={FEATURED_GALLERY[featured]}
                alt={`Belgrove Peninsula view ${featured + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-[40%]"
                style={{ background: "linear-gradient(180deg, rgba(18,41,31,0), rgba(18,41,31,0.7))" }}
              />
              <span className="absolute bottom-3 right-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full">
                Artist&apos;s impression
              </span>
            </div>
            <div className="strip flex gap-3 mt-3 overflow-x-auto pb-1">
              {FEATURED_GALLERY.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setFeatured(i)}
                  aria-label={`View ${i + 1}`}
                  className={`shrink-0 w-28 h-[72px] rounded-[12px] overflow-hidden border-2 transition-all ${i === featured ? "border-[#C49A3A]" : "border-transparent opacity-70 hover:opacity-100"}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </Reveal>
          <Reveal className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: "◈", v: "Kabusa-Ketti North" },
              { icon: "▦", v: "150–900 sqm" },
              { icon: "₦", v: `From ${naira(5800000)}` },
              { icon: "◐", v: "Pay over 0–3 months" },
              { icon: "✓", v: "FCTA-approved title" },
            ].map((f) => (
              <div key={f.v} className="rounded-[12px] border border-[#E4D8C1] bg-[#FAF4EA] p-4 text-center">
                <div className="text-[#C49A3A] text-[20px] leading-none">{f.icon}</div>
                <div className="public text-[13px] font-semibold mt-2">{f.v}</div>
              </div>
            ))}
          </Reveal>
          <Reveal className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/estates/belgrove-peninsula"
              className="public inline-flex items-center justify-center bg-[#12291F] text-white px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors"
            >
              View plots
            </Link>
            <a
              href="https://wa.me/2348103760063?text=Hello%20Belgrove%2C%20I%20want%20to%20enquire%20about%20Belgrove%20Peninsula"
              target="_blank"
              rel="noopener noreferrer"
              className="public inline-flex items-center justify-center border border-[#12291F] text-[#12291F] px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#12291F] hover:text-white transition-colors"
            >
              Enquire on WhatsApp
            </a>
          </Reveal>
        </div>
      </section>

      {/* 4 — VERIFICATION */}
      <section style={{ background: CREAM }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[72px] lg:py-[120px]">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <Reveal className="relative rounded-[12px] overflow-hidden aspect-[4/3]">
              <img src="/belgrove-inspection-team.jpg" alt="Belgrove advisers verifying land on site" className="absolute inset-0 w-full h-full object-cover" />
              <div
                className="absolute inset-x-0 bottom-0 h-[40%]"
                style={{ background: "linear-gradient(180deg, rgba(18,41,31,0), rgba(18,41,31,0.7))" }}
              />
              <span className="absolute bottom-3 left-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full">
                On site · Kabusa-Ketti
              </span>
            </Reveal>
            <Reveal>
              <Label>Verified, not promised</Label>
              <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">Checked before you see it.</h2>
              <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
                Our 7-point standard runs on every plot, before publication.
              </p>
              <div className="mt-8 space-y-5">
                {[
                  { icon: "❖", t: "Title", c: "Ownership confirmed" },
                  { icon: "◎", t: "Boundaries", c: "Pegged and measured" },
                  { icon: "▲", t: "Access", c: "Roads you can drive" },
                ].map((v) => (
                  <div key={v.t} className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[#12291F] text-[#E8C77A] grid place-items-center text-[18px] shrink-0">
                      {v.icon}
                    </div>
                    <div>
                      <div className="fraunces text-[19px]">{v.t}</div>
                      <div className="public text-[13px] text-[#5B5346]">{v.c}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/about" className="mono text-[12px] tracking-[0.12em] uppercase text-[#12291F] underline decoration-[#C49A3A] decoration-2 underline-offset-4 mt-8 inline-block hover:text-[#8a6d2b]">
                How we verify →
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 5 — ON THE GROUND */}
      <section className="bg-white overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 pt-[72px] lg:pt-[120px]">
          <Reveal>
            <Label>On the ground</Label>
            <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">Real sites. Real progress.</h2>
            <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
              Shot on location. Drone views landing soon.
            </p>
          </Reveal>
        </div>
        <Reveal className="mt-8 pb-[72px] lg:pb-[120px]">
          <div className="strip flex gap-4 overflow-x-auto px-6 lg:px-12 pb-2 max-w-[1200px] mx-auto">
            {[
              { src: "/WhatsApp Image 2026-09-10 at 9.45.55 PM.jpeg", alt: "Access road at Belgrove Peninsula", caption: "Belgrove Peninsula · Access road · September 2026" },
              { src: "/our-vision-bromax.jpg", alt: "Perimeter fencing at Sunrise Estate", caption: "Sunrise Estate · Perimeter fencing · September 2026" },
            ].map((g) => (
              <figure key={g.src} className="shrink-0 w-[78vw] sm:w-[380px]">
                <div className="relative rounded-[12px] overflow-hidden aspect-[3/2]">
                  <img src={g.src} alt={g.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <figcaption className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346] mt-2">{g.caption}</figcaption>
              </figure>
            ))}
            <figure className="shrink-0 w-[78vw] sm:w-[380px]">
              <div className="relative rounded-[12px] overflow-hidden aspect-[3/2] border border-dashed border-[#C49A3A] bg-[#FAF4EA] grid place-items-center">
                <div className="text-center px-6">
                  <div className="mono text-[12px] tracking-[0.12em] uppercase text-[#8a6d2b]">Drone view</div>
                  <div className="fraunces italic text-[15px] text-[#5B5346] mt-1">Coming soon</div>
                </div>
              </div>
              <figcaption className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346] mt-2">
                Aurum Residence · Drone view · Coming soon
              </figcaption>
            </figure>
          </div>
        </Reveal>
      </section>

      {/* 6 — PROOF */}
      <section style={{ background: GREEN }} className="text-[#F5EFE2]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[72px] lg:py-[120px]">
          <Reveal>
            <Label light>Proof</Label>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                ["33,000+", "sqm sold"],
                ["100+", "families served"],
                ["5", "estates"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="fraunces text-[30px] lg:text-[52px] leading-none tabular-nums">{n}</div>
                  <div className="mono text-[12px] tracking-[0.12em] uppercase text-white/60 mt-2">{l}</div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal className="mt-10">
            <figure className="grid md:grid-cols-[1fr_1.2fr] bg-white text-[#1C2B20] rounded-[12px] overflow-hidden">
              <div className="relative min-h-[240px]">
                <img src="/belgrove-team.jpg" alt="Belgrove team with clients on site" className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="p-6 lg:p-10 flex flex-col justify-center">
                <blockquote className="fraunces italic text-[19px] lg:text-[22px] leading-[1.45]">
                  “Responsive, sharp, and honest about a property&apos;s flaws before I wasted time touring it.”
                </blockquote>
                <figcaption className="public text-[14px] text-[#5B5346] mt-4">(Levi Okafor, Investor)</figcaption>
              </div>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* 7 — BOOK AN INSPECTION */}
      <section className="relative overflow-hidden">
        <img src="/admin-login-house.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(18,41,31,0.55), rgba(18,41,31,0.7))" }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6 lg:px-12 py-[72px] lg:py-[120px] grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <Label light>Book an inspection</Label>
            <h2 className="fraunces text-white text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">
              See the land for yourself.
            </h2>
            <p className="public text-white/80 text-[17px] leading-[1.6] mt-3 max-w-[60ch]">
              Pick a date. We&apos;ll walk the plot with you.
            </p>
          </Reveal>
          <Reveal>
            <form onSubmit={onBook} className="bg-white rounded-[12px] p-6 lg:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346]">Full name</span>
                  <input
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className="mt-1 w-full bg-[#F6EEE3] border border-[#E4D8C1] rounded-[10px] px-3.5 h-[52px] public text-[15px] focus:outline-none focus:border-[#C49A3A]"
                  />
                </label>
                <label className="block">
                  <span className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346]">Phone</span>
                  <input
                    value={fPhone}
                    onChange={(e) => setFPhone(e.target.value)}
                    required
                    inputMode="tel"
                    placeholder="080..."
                    className="mt-1 w-full bg-[#F6EEE3] border border-[#E4D8C1] rounded-[10px] px-3.5 h-[52px] public text-[15px] focus:outline-none focus:border-[#C49A3A]"
                  />
                </label>
                <label className="block">
                  <span className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346]">Estate</span>
                  <select
                    value={fEstate}
                    onChange={(e) => setFEstate(e.target.value)}
                    className="mt-1 w-full bg-[#F6EEE3] border border-[#E4D8C1] rounded-[10px] px-3.5 h-[52px] public text-[15px] focus:outline-none focus:border-[#C49A3A]"
                  >
                    {ESTATES.map((e) => (
                      <option key={e.name} value={e.name}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346]">Preferred date</span>
                  <input
                    type="date"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                    required
                    className="mt-1 w-full bg-[#F6EEE3] border border-[#E4D8C1] rounded-[10px] px-3.5 h-[52px] public text-[15px] focus:outline-none focus:border-[#C49A3A]"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="public w-full mt-5 bg-[#12291F] text-white rounded-[10px] h-[52px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors"
              >
                Book inspection
              </button>
              <div className="text-center mt-4">
                <a
                  href="https://wa.me/2348103760063?text=Hello%20Belgrove%2C%20I%20want%20to%20book%20an%20inspection"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-[12px] tracking-[0.12em] uppercase text-[#5B5346] underline decoration-[#C49A3A] decoration-2 underline-offset-4 hover:text-[#12291F]"
                >
                  Chat on WhatsApp
                </a>
              </div>
            </form>
          </Reveal>
        </div>
      </section>

      {/* 8 — TOP QUESTIONS */}
      <section style={{ background: CREAM }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-[72px] lg:py-[120px]">
          <Reveal>
            <Label>Top questions</Label>
            <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">Asked on every visit.</h2>
            <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
              Short answers. Longer ones live on the FAQ page.
            </p>
          </Reveal>
          <Reveal className="mt-8 max-w-[800px]">
            <div className="divide-y divide-[#E4D8C1] border-y border-[#E4D8C1]">
              {[
                ["Is the land yours to sell?", "Yes. Title and ownership are verified before any plot is listed."],
                ["Can I pay in installments?", "Yes. Plans run from outright payment up to 3 months."],
                ["Can I inspect before paying?", "Always. Book a free inspection and walk the plot with an adviser."],
                ["What documents do I get?", "Title/deed, transfer and registration documents, plus receipts for every payment."],
              ].map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="fraunces text-[19px] lg:text-[21px] flex justify-between items-center cursor-pointer list-none gap-4 hover:text-[#8a6d2b] transition-colors">
                    <span>{q}</span>
                    <span className="shrink-0 h-9 w-9 rounded-full border border-[#C49A3A] grid place-items-center text-[#8a6d2b] text-[16px] leading-none group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">{a}</p>
                </details>
              ))}
            </div>
            <Link href="/faq" className="mono text-[12px] tracking-[0.12em] uppercase text-[#12291F] underline decoration-[#C49A3A] decoration-2 underline-offset-4 mt-8 inline-block hover:text-[#8a6d2b]">
              All questions →
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
