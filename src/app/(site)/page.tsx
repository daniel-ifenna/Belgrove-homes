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
  status: "Available" | "Pre-sale" | "Selling fast";
  images: { src: string; alt: string; render: boolean }[];
};

const ESTATES: Estate[] = [
  {
    slug: "aurum-residence",
    name: "Aurum Residence",
    area: "Katampe Extension",
    sizes: "200–400sqm",
    minSize: 200,
    maxSize: 400,
    from: 16600000,
    status: "Available",
    images: [
      { src: "/aurum-400-fully-detached.jpeg", alt: "Aurum Residence detached duplex", render: true },
      { src: "/aurum-300-semi-detached.jpeg", alt: "Aurum Residence semi-detached duplex", render: true },
      { src: "/aurum-200-terrace.jpeg", alt: "Aurum Residence terrace duplex", render: true },
    ],
  },
  {
    slug: "belgrove-peninsula",
    name: "Belgrove Peninsula",
    area: "Kabusa-Ketti North",
    sizes: "150–900sqm",
    minSize: 150,
    maxSize: 900,
    from: 5800000,
    status: "Available",
    images: [
      { src: "/peninsula-350-fully-detached.jpeg", alt: "Belgrove Peninsula detached duplex", render: true },
      { src: "/peninsula-150-terrace.jpeg", alt: "Belgrove Peninsula terrace duplex", render: true },
      { src: "/peninsula-500-fully-detached-bq.jpeg", alt: "Belgrove Peninsula duplex with BQ", render: true },
    ],
  },
  {
    slug: "sunrise-estate",
    name: "Sunrise Estate Phase 1",
    area: "Kabusa-Ketti North",
    sizes: "150–800sqm",
    minSize: 150,
    maxSize: 800,
    from: 7500000,
    status: "Available",
    images: [
      { src: "/sunrise-p1-350-fully-detached-bq.png", alt: "Sunrise Phase 1 detached duplex", render: true },
      { src: "/sunrise-p1-150-terrace.png", alt: "Sunrise Phase 1 terrace duplex", render: true },
      { src: "/sunrise-p1-500-fully-detached-bq.png", alt: "Sunrise Phase 1 duplex with BQ", render: true },
    ],
  },
  {
    slug: "sunrise-estate",
    name: "Sunrise Estate Phase 2",
    area: "Kabusa-Ketti North",
    sizes: "150–800sqm",
    minSize: 150,
    maxSize: 800,
    from: 4950000,
    status: "Pre-sale",
    images: [
      { src: "/sunrise-p2-350-fully-detached-bq.png", alt: "Sunrise Phase 2 detached duplex", render: true },
      { src: "/sunrise-p2-150-terrace.png", alt: "Sunrise Phase 2 terrace duplex", render: true },
      { src: "/sunrise-p2-500-fully-detached-bq.png", alt: "Sunrise Phase 2 duplex with BQ", render: true },
    ],
  },
  {
    slug: "starlight-estate",
    name: "Starlight Estate",
    area: "Kyami",
    sizes: "150–750sqm",
    minSize: 150,
    maxSize: 750,
    from: 15000000,
    status: "Selling fast",
    images: [
      { src: "/starlight-200-semi.jpeg", alt: "Starlight Estate semi-detached duplex", render: true },
      { src: "/starlight-150-terrace.jpeg", alt: "Starlight Estate terrace duplex", render: true },
      { src: "/starlight-350-detached.jpeg", alt: "Starlight Estate detached duplex", render: true },
    ],
  },
];

const HERO = [
  { src: "/peninsula-350-fully-detached.jpeg", alt: "Belgrove Peninsula at dusk", caption: "Belgrove Peninsula · Kabusa-Ketti North" },
  { src: "/aurum-400-fully-detached.jpeg", alt: "Aurum Residence exterior", caption: "Aurum Residence · Katampe Extension" },
  { src: "/starlight-200-semi.jpeg", alt: "Starlight Estate exterior", caption: "Starlight Estate · Kyami" },
];

