"use client";
import Link from "next/link";
import * as React from "react";
import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import CinematicIntroLoader from "@/components/site/CinematicIntroLoader";
import { BELGROVE_PLOTS as FALLBACK_PLOTS, BELGROVE_SIZES as FALLBACK_SIZES, BELGROVE_ESTATE_INFO as FALLBACK_ESTATE_INFO } from "@/lib/belgroveData";

function useCountUp(target: number, trigger: boolean, duration = 1400) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (!trigger) return;
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // cubic ease-out approx cubic-bezier(0.16,1,0.3,1)
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round(ease(p) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trigger, target, duration]);
  return val;
}
function AnimatedNumber({ target, prefix = "", suffix = "", duration = 1400, trigger, formatter, startFromZero = true }: { target: number; prefix?: string; suffix?: string; duration?: number; trigger: boolean; formatter?: (n:number)=>string; startFromZero?: boolean }) {
  const v = useCountUp(target, trigger, duration);
  const display = trigger ? v : (startFromZero ? 0 : target);
  const text = formatter ? formatter(display) : String(display);
  // For SEO, render final value as data attribute while showing animated value visibly
  const finalText = formatter ? formatter(target) : String(target);
  return <span data-final={`${prefix}${finalText}${suffix}`}>{prefix}{text}{suffix}</span>;
}
function AnimatedSeven({ trigger }: { trigger: boolean }) {
  const v = useCountUp(7, trigger, 1300);
  return <span>{v}/7</span>;
}