const FEATURED = ESTATES[1];
const FEATURED_GALLERY = [
  "/peninsula-350-fully-detached.jpeg",
  "/peninsula-150-terrace.jpeg",
  "/peninsula-250-semi-detached.jpeg",
  "/peninsula-500-fully-detached-bq.jpeg",
  "/peninsula-900-apartments.jpeg",
];

const GROUND = [
  { src: "/belgrove-inspection-team.jpg", alt: "Belgrove advisers with clients on site", caption: "Kabusa-Ketti · 2026", render: false },
  { src: "/belgrove-team.jpg", alt: "Belgrove team on site", caption: "Site visit · 2026", render: false },
  { src: "/our-vision-bromax.jpg", alt: "Estate land overview", caption: "Kyami · 2026", render: false },
  { src: "/admin-login-house.jpg", alt: "Finished home", caption: "Artist's impression", render: true },
];

const SIZES = [150, 200, 250, 300, 350, 400, 450, 500, 750, 800, 900];

function statusStyle(s: Estate["status"]) {
  if (s === "Pre-sale") return "bg-[#C49A3A] text-[#12291F]";
  if (s === "Selling fast") return "bg-[#12291F] text-[#E8C77A]";
  return "bg-white/95 text-[#12291F]";
}

/* --------------------------------- pieces --------------------------------- */