export default function HomePage() {
  const [wealthStep, setWealthStep] = useState(0);
  const [displayStep, setDisplayStep] = useState(0);
  const [fade, setFade] = useState(true);
  const [statsInView, setStatsInView] = useState(false);
  const [heroInView, setHeroInView] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const carouselSlides = [
    { src: "/aurum-400-fully-detached.jpeg", alt: "Aurum Residence — luxury modern home exterior, Katampe Extension, Abuja", captionTitle: "BELGROVE PENINSULA", captionSub: "Residential plots · Abuja" },
    { src: "/peninsula-350-fully-detached.jpeg", alt: "Aerial view of premium residential estate, Abuja corridor", captionTitle: "KABUSA–KETTI CORRIDOR", captionSub: "Strategically positioned residential land" },
    { src: "/admin-login-house.jpg", alt: "Beautiful modern Nigerian home interior, architectural detail", captionTitle: "BUILT FOR THE FUTURE", captionSub: "Infrastructure · Access · Security" },
    { src: "/starlight-150-terrace.jpeg", alt: "Landscaped residential environment, estate development", captionTitle: "INSPECT BEFORE YOU BUY", captionSub: "Private property inspection" },
  ] as const;
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Build/Hold/Grow cross-fade
  useEffect(() => {
    if (wealthStep === displayStep) return;
    setFade(false);
    const t = setTimeout(() => { setDisplayStep(wealthStep); setFade(true); }, 150);
    return () => clearTimeout(t);
  }, [wealthStep, displayStep]);

  // trust badge count-up trigger
  useEffect(() => {
    if (!statsRef.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsInView(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(statsRef.current);
    return () => io.disconnect();
  }, []);
  const trustRef = useRef<HTMLDivElement>(null);
  const [trustInView, setTrustInView] = useState(false);
  useEffect(() => {
    if (!trustRef.current) return;
    const io2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTrustInView(true); io2.disconnect(); } }, { threshold: 0.3 });
    io2.observe(trustRef.current);
    return () => io2.disconnect();
  }, []);
  useEffect(() => { const id = requestAnimationFrame(() => setHeroInView(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(m.matches);
    const handler = () => setPrefersReducedMotion(m.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, []);
  useEffect(() => {
    if (carouselPaused || prefersReducedMotion) return;
    const id = setInterval(() => setCarouselIndex((c) => (c + 1) % carouselSlides.length), 5500);
    return () => clearInterval(id);
  }, [carouselPaused, prefersReducedMotion, carouselSlides.length]);

  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add("in-view"); io.unobserve(e.target); } }); }, { threshold: 0.14 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const w = window as unknown as { BELGROVE_PLOTS?: typeof FALLBACK_PLOTS; BELGROVE_SIZES?: typeof FALLBACK_SIZES; BELGROVE_ESTATE_INFO?: typeof FALLBACK_ESTATE_INFO };
    const PLOTS = w.BELGROVE_PLOTS ?? FALLBACK_PLOTS;
    const SIZES = w.BELGROVE_SIZES ?? FALLBACK_SIZES;
    const ESTATE_INFO: Record<string, {tagline:string, features:string[], whatsapp:string, instagram:string}> = w.BELGROVE_ESTATE_INFO ?? FALLBACK_ESTATE_INFO;
    function estateKey(p: typeof PLOTS[number]){ return p.phase ? p.estate + ' — ' + p.phase : p.estate; }
    function uniqueEstateKeys(){ const seen: Record<string,boolean>={}; const out:string[]=[]; PLOTS.forEach(function(p){ const k=estateKey(p); if(!seen[k]){seen[k]=true; out.push(k);} }); return out; }
    const sEstate = document.getElementById('bgSearchEstate') as HTMLSelectElement | null;
    const sSize = document.getElementById('bgSearchSize') as HTMLSelectElement | null;
    const estateGrid = document.getElementById('estateGrid');
    const detailCard = document.getElementById('estateDetailCard') as HTMLElement | null;
    if(!sEstate || !sSize || !estateGrid) return;
    sEstate.innerHTML = '<option value="all">Any estate</option>';
    sSize.innerHTML = '<option value="">Any size</option>';
    estateGrid.innerHTML = '';
    const estateKeys = uniqueEstateKeys();
    estateKeys.forEach(function(name){ const o=document.createElement('option'); o.value=name; o.textContent=name; sEstate.appendChild(o); });
    SIZES.forEach(function(sz){ const o=document.createElement('option'); o.value=String(sz); o.textContent=sz+'sqm'; sSize.appendChild(o); });
    function formatNaira(n:number){ return '\u20A6'+n.toLocaleString('en-NG'); }
    const groups: Record<string, typeof PLOTS> = {};
    PLOTS.forEach(function(p){ const k=estateKey(p); if(!groups[k]) groups[k]=[]; (groups[k] as typeof PLOTS).push(p); });
    const ordered = estateKeys.filter(function(n){ return !!groups[n]; });
    Object.keys(groups).forEach(function(n){ if(ordered.indexOf(n)===-1) ordered.push(n); });
    function showDetailCard(key:string){
      if(!detailCard) return;
      const group = groups[key];
      if(!group){ detailCard.classList.add('hidden'); detailCard.innerHTML=''; return; }
      const baseEstate = group[0].estate;
      const phase = (group[0] as unknown as {phase?:string}).phase;
      const isPreSale = phase==='Phase 2';
      const displayName = key;
      const location = group[0].location;
      const sizes = Array.from(new Set(group.map(function(g){ return g.size; }))).sort(function(a,b){ return a-b; });
      const sizeLabel = sizes.length===1 ? sizes[0]+'sqm' : sizes.length===2 ? sizes[0]+', '+sizes[1]+'sqm' : Math.min.apply(null,sizes)+'–'+Math.max.apply(null,sizes)+'sqm';
      const prices = group.map(function(g){ return g.price; }).filter(function(v){ return typeof v==='number'; }) as number[];
      const basePriceLabel = prices.length ? formatNaira(Math.min.apply(null,prices)) + ' – ' + formatNaira(Math.max.apply(null,prices)) : 'Price on request';
      const priceLabel = basePriceLabel + (isPreSale ? ' • Pre-Sale' : '');
      const count = group.length;
      detailCard.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-4">' +
          '<div>' +
            '<div class="mono text-[11px] tracking-[0.18em] uppercase text-[#C89B3C]">' + location.toUpperCase() + (isPreSale ? ' • <span class="bg-[#C89B3C] text-[#16281D] px-2 py-0.5 rounded">PRE-SALE</span>' : '') + '</div>' +
            '<h3 class="fraunces text-[22px] text-[#16281D] mt-1">' + displayName + (isPreSale ? ' <span class="mono text-[10px] bg-[#C89B3C] text-[#16281D] px-2 py-1 rounded align-middle">PRE-SALE</span>' : '') + '</h3>' +
            '<div class="public text-[13px] text-[#5B5346] mt-1">' + count + ' unit' + (count>1?'s':'') + (phase ? ' • ' + phase : '') + ' • ' + sizeLabel + ' • ' + priceLabel + '</div>' +
          '</div>' +
          '<a href="/gallery?estate=' + encodeURIComponent(baseEstate) + (phase ? '&phase=' + encodeURIComponent(phase) : '') + '" class="mono text-[12px] bg-[#16281D] text-[#F5EFE2] px-4 py-2 rounded-[6px] hover:bg-[#1B2E23] transition-colors">View in gallery →</a>' +
        '</div>' +
        '<div class="mt-4 pt-4 border-t border-[#E4D8C1] public text-[12.5px] leading-[1.6] text-[#5B5346]"><span class="font-semibold text-[#1C2B20]">FCTA Approved:</span> Prototype you see ' + (count>1?'are':'is') + ' the FCTA-approved building prototype for ' + displayName + ' — located at ' + location + ', ' + sizeLabel + ' from ' + basePriceLabel + (isPreSale ? ' (Pre-Sale offers)' : '') + '. Verified land, what you see is what is approved to build.</div>';
      detailCard.classList.remove('hidden');
      detailCard.scrollIntoView({behavior:'smooth', block:'nearest'});
    }
    function hideDetailCard(){ if(detailCard){ detailCard.classList.add('hidden'); detailCard.innerHTML=''; } }
    function renderEstateCards(){
      if(!estateGrid) return;
      estateGrid.innerHTML = '';
      hideDetailCard();
      const activeEstate = (sEstate?.value || 'all');
      const activeSize = sSize?.value || '';
      let visibleCount = 0;
      ordered.forEach(function(key){
        const group = groups[key];
        const sizes = Array.from(new Set(group.map(function(g){ return g.size; }))).sort(function(a,b){ return a-b; });
        if(activeSize && !sizes.some(function(sz){ return String(sz)===activeSize; })) return;
        if(activeEstate!=='all' && key!==activeEstate) return;
        const count = group.length;
        const isPreSale = key.includes('Phase 2');
        const phases = new Set(group.map(function(g){ return (g as unknown as {phase?:string}).phase; }).filter(Boolean)).size;
        const location = group[0].location;
        const firstImage = (group.find(function(g){ return (g as unknown as {image?:string}).image; }) as unknown as {image?:string} | undefined)?.image;
        const hasAvailable = group.some(function(g){ return g.status==='available' || g.status==='reserved'; });
        const badge = count + ' UNIT' + (count>1?'S':'') + (isPreSale ? ' • PRE-SALE' : '') + (phases>1 ? ' · ' + phases + ' PHASES' : '');
        let sizeLabel = '';
        if(sizes.length===1) sizeLabel = sizes[0] + 'sqm';
        else if(sizes.length===2) sizeLabel = sizes[0] + ', ' + sizes[1] + 'sqm';
        else sizeLabel = Math.min.apply(null, sizes) + '–' + Math.max.apply(null, sizes) + 'sqm';
        const card = document.createElement('a');
        const baseEstate = group[0].estate;
        const phase = (group[0] as unknown as {phase?:string}).phase;
        card.href = '/gallery?estate=' + encodeURIComponent(baseEstate) + (phase ? '&phase=' + encodeURIComponent(phase) : '');
        card.className = 'estate-card';
        card.dataset.estate = key;
        const topBg = firstImage
          ? '<img src="/' + firstImage.replace(/^\//,'') + '" alt="' + key + '" loading="lazy" onerror="this.parentElement.classList.add(\'no-img\'); this.remove()">'
          : '';
        const stripedClass = firstImage ? '' : ' no-img';
        card.innerHTML =
          '<div class="estate-card-top' + stripedClass + '">' +
            topBg +
            '<span class="estate-badge">' + badge + '</span>' +
            (isPreSale ? '<span class="estate-prebadge">PRE-SALE</span>' : '') +
            '<span class="estate-plus">+</span>' +
          '</div>' +
          '<div class="estate-card-body">' +
            '<div class="estate-loc">' + location.toUpperCase() + (isPreSale ? ' • PRE-SALE' : '') + '</div>' +
            '<div class="estate-name">' + key + '</div>' +
            '<div class="estate-divider"></div>' +
            '<div class="estate-meta"><span>' + sizeLabel + '</span><span>' + (hasAvailable ? 'Available' : 'Sold Out') + '</span><span class="estate-view">View all plots →</span></div>' +
          '</div>';
        card.addEventListener('click', function(e){
          e.preventDefault();
          showDetailCard(key);
          if(sEstate) sEstate.value = key;
          document.querySelectorAll('.estate-card').forEach(function(c){ c.classList.remove('ring-2','ring-[#C89B3C]'); });
          card.classList.add('ring-2','ring-[#C89B3C]');
        });
        card.style.opacity = "0";
        card.style.transform = "translateY(16px)";
        card.style.transition = "opacity .5s cubic-bezier(0.16,1,0.3,1), transform .5s cubic-bezier(0.16,1,0.3,1)";
        card.style.transitionDelay = `${visibleCount * 90}ms`;
        estateGrid.appendChild(card);
        // trigger reveal on next frame
        requestAnimationFrame(() => requestAnimationFrame(() => {
          card.style.opacity = "1";
          card.style.transform = "translateY(0)";
        }));
        visibleCount++;
      });
      if(!visibleCount){
        const empty = document.createElement('div');
        empty.className = 'public text-[13px] text-[#5B5346] col-span-full text-center py-8 border border-dashed border-[#E4D8C1] rounded-lg bg-white';
        empty.textContent = 'No estates match that filter — try another size or estate.';
        estateGrid.appendChild(empty);
      } else if(visibleCount===1 && activeEstate!=='all'){
        showDetailCard(activeEstate);
        const single = estateGrid.querySelector('.estate-card') as HTMLElement | null;
        if(single) single.classList.add('ring-2','ring-[#C89B3C]');
      }
    }
    renderEstateCards();
    sEstate.addEventListener('change', renderEstateCards);
    sSize.addEventListener('change', renderEstateCards);
    const form = document.getElementById('bgSearchForm');
    form?.addEventListener('submit', function(e){
      e.preventDefault();
      const estateVal = sEstate.value || 'all';
      const sizeVal = sSize.value || '';
      if(estateVal!=='all' && groups[estateVal]){
        renderEstateCards();
        showDetailCard(estateVal);
        return;
      }
      const params = new URLSearchParams();
      if(estateVal && estateVal!=='all'){
        const parts = estateVal.split(' — ');
        params.set('estate', parts[0]);
        if(parts[1]) params.set('phase', parts[1]);
      }
      if(sizeVal) params.set('size', sizeVal);
      window.location.href = '/gallery' + (params.toString() ? '?' + params.toString() : '');
    });
  }, []);

  return (
    <div className="bg-[#F7EFE2] text-[#1C2B20]">
      <CinematicIntroLoader />
      <Script src="/data.js" strategy="beforeInteractive" />
      <style>{`.fraunces{font-family:var(--font-fraunces),Georgia,serif} .mono{font-family:var(--font-plex-mono),'IBM Plex Mono',monospace} .public{font-family:var(--font-inter),-apple-system,'Segoe UI',sans-serif} .reveal{opacity:0; transform:translateY(22px); transition:opacity .55s cubic-bezier(0.16,1,0.3,1), transform .55s cubic-bezier(0.16,1,0.3,1)} .reveal.in-view{opacity:1; transform:translateY(0)} .card-hover{transition:transform .2s cubic-bezier(0.16,1,0.3,1), box-shadow .2s ease} .card-hover:hover{transform:translateY(-4px); box-shadow:0 16px 32px rgba(22,40,29,0.14)} .estate-card{transition:transform .2s cubic-bezier(0.16,1,0.3,1), box-shadow .2s ease, border-color .2s ease} .estate-card:hover{transform:translateY(-4px); box-shadow:0 16px 32px rgba(22,40,29,0.14); border-color:#C89B3C} .estate-card-top img{transition:transform .5s cubic-bezier(0.16,1,0.3,1)} .estate-card:hover .estate-card-top img{transform:scale(1.03)} .btn-lift{transition:transform .2s ease, box-shadow .2s ease, background-color .2s ease, border-color .2s ease} .btn-lift:hover{transform:translateY(-1px); box-shadow:0 8px 20px rgba(22,40,29,0.12)} .hero-card{opacity:0; transform:translateY(12px); animation:heroIn 520ms cubic-bezier(0.16,1,0.3,1) forwards} @keyframes heroIn{to{opacity:1; transform:translateY(0)}} .trust-badge-in{opacity:0; transform:translateY(12px); animation:heroIn 500ms cubic-bezier(0.16,1,0.3,1) forwards} .build-fade{transition:opacity .2s cubic-bezier(0.16,1,0.3,1)} .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0} .hero-photo-fade{opacity:0; animation:photoFade 900ms cubic-bezier(0.16,1,0.3,1) forwards} @keyframes photoFade{from{opacity:0} to{opacity:1}} .ken-burns{animation:kenBurn 6s ease-out forwards} @keyframes kenBurn{from{transform:scale(1)} to{transform:scale(1.04)}} @media (prefers-reduced-motion: reduce){ .ken-burns{animation:none !important} .hero-card{animation:none !important; opacity:1 !important; transform:none !important} }`}</style>

      {/* HERO — fitted to viewport, 45/55 premium editorial */}
      <section className="relative bg-[#F7EFE2] texture-cream overflow-hidden flex items-center">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-[45%_55%] gap-8 lg:gap-10 items-center min-h-[520px] lg:min-h-[calc(100svh-96px)] py-6 lg:py-8">
            {/* LEFT — 45% */}
            <div className="py-6 lg:py-10 lg:pr-12 flex flex-col justify-center order-2 lg:order-1">
              <div className="mono text-[13px] tracking-[0.1em] uppercase text-[#C89B3C]">VERIFIED LAND • ABUJA & BEYOND</div>
              <div className="hairline-gold"></div>
              <h1 className="fraunces font-[500] text-[#1C2B20] leading-[0.92] tracking-[-0.03em] mt-5" style={{ fontSize: "clamp(40px, 5.2vw, 64px)" }}>
                Land you can<br />build your<br />name on.
              </h1>
              <p className="public text-[17px] leading-[1.65] text-[#5B5346] mt-5 max-w-[42ch]">
                Every Belgrove plot is verified for title, boundaries, and access before it reaches you. Walk the land, understand what you&apos;re buying, and buy with clarity.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link href="/gallery" className="public inline-flex items-center justify-center bg-[#16281D] text-[#F5EFE2] px-8 py-3.5 rounded-[6px] text-[14px] font-medium hover:bg-[#1B2E23] btn-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C89B3C] focus-visible:outline-offset-2">
                  Explore Available Plots →
                </Link>
                <Link href="/book-inspection" className="public inline-flex items-center justify-center bg-white border border-[#E4D8C1] text-[#1C2B20] px-8 py-3.5 rounded-[6px] text-[14px] font-medium hover:bg-[#FAF4EA] hover:border-[#C89B3C] btn-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C89B3C] focus-visible:outline-offset-2">
                  Book Inspection
                </Link>
              </div>
              <div className="mt-9 space-y-3">
                <div className="flex flex-wrap items-center gap-5 mono text-[11px] tracking-[0.08em] uppercase text-[#5B5346]">
                  <span className="inline-flex items-center gap-1.5"><span className="h-[18px] w-[18px] rounded-full border border-[#C89B3C]/40 grid place-items-center text-[10px] leading-none text-[#C89B3C]">✓</span> TITLE</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-[18px] w-[18px] rounded-full border border-[#C89B3C]/40 grid place-items-center text-[10px] leading-none text-[#C89B3C]">✓</span> BOUNDARIES</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-[18px] w-[18px] rounded-full border border-[#C89B3C]/40 grid place-items-center text-[10px] leading-none text-[#C89B3C]">✓</span> ACCESS</span>
                </div>
                <div className="mono text-[11px] tracking-[0.08em] uppercase text-[#5B5346]/80">33,000+ SQM SOLD · 100+ FAMILIES SERVED · 5 ESTATES</div>
              </div>
            </div>

            {/* RIGHT — 55% framed architectural photograph, reduced height, generous radius */}
            <div className="relative mx-6 lg:mx-0 lg:ml-8 lg:mr-0 overflow-hidden rounded-[16px] bg-[#16281D] min-h-[280px] lg:min-h-[460px] h-[36vh] lg:h-[440px] my-6 lg:my-12 order-1 lg:order-2 flex flex-col border border-white/5 shadow-[var(--shadow-md)]" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)}>
              {/* Carousel images */}
              <div className="absolute inset-0">
                {carouselSlides.map((slide, i) => (
                  <div key={slide.src} className={`absolute inset-0 transition-opacity duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${i === carouselIndex ? "opacity-100" : "opacity-0"}`} aria-hidden={i !== carouselIndex}>
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      loading={i === 0 ? "eager" : "lazy"}
                      className={`w-full h-full object-cover ${!prefersReducedMotion && i === carouselIndex ? "ken-burns" : ""}`}
                      style={{ filter: "saturate(1.02) contrast(1.02)" }}
                    />
                    {/* warm wash 6% */}
                    <div className="absolute inset-0" style={{ background: "rgba(200,155,60,0.06)", mixBlendMode: "multiply" as any }} />
                    {/* scrim only behind caption */}
                    <div className="absolute bottom-0 left-0 right-0 h-[36%] bg-gradient-to-t from-[rgba(22,40,29,0.48)] to-transparent pointer-events-none" />
                  </div>
                ))}
              </div>

              {/* Image caption */}
              <div className="absolute bottom-6 right-6 lg:bottom-8 lg:right-8 text-right pointer-events-none">
                <div className="inline-block bg-[rgba(22,40,29,0.62)] backdrop-blur-[6px] rounded-[8px] px-3.5 py-2.5 border border-white/10">
                  <div className="mono text-[10px] tracking-[0.12em] uppercase text-[#E8C77A] leading-none">{carouselSlides[carouselIndex].captionTitle}</div>
                  <div className="public text-[11px] text-white/90 mt-1 leading-none">{carouselSlides[carouselIndex].captionSub}</div>
                </div>
              </div>

              {/* Indicators */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 lg:left-6 lg:translate-x-0 flex items-center gap-2 bg-[rgba(22,40,29,0.55)] backdrop-blur-[6px] rounded-full px-3 py-1.5 border border-white/10">
                <span className="mono text-[10px] tracking-[0.08em] text-white/90 tabular-nums">{String(carouselIndex + 1).padStart(2,"0")} / {String(carouselSlides.length).padStart(2,"0")}</span>
                <div className="flex items-center gap-1.5 ml-1">
                  {carouselSlides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCarouselIndex(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={i === carouselIndex}
                      className={`h-1 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8C77A] ${i === carouselIndex ? "w-5 bg-[#E8C77A]" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                    />
                  ))}
                </div>
              </div>

              {/* Keyboard hint - hidden but focusable */}
              <button onClick={() => setCarouselIndex((c) => (c - 1 + carouselSlides.length) % carouselSlides.length)} aria-label="Previous image" className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/20 backdrop-blur text-white grid place-items-center opacity-0 focus:opacity-100 hover:opacity-100 transition-opacity focus-visible:opacity-100">‹</button>
              <button onClick={() => setCarouselIndex((c) => (c + 1) % carouselSlides.length)} aria-label="Next image" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/20 backdrop-blur text-white grid place-items-center opacity-0 focus:opacity-100 hover:opacity-100 transition-opacity focus-visible:opacity-100">›</button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats — ribbon, pulled up tight to hero */}
      <section className="bg-[#FAF4EA] texture-cream py-6 lg:py-8 border-y border-[#E4D8C1] reveal relative z-10 -mt-1" ref={statsRef as any as React.RefObject<HTMLDivElement>}>
        <div className="max-w-[880px] mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-3 divide-x divide-[#E4D8C1]">
            <div className="text-center px-2 lg:px-8 py-2">
              <div className="fraunces font-[500] text-[28px] lg:text-[40px] leading-none tracking-[-0.02em] text-[#1C2B20] tabular-nums"><AnimatedNumber target={33000} prefix="+" trigger={statsInView} formatter={(n)=> n.toLocaleString()} startFromZero={false} /></div>
              <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#5B5346] mt-2">SQM SOLD</div>
            </div>
            <div className="text-center px-2 lg:px-8 py-2">
              <div className="fraunces font-[500] text-[28px] lg:text-[40px] leading-none tracking-[-0.02em] text-[#1C2B20] tabular-nums"><AnimatedNumber target={100} prefix="+" trigger={statsInView} startFromZero={false} /></div>
              <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#5B5346] mt-2">FAMILIES SERVED</div>
            </div>
            <div className="text-center px-2 lg:px-8 py-2">
              <div className="fraunces font-[500] text-[28px] lg:text-[40px] leading-none tracking-[-0.02em] text-[#1C2B20] tabular-nums"><AnimatedNumber target={5} trigger={statsInView} startFromZero={false} /></div>
              <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#5B5346] mt-2">ESTATES</div>
            </div>
          </div>
          <span className="sr-only" aria-hidden="true">+33,000 +100 5 +38% 7/7</span>
        </div>
      </section>

      {/* 3.3 General Manager welcome — PRESERVE VERBATIM */}
      <section className="bg-white py-24 lg:py-[128px]">
        <div className="max-w-[980px] mx-auto px-6 lg:px-8">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#1C2B20] font-medium text-center">A Welcome from the General Manager</div>
          <div className="relative mt-6">
            <div className="relative h-[320px] lg:h-[380px] overflow-hidden rounded-[4px]">
              <img src="/belgrove-team.jpg" alt="Belgrove team" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(28,43,32,0.08), rgba(28,43,32,0.32))" }} />
            </div>
            <div className="relative -mt-20 lg:-mt-24 mx-auto max-w-[760px] bg-white shadow-[0_16px_40px_rgba(22,40,29,0.12)] border border-[#E4D8C1] p-6 lg:p-8 rounded-[4px]">
              <blockquote className="fraunces italic text-[16px] lg:text-[17px] leading-[1.5] text-[#1C2B20] border-l-2 border-[#C89B3C] pl-4">
                Real estate cannot be lost or stolen, nor can it be carried away. Purchased with common sense, paid for in full, and managed with reasonable care, it is about the safest investment in the world.
              </blockquote>
              <div className="mono text-[10px] tracking-[0.08em] uppercase text-[#5B5346] mt-2">FRANKLIN D. ROOSEVELT</div>
              <div className="flex gap-4 items-start mt-6">
                <img src="/manager-dp.jpg" alt="General Manager" className="h-20 w-20 rounded-full object-cover shrink-0 hidden sm:block border border-[#E4D8C1]" style={{ objectPosition: "top" }} />
                <div>
                  <h2 className="fraunces text-[24px] lg:text-[27px] leading-[1.15] font-semibold text-[#1C2B20]">Welcome to Belgrove.</h2>
                  <div className="mono text-[11px] tracking-[0.06em] uppercase text-[#5B5346] mt-1">General Manager, Belgrove Homes and Properties Limited, Headquarters, Abuja</div>
                </div>
              </div>
              <div className="public text-[14px] leading-[1.7] text-[#5B5346] mt-5 space-y-4">
                <p>
                  We believe land, chosen well, is the most honest investment there is, it doesn&apos;t move, decline, or wear out. It waits for you, whether you&apos;re building the home you&apos;ve imagined, holding an asset for the years ahead, or laying the foundation of something your family can stand on.
                </p>
                <p>
                  Every plot we present has cleared our 7-point verification standard before you ever see it, title, boundaries, access, and documentation, checked and confirmed. Every client gets a named adviser, not a call centre, transparent fees on one page, and an honest answer, even when that answer is &quot;not this one.&quot;
                </p>
                <p>
                  Founded in 2025 and based in Abuja, we intend to earn your trust the only way that lasts: by being right about the land, every single time.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-[#E4D8C1]">
                <div className="fraunces italic text-[14px] text-[#1C2B20]">The General Manager</div>
                <div className="mono text-[11px] tracking-[0.06em] uppercase text-[#5B5346] mt-1">Belgrove Homes and Properties Limited, Abuja</div>
              </div>
              <div className="flex gap-3 mt-6">
                <Link href="/gallery" className="mono text-[13px] font-medium bg-[#16281D] text-[#F5EFE2] px-5 py-2.5 rounded-[6px] hover:bg-[#1B2E23] btn-lift">Explore Verified Land</Link>
                <Link href="/book-inspection" className="mono text-[13px] font-medium bg-white border border-[#E4D8C1] text-[#1C2B20] px-5 py-2.5 rounded-[6px] hover:bg-[#FAF4EA] hover:border-[#C89B3C] btn-lift">Book inspection</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3.4 Build. Hold. Grow. — PRESERVE VERBATIM, keep filter bar */}
      <section className="bg-[#F7EFE2] texture-cream py-24 lg:py-[128px] border-y border-[#E4D8C1] reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-10 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E4D8C1] aspect-[1.05/0.95] bg-white shadow-[0_16px_32px_rgba(22,40,29,0.08)]">
                <img src="/admin-login-house.jpg" alt="Belgrove modern house" className="absolute inset-0 w-full h-full object-cover" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C89B3C]">WEALTH STEPS · THE BELGROVE METHOD</span><div className="hairline-gold"></div>
              <h2 className="fraunces text-[34px] leading-[1.05] text-[#1C2B20] mt-2">Build. Hold. Grow.</h2>
              <p className="public text-[14px] leading-[1.6] text-[#5B5346] mt-2">Three words that shape every advisory conversation. Whether you are pouring a foundation next quarter or holding for a decade, the discipline is the same.</p>
              <div className="relative flex gap-2 mt-5 flex-wrap p-1 bg-white border border-[#E4D8C1] rounded-full w-fit">
                <div className="absolute top-1 bottom-1 bg-[#16281D] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ left: wealthStep===0 ? "4px" : wealthStep===1 ? "calc(33.333% + 2px)" : "calc(66.666% + 0px)", width: "calc(33.333% - 4px)" }} />
                {["Build","Hold","Grow"].map((label,i)=>(
                  <button key={label} onClick={()=>setWealthStep(i)} className={`relative z-10 fraunces italic px-5 py-2 rounded-full text-[13px] transition-colors duration-200 ${wealthStep===i ? "text-[#E8C77A]" : "text-[#5B5346] hover:text-[#1C2B20]"}`}>{label}</button>
                ))}
              </div>
              <div className="mt-5 min-h-[150px] build-fade" style={{ opacity: fade ? 1 : 0 }}>
                {displayStep===0 && <div className="bg-white border border-[#E4D8C1] rounded-[6px] p-5"><h3 className="fraunces text-[16px] text-[#1C2B20]">Build: The plot for the home you have imagined.</h3><p className="public text-[13.5px] leading-[1.6] text-[#5B5346] mt-2">We start with your vision not our inventory. How many bedrooms? How close to work? What does “home” feel like at 7am? From that warm first conversation we curate plots where that life fits, verify each, handle transfer and registration, and stay through foundation. You don’t just buy ground; you buy a clear path to front door.</p><p className="mono text-[11px] text-[#1C2B20] mt-3">→ Ideal for families ready to build within 0–24 months.</p></div>}
                {displayStep===1 && <div className="bg-white border border-[#E4D8C1] rounded-[6px] p-5"><h3 className="fraunces text-[16px] text-[#1C2B20]">Hold: An asset that waits for you.</h3><p className="public text-[13.5px] leading-[1.6] text-[#5B5346] mt-2">Not every plot must be built tomorrow. Held land, well chosen, is patient capital hedged against inflation, free of tenant headaches, quietly appreciating as roads, schools and commerce arrive. We help you select corridors with real long-term potential (Epe’s industrial spine, Ibeju’s coastal momentum) and we tell you honestly when to wait. Land rewards patience we reward it with discipline.</p><p className="mono text-[11px] text-[#1C2B20] mt-3">→ Ideal for investors building a 3–10 year portfolio.</p></div>}
                {displayStep===2 && <div className="bg-white border border-[#E4D8C1] rounded-[6px] p-5"><h3 className="fraunces text-[16px] text-[#1C2B20]">Grow: A legacy for your family.</h3><p className="public text-[13.5px] leading-[1.6] text-[#5B5346] mt-2">Property, well planned, is one of the surest foundations of enduring wealth because it compounds beyond you. A plot bought wisely today becomes a home for your children, a rental that funds education, or a parcel that multiplies when the neighborhood matures. As head of marketing, I call this “the quiet ROI”: value that grows while you sleep, and a story your family will tell long after the transfer papers fade.</p><p className="mono text-[11px] text-[#1C2B20] mt-3">→ Ideal for generational wealth 10+ year horizon.</p></div>}
              </div>
              <p className="fraunces italic text-[14px] text-[#5B5346] mt-4">Your future starts with a quiet invitation and the right ground. Which step are you on?</p>
            </div>
          </div>
        </div>
      </section>

      <div className="search-bar-wrap reveal">
        <div className="wrap max-w-[1180px] mx-auto px-6 lg:px-8">
          <form className="search-bar" id="bgSearchForm" data-role="plot-search">
            <div className="search-field">
              <label htmlFor="bgSearchEstate">PROPERTY / ESTATE</label>
              <select id="bgSearchEstate"><option value="all">Any estate</option></select>
            </div>
            <div className="search-field">
              <label htmlFor="bgSearchSize">PLOT SIZE</label>
              <select id="bgSearchSize"><option value="">Any size</option></select>
            </div>
            <button type="submit" className="search-btn">Search plots →</button>
          </form>
        </div>
      </div>

      {/* 3.5 Browse by estate — PRESERVE VERBATIM */}
      <section className="browse-estates reveal bg-white py-24 lg:py-[128px]" id="featured-estates">
        <div className="wrap max-w-[1180px] mx-auto px-6 lg:px-8">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C89B3C]">FEATURED PROPERTIES</div><div className="hairline-gold"></div>
          <h2 className="fraunces text-[32px] lg:text-[36px] leading-[1.05] text-[#1C2B20] mt-2">Browse by estate</h2>
          <p className="public text-[14px] leading-[1.6] text-[#5B5346] mt-2 max-w-[60ch]">Each card is one property. Click through to see every unit and size available under it.</p>
          <div id="estateGrid" className="estate-grid mt-8"></div>
          <div id="estateDetailCard" className="hidden mt-6 bg-white border border-[#E4D8C1] rounded-xl p-6 shadow-[0_8px_24px_rgba(22,40,29,0.08)]"></div>
          <div className="text-center mt-8">
            <a href="/gallery" className="mono text-[13px] tracking-[0.02em] text-[#5B5346] underline decoration-[#C89B3C]/30 underline-offset-4 hover:text-[#1C2B20] transition-colors">View all featured plots →</a>
          </div>
        </div>
      </section>
      <style>{`.search-bar-wrap{position:relative; z-index:30; margin-top:-52px; margin-bottom:-32px; pointer-events:none;}
.search-bar-wrap .search-bar{pointer-events:auto;}
.search-bar{background:#FAF4EA; border-radius:12px; box-shadow:0 20px 44px rgba(22,40,29,0.18), 0 2px 10px rgba(22,40,29,0.08); border:1px solid #E4D8C1; padding:22px; display:grid; grid-template-columns:1fr 1fr auto; gap:0; align-items:stretch; position:sticky; top:16px;}
.search-field{padding:6px 22px; border-right:1px solid #E4D8C1; display:flex; flex-direction:column; gap:4px;}
.search-field:last-of-type{border-right:none;}
.search-field label{font-family:var(--font-plex-mono),'IBM Plex Mono',monospace; font-size:10.5px; color:#5B5346; letter-spacing:.06em; text-transform:uppercase;}
.search-field select{border:none; background:none; font-family:var(--font-inter),sans-serif; font-size:14.5px; color:#1C2B20; font-weight:600; padding:2px 0; cursor:pointer;}
.search-btn{background:#16281D; color:#F5EFE2; border:none; border-radius:6px; padding:0 30px; font-weight:600; font-size:14.5px; cursor:pointer; margin-left:16px; transition:background .2s; display:flex; align-items:center; gap:8px; white-space:nowrap; font-family:var(--font-inter),sans-serif;}
.search-btn:hover{background:#1B2E23;}
.estate-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:18px;}
.estate-card{background:white; border:1px solid #E4D8C1; border-radius:10px; overflow:hidden; text-decoration:none; display:flex; flex-direction:column; transition:transform .25s ease, box-shadow .25s ease, border-color .2s;}
.estate-card:hover{transform:translateY(-3px); box-shadow:0 14px 30px rgba(22,40,29,0.12); border-color:#C89B3C;}
.estate-card-top{position:relative; aspect-ratio:1.15; overflow:hidden; background:repeating-linear-gradient(-45deg, #EDE0B8 0 10px, #FFF8E7 10px 20px);}
.estate-card-top img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0;}
.estate-card-top.no-img{background:repeating-linear-gradient(-45deg, #EDE0B8 0 12px, #FFF8E7 12px 24px);}
.estate-badge{position:absolute; top:12px; left:12px; z-index:2; font-family:var(--font-plex-mono),monospace; font-size:10px; letter-spacing:.04em; background:#16281D; color:#E8C77A; padding:5px 9px; border-radius:4px; text-transform:uppercase;}
.estate-prebadge{position:absolute; top:38px; left:12px; z-index:2; font-family:var(--font-plex-mono),monospace; font-size:9px; letter-spacing:.06em; background:#C89B3C; color:#16281D; padding:3px 7px; border-radius:4px; font-weight:700;}
.estate-plus{position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); z-index:1; width:38px; height:38px; border-radius:50%; border:1.5px solid #5B5346; background:white; display:flex; align-items:center; justify-content:center; font-size:18px; color:#5B5346;}
.estate-card-top img ~ .estate-plus{display:none;}
.estate-card-body{padding:14px 14px 12px; display:flex; flex-direction:column; gap:6px; flex:1; background:white;}
.estate-loc{font-family:var(--font-plex-mono),monospace; font-size:10px; letter-spacing:.08em; color:#5B5346; text-transform:uppercase;}
.estate-name{font-family:var(--font-fraunces),Georgia,serif; font-size:17px; font-weight:600; color:#1C2B20; line-height:1.2;}
.estate-divider{height:1px; background:#E4D8C1; margin:6px 0 8px;}
.estate-meta{display:flex; align-items:center; justify-content:space-between; gap:8px; font-family:var(--font-plex-mono),monospace; font-size:11.5px; color:#5B5346;}
.estate-meta .estate-view{color:#5B5346; white-space:nowrap; text-decoration:none; border-bottom:1px solid transparent;}
.estate-card:hover .estate-view{color:#1C2B20; border-bottom-color:#E4D8C1;}
@media (max-width:1100px){ .estate-grid{grid-template-columns:repeat(2,1fr);} }
@media (max-width:900px){
  .search-bar{grid-template-columns:1fr; gap:14px; padding:20px; position:relative; top:auto;}
  .search-field{border-right:none; border-bottom:1px solid #E4D8C1; padding-bottom:14px;}
  .search-btn{margin-left:0; padding:14px; justify-content:center;}
  .search-bar-wrap{margin-top:-30px; margin-bottom:0; position:relative; top:auto;}
}
@media (max-width:600px){ .estate-grid{grid-template-columns:1fr;} }`}</style>

      {/* 3.6 Trust / verification teaser */}
      <section className="bg-[#F7EFE2] texture-cream py-24 lg:py-[128px] border-y border-[#E4D8C1] reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            {/* visual side — real estate photo with floating verification badge */}
            <div className="order-2 lg:order-1 relative" ref={trustRef as any}>
              <div className="relative rounded-[16px] overflow-hidden border border-[#E4D8C1] aspect-[4/3] shadow-[var(--shadow-md)] photo-warm">
                <img src="/peninsula-350-fully-detached.jpeg" alt="Belgrove Peninsula — estate exterior" className="absolute inset-0 w-full h-full object-cover" />
              </div>

              {/* glow behind photo */}
              <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
                <div className="h-[360px] w-[360px] rounded-full blur-3xl opacity-20" style={{ background: "radial-gradient(circle, rgba(200,155,60,0.4), transparent 70%)" }} />
              </div>
            </div>

            {/* copy side */}
            <div className="order-1 lg:order-2">
              <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C89B3C]">THE BELGROVE LAND VERIFICATION STANDARD · OUR MOAT</div><div className="hairline-gold"></div>
              <h2 className="fraunces text-[30px] lg:text-[36px] leading-[1.05] tracking-[-0.02em] text-[#1C2B20] mt-3">Accuracy is the heart of our promise.</h2>
              <p className="public text-[14px] leading-[1.65] text-[#5B5346] mt-4 max-w-[50ch]">Every plot we present is checked against a clear seven-point standard before publication. Accuracy is not a department — it is our entire brand.</p>
              <div className="mt-6 space-y-3">
                {[
                  ["Title & Ownership verified", "Chain of ownership confirmed with documented title."],
                  ["Boundaries & Size confirmed", "Pegged, photographed, and measured — what you see is what you buy."],
                  ["Complete Documentation provided", "Deed, transfer, and registration explained end-to-end."],
                ].map(([title, desc]) => (
                  <div key={title} className="flex gap-3">
                    <span className="h-5 w-5 rounded-full bg-[#C89B3C] text-white grid place-items-center text-[10px] shrink-0 mt-0.5">✓</span>
                    <div>
                      <span className="public text-[14px] font-semibold text-[#1C2B20]">{title}</span>
                      <span className="public text-[14px] text-[#5B5346]"> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/about" className="public inline-flex mt-6 bg-[#16281D] text-[#F5EFE2] px-6 py-3 rounded-[6px] text-[13px] font-semibold hover:bg-[#1B2E23] btn-lift">
                Learn more about Belgrove →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — restored */}
      <section id="faq" className="bg-[#F7EFE2] texture-cream py-16 lg:py-20 border-t border-[#E4D8C1] reveal">
        <div className="max-w-[880px] mx-auto px-6 lg:px-8">
          <div className="text-center">
            <div className="mono text-[13px] tracking-[0.12em] uppercase text-[#C89B3C]">LAND FAQs — Answered as your adviser would</div>
            <div className="hairline-gold mx-auto"></div>
            <h2 className="fraunces font-[500] text-[32px] lg:text-[40px] leading-[0.95] tracking-[-0.02em] text-[#1C2B20] mt-4">The ground for your future.</h2>
            <p className="public text-[15px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch] mx-auto">Buy the land. Build tomorrow. Welcome to the foundation of everything — with answers, not assurances.</p>
          </div>
          <div className="mt-10 space-y-0 divide-y divide-[#E4D8C1] border-y border-[#E4D8C1] bg-white rounded-[12px] overflow-hidden shadow-[var(--shadow-sm)]">
            {[
              ["Is the land you sell actually yours to sell?","This is the most important question, and we treat it that way. Before publication we verify the chain of ownership and confirm the seller's legal right to sell. Every plot we present is backed by documented title and a clear ownership position and we will walk you through that documentation page by page so you understand it before you commit. Bring your lawyer; we welcome it."],
              ["What does “verified land” mean at Belgrove?","It means the plot has passed our 7-point land verification standard: title and ownership confirmed, freedom from encumbrance and disputes checked, boundaries and size established, use/planning status and access confirmed, and complete documentation available. You can request the verification pack for any plot you are serious about — we send it before you pay a naira."],
              ["Can I trust the size and boundaries shown?","We present size based on the surveyor's measurement / certified record, and boundaries are established by pegs and photographs, rather than guessed. We take care you are buying precisely the land you believe you are buying, and we are honest about any measurement caveats because a square metre hidden is trust lost."],
              ["I want to buy land to build my own home, how does that work?","We start with your vision and budget, then find land suitable for building — the right location, size, use status, and access. We verify the land, coordinate the legal transfer and registration, and connect you with trusted partners for planning and construction. Your goal is to get from plot to foundation with clarity, not complication — and we project-manage that clarity."],
              ["Is land a good long-term investment — can I expect it to grow in value?","Land often grows in value over time as areas develop and demand rises, but this is not guaranteed, and no responsible adviser will promise future returns. We seek plots in locations with genuine long-term potential, explain the reasoning with corridor data and comparables, and set realistic expectations. Land is patient by nature, and so is our advice — that patience is our brand promise."],
              ["What is “land banking,” and do you advise on it?","Land banking is buying land to hold for long-term appreciation before building or resale. We can help identify land with future potential and sequence it within a broader portfolio — but we are transparent that returns are not guaranteed and that a plot's prospects should be weighed carefully, with exit options discussed, rather than assumed."],
              ["What documents will I receive after buying land?","You will receive the documentation appropriate to a valid sale, typically the title/deed and the completed legal transfer and registration. We make sure you understand every paper you receive — what it means, where to keep it, and how your family will use it — and, where you wish, we coordinate the transfer on your behalf, end-to-end."],
              ["What if the land has a dispute, an issue, or encroachment?","Our verification is designed to surface these before they become your problem. Where an issue exists, we either resolve it properly with the right parties and paperwork or do not present the plot. Our honest standard means we would rather lose a sale than pass a problem to you. That is not just ethics; it is marketing — a problem sold is a reputation lost."],
              ["Can you help me sell my land?","Yes. We value it honestly (even if honest is lower than you hoped), prepare clear documentation, and market it to the right buyers — those building homes and those building portfolios — with the same verification we demand as buyers. Selling land should be as transparent as buying it; your buyer will receive the same pack you did."],
              ["Do you offer payment plans or financing for land?","Yes. We offer flexible installment plans of up to 6 months, paid directly to Belgrove, no third-party financing required. The full price and payment schedule are disclosed clearly and in writing from the first conversation, with no hidden costs."],
              ["How does your company handle site inspections?","We arrange site visits every week, and for out-of-town or overseas clients we offer virtual tours, drone footage and detailed reports so you can buy with confidence even at a distance. Every visit is hosted — not just a gate opened, but a walk with your adviser who knows the plot number by heart."],
              ["How long does buying land through Belgrove take?","It varies with documentation and transfer requirements, but typically days to weeks for a straightforward plot. We set clear milestones at the start — verification, offer, transfer, registration — and keep you informed at every stage, so waiting feels like progress, not silence."],
            ].map(([q,a], idx) => (
              <details key={q as string} className="group bg-white open:bg-[#FAF4EA] transition-colors">
                <summary className="fraunces text-[15px] leading-[1.3] font-[500] text-[#1C2B20] flex justify-between items-center cursor-pointer list-none gap-4 px-5 lg:px-6 py-4 hover:bg-[#FAF4EA] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C89B3C]">
                  <span>{q as string}</span>
                  <span className="shrink-0 h-6 w-6 rounded-full border border-[#E4D8C1] grid place-items-center text-[#C89B3C] text-[14px] leading-none group-open:rotate-45 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">+</span>
                </summary>
                <div className="px-5 lg:px-6 pb-4">
                  <p className="public text-[14px] leading-[1.65] text-[#5B5346] max-w-[72ch]">{a as string}</p>
                </div>
              </details>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/book-inspection" className="mono text-[11px] tracking-[0.08em] uppercase text-[#5B5346] hover:text-[#1C2B20] underline decoration-[#E4D8C1] underline-offset-4">Still have questions? Talk to your named adviser →</Link>
          </div>
        </div>
      </section>

            {/* 3.7 Bottom CTA banner */}
      <section className="bg-[#F7EFE2] texture-cream py-24 lg:py-[128px]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="rounded-[16px] p-8 lg:p-12 text-center" style={{ background: "linear-gradient(135deg, #C89B3C, #9A6F2A)" }}>
            <h2 className="fraunces text-[28px] lg:text-[36px] leading-[1.05] text-[#FFFFFF]">Find the plot that&apos;s actually yours to build on.</h2>
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