function Label({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`mono text-[11px] tracking-[0.18em] uppercase ${light ? "text-[#E8C77A]" : "text-[#8a6d2b]"}`}>
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
  const [fEstate, setFEstate] = useState(ESTATES[1].name);
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
        className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden bg-[#12291F]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {HERO.map((h, i) => (
          <div key={h.src} className={`hero-slide ${i === slide ? "on" : ""}`} aria-hidden={i !== slide}>
            <img src={h.src} alt={h.alt} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        ))}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(18,41,31,0.42) 0%, rgba(18,41,31,0.08) 40%, rgba(18,41,31,0.72) 100%)" }} />

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-8 w-full pt-32 pb-8">
          <div key={slide} className="fade-up">
            <Label light>Verified land · Abuja</Label>
            <h1 className="fraunces text-white font-medium text-[44px] leading-[1.02] sm:text-[64px] lg:text-[88px] tracking-[-0.02em] mt-3 max-w-[12ch]">
              Verified land in Abuja.
            </h1>
            <p className="public text-white/85 text-[15px] lg:text-[17px] mt-4 max-w-[44ch]">
              Five estates. Every plot verified before you see it.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Link
                href="#estates"
                className="public inline-flex bg-[#C49A3A] text-[#12291F] px-8 py-3.5 rounded-[6px] text-[14px] font-semibold hover:bg-[#E8C77A] transition-colors"
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
            <p className="mono text-[11px] tracking-[0.08em] uppercase text-white/70 mt-4">{HERO[slide].caption}</p>
          </div>

          {/* search, overlaid at hero bottom */}
          <form
            onSubmit={onSearch}
            className="mt-8 bg-[#FAF4EA]/95 backdrop-blur rounded-[12px] border border-white/20 p-4 sm:p-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] shadow-[0_20px_44px_rgba(18,41,31,0.35)]"
          >
            <label className="block">
              <span className="mono text-[10px] tracking-[0.12em] uppercase text-[#5B5346]">Estate</span>
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
              <span className="mono text-[10px] tracking-[0.12em] uppercase text-[#5B5346]">Plot size</span>
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
              className="public bg-[#12291F] text-[#F5EFE2] rounded-[8px] px-8 py-3.5 text-[14px] font-semibold hover:bg-[#1B2E23] transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* 2 — ESTATES GRID */}
      <section id="estates" className="scroll-mt-20 max-w-[1280px] mx-auto px-6 lg:px-8 pt-16 lg:pt-24">
        <Reveal>
          <Label>Estates</Label>
          <h2 className="fraunces text-[32px] lg:text-[44px] leading-[1.05] tracking-[-0.02em] mt-2">Five estates, one standard.</h2>
          <p className="public text-[14px] text-[#5B5346] mt-2">Swipe each card for more views. Renders are artist impressions.</p>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          {visible.map((e) => (
            <Reveal key={e.name}>
              <article className="bg-white rounded-[14px] overflow-hidden border border-[#E4D8C1] shadow-[0_12px_32px_rgba(22,40,29,0.08)]">
                <div className="strip flex overflow-x-auto">
                  {e.images.map((img) => (
                    <div key={img.src} className="relative shrink-0 w-full aspect-[4/3] overflow-hidden">
                      <img src={img.src} alt={img.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      <span className={`absolute top-3 left-3 mono text-[10px] tracking-[0.08em] uppercase px-2.5 py-1 rounded-full ${statusStyle(e.status)}`}>
                        {e.status}
                      </span>
                      {img.render && (
                        <span className="absolute bottom-3 right-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full">
                          Artist&apos;s impression
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-5 lg:p-6">
                  <div className="mono text-[10px] tracking-[0.14em] uppercase text-[#5B5346]">{e.area}</div>
                  <h3 className="fraunces text-[24px] lg:text-[26px] font-medium mt-1">{e.name}</h3>
                  <div className="public text-[13px] text-[#5B5346] mt-1">
                    From {naira(e.from)} · {e.sizes}
                  </div>
                  <Link
                    href={`/estates/${e.slug}`}
                    className="mono text-[12px] tracking-[0.06em] uppercase text-[#12291F] underline decoration-[#C49A3A] decoration-2 underline-offset-4 mt-4 inline-block hover:text-[#8a6d2b]"
                  >
                    View estate →
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        {visible.length === 0 && (
          <p className="public text-[14px] text-[#5B5346] mt-8 text-center">
            No estate fits that combination.{" "}
            <button onClick={() => { setQEstate("any"); setQSize("any"); }} className="underline decoration-[#C49A3A] underline-offset-4">
              Clear search
            </button>
          </p>
        )}
      </section>

      {/* 3 — FEATURED ESTATE */}
      <section className="mt-16 lg:mt-24 bg-[#12291F] text-[#F5EFE2] overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <Reveal>
            <Label light>Featured estate</Label>
            <h2 className="fraunces text-[32px] lg:text-[52px] leading-[1.05] tracking-[-0.02em] mt-2">Belgrove Peninsula.</h2>
            <p className="public text-[14px] text-white/70 mt-2">Our widest range of plots, minutes from the city.</p>
          </Reveal>
          <div className="mt-8 grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
            <Reveal>
              <div className="relative rounded-[14px] overflow-hidden aspect-[4/3]">
                <img src={FEATURED_GALLERY[featured]} alt={`Belgrove Peninsula view ${featured + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                <span className="absolute bottom-3 right-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full">
                  Artist&apos;s impression
                </span>
              </div>
              <div className="strip flex gap-3 mt-3 overflow-x-auto pb-1">
                {FEATURED_GALLERY.map((src, i) => (
                  <button key={src} onClick={() => setFeatured(i)} aria-label={`View ${i + 1}`} className={`shrink-0 w-24 h-16 rounded-[8px] overflow-hidden border-2 transition-colors ${i === featured ? "border-[#C49A3A]" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </Reveal>
            <Reveal className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              {[
                { icon: "◈", k: "Location", v: "Kabusa-Ketti North" },
                { icon: "▦", k: "Plot sizes", v: "150–900sqm" },
                { icon: "₦", k: "From", v: naira(FEATURED.from) },
                { icon: "◐", k: "Payment plan", v: "0–3 months" },
                { icon: "✓", k: "Title", v: "FCTA approved" },
              ].map((f) => (
                <div key={f.k} className="rounded-[12px] border border-white/15 bg-white/[0.04] p-4">
                  <div className="text-[#C49A3A] text-[18px] leading-none">{f.icon}</div>
                  <div className="mono text-[10px] tracking-[0.12em] uppercase text-white/60 mt-2">{f.k}</div>
                  <div className="public text-[14px] font-semibold mt-0.5">{f.v}</div>
                </div>
              ))}
              <Link href="/estates/belgrove-peninsula" className="col-span-2 public text-center bg-[#C49A3A] text-[#12291F] rounded-[8px] px-6 py-3.5 text-[14px] font-semibold hover:bg-[#E8C77A] transition-colors">
                View Belgrove Peninsula →
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4 — VERIFIED, NOT PROMISED */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <Reveal className="relative rounded-[16px] overflow-hidden aspect-[4/3] order-1">
            <img src="/belgrove-inspection-team.jpg" alt="Belgrove advisers verifying land on site" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute bottom-3 left-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full">
              On site · Kabusa-Ketti
            </span>
          </Reveal>
          <Reveal className="order-2">
            <Label>Verified, not promised</Label>
            <h2 className="fraunces text-[32px] lg:text-[44px] leading-[1.05] tracking-[-0.02em] mt-2">Proof before promises.</h2>
            <p className="public text-[14px] text-[#5B5346] mt-2">Three checks clear every plot before it is listed.</p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: "❖", t: "Title", c: "Documented ownership" },
                { icon: "◎", t: "Boundaries", c: "Pegged and measured" },
                { icon: "▲", t: "Access", c: "Roads in place" },
              ].map((v) => (
                <div key={v.t} className="text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-[#12291F] text-[#E8C77A] grid place-items-center text-[20px]">
                    {v.icon}
                  </div>
                  <div className="fraunces text-[16px] mt-3">{v.t}</div>
                  <div className="public text-[12px] text-[#5B5346] mt-0.5">{v.c}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 5 — ON THE GROUND */}
      <section className="bg-white border-y border-[#E4D8C1] py-16 lg:py-24 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <Reveal>
            <Label>On the ground</Label>
            <h2 className="fraunces text-[32px] lg:text-[44px] leading-[1.05] tracking-[-0.02em] mt-2">Straight from the sites.</h2>
            <p className="public text-[14px] text-[#5B5346] mt-2">Site photos, drone views pending. Renders marked.</p>
          </Reveal>
        </div>
        <Reveal className="mt-8">
          <div className="strip flex gap-4 overflow-x-auto px-6 lg:px-8 pb-2">
            {GROUND.map((g) => (
              <figure key={g.src} className="shrink-0 w-[78vw] sm:w-[380px]">
                <div className="relative rounded-[12px] overflow-hidden aspect-[4/3] border border-[#E4D8C1]">
                  <img src={g.src} alt={g.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <figcaption className="mono text-[11px] tracking-[0.06em] uppercase text-[#5B5346] mt-2">
                  {g.caption}
                </figcaption>
              </figure>
            ))}
            {[1, 2].map((i) => (
              <figure key={`drone-${i}`} className="shrink-0 w-[78vw] sm:w-[380px]">
                <div className="relative rounded-[12px] overflow-hidden aspect-[4/3] border border-dashed border-[#C49A3A] bg-[#FAF4EA] grid place-items-center">
                  <div className="text-center px-6">
                    <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#8a6d2b]">Drone footage</div>
                    <div className="fraunces italic text-[15px] text-[#5B5346] mt-1">Coming soon</div>
                  </div>
                </div>
                <figcaption className="mono text-[11px] tracking-[0.06em] uppercase text-[#5B5346] mt-2">
                  Aerial view · Pending
                </figcaption>
              </figure>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 6 — PROOF */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <Reveal>
          <Label>Proof</Label>
          <h2 className="fraunces text-[32px] lg:text-[44px] leading-[1.05] tracking-[-0.02em] mt-2">Numbers, then names.</h2>
        </Reveal>
        <Reveal className="mt-8 grid grid-cols-3 divide-x divide-[#E4D8C1] bg-white border border-[#E4D8C1] rounded-[14px] py-8">
          {[
            ["33,000+", "sqm sold"],
            ["100+", "families"],
            ["5", "estates"],
          ].map(([n, l]) => (
            <div key={l} className="text-center px-2">
              <div className="fraunces text-[30px] lg:text-[48px] leading-none tabular-nums">{n}</div>
              <div className="mono text-[10px] lg:text-[11px] tracking-[0.14em] uppercase text-[#5B5346] mt-2">{l}</div>
            </div>
          ))}
        </Reveal>
        <Reveal className="mt-6">
          <figure className="grid md:grid-cols-[1fr_1.2fr] bg-[#12291F] text-[#F5EFE2] rounded-[14px] overflow-hidden">
            <div className="relative min-h-[240px]">
              <img src="/belgrove-inspection-team.jpg" alt="On inspection with clients" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="p-6 lg:p-10 flex flex-col justify-center">
              <div className="mono text-[10px] tracking-[0.14em] uppercase text-[#E8C77A]">On site with clients</div>
              <blockquote className="fraunces italic text-[19px] lg:text-[22px] leading-[1.45] mt-3">
                “Responsive, sharp, and honest about a property&apos;s flaws before I wasted time touring it.”
              </blockquote>
              <figcaption className="public text-[13px] text-white/70 mt-4">Levi Okafor · Investor</figcaption>
            </div>
          </figure>
        </Reveal>
      </section>

      {/* 7 — BOOK AN INSPECTION */}
      <section className="relative overflow-hidden">
        <img src="/admin-login-house.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(18,41,31,0.82), rgba(18,41,31,0.9))" }} />
        <div className="relative max-w-[1280px] mx-auto px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <Label light>Book an inspection</Label>
            <h2 className="fraunces text-white text-[34px] lg:text-[52px] leading-[1.05] tracking-[-0.02em] mt-2">
              See the land for yourself.
            </h2>
            <p className="public text-white/75 text-[14px] mt-3">Walk it with a named adviser, this week.</p>
            <a
              href="https://wa.me/2348103760063?text=Hello%20Belgrove%2C%20I%20want%20to%20book%20an%20inspection"
              target="_blank"
              rel="noopener noreferrer"
              className="public inline-flex items-center gap-2 mt-6 border border-[#C49A3A] text-[#E8C77A] px-6 py-3 rounded-[6px] text-[14px] font-semibold hover:bg-[#C49A3A] hover:text-[#12291F] transition-colors"
            >
              WhatsApp us
            </a>
          </Reveal>
          <Reveal>
            <form onSubmit={onBook} className="bg-[#FAF4EA] rounded-[14px] p-6 lg:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="mono text-[10px] tracking-[0.12em] uppercase text-[#5B5346]">Name</span>
                  <input
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className="mt-1 w-full bg-white border border-[#E4D8C1] rounded-[8px] px-3.5 py-3 public text-[14px] focus:outline-none focus:border-[#C49A3A]"
                  />
                </label>
                <label className="block">
                  <span className="mono text-[10px] tracking-[0.12em] uppercase text-[#5B5346]">Phone</span>
                  <input
                    value={fPhone}
                    onChange={(e) => setFPhone(e.target.value)}
                    required
                    inputMode="tel"
                    placeholder="080..."
                    className="mt-1 w-full bg-white border border-[#E4D8C1] rounded-[8px] px-3.5 py-3 public text-[14px] focus:outline-none focus:border-[#C49A3A]"
                  />
                </label>
                <label className="block">
                  <span className="mono text-[10px] tracking-[0.12em] uppercase text-[#5B5346]">Estate</span>
                  <select
                    value={fEstate}
                    onChange={(e) => setFEstate(e.target.value)}
                    className="mt-1 w-full bg-white border border-[#E4D8C1] rounded-[8px] px-3.5 py-3 public text-[14px] focus:outline-none focus:border-[#C49A3A]"
                  >
                    {ESTATES.map((e) => (
                      <option key={e.name} value={e.name}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mono text-[10px] tracking-[0.12em] uppercase text-[#5B5346]">Preferred date</span>
                  <input
                    type="date"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                    required
                    className="mt-1 w-full bg-white border border-[#E4D8C1] rounded-[8px] px-3.5 py-3 public text-[14px] focus:outline-none focus:border-[#C49A3A]"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="public w-full mt-5 bg-[#12291F] text-[#F5EFE2] rounded-[8px] py-3.5 text-[14px] font-semibold hover:bg-[#1B2E23] transition-colors"
              >
                Book inspection
              </button>
            </form>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
