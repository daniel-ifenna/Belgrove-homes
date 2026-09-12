"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import Script from "next/script";
import CinematicIntroLoader from "@/components/site/CinematicIntroLoader";
import FloatingWhatsApp from "@/components/site/FloatingWhatsApp";
import { BELGROVE_PLOTS as FALLBACK_PLOTS, BELGROVE_SIZES as FALLBACK_SIZES, BELGROVE_ESTATE_INFO as FALLBACK_ESTATE_INFO } from "@/lib/belgroveData";

function TypewriterWelcome() {
  const full = "Welcome to Belgrove";
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => { i++; setText(full.slice(0, i)); if (i >= full.length) { clearInterval(t); setDone(true); } }, 72);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center text-center px-6">
      <div className="mono text-[11px] tracking-[0.24em] uppercase text-[#C79A46] mb-5 opacity-0" style={{ animation: "fadeIn 0.7s ease 0.2s forwards" }}>Belgrove Homes & Properties Limited Est. 2025</div>
      <h1 className="fraunces font-[500] text-[#F7F2E7] leading-none" style={{ fontSize: "clamp(2.8rem, 7vw, 4.8rem)", letterSpacing: "-0.02em", textShadow: "0 4px 28px rgba(0,0,0,0.45)" }}>
        <span className="inline-flex items-center">{text}<span className={`inline-block w-[3px] h-[1.05em] bg-[#E4C892] ml-1.5 ${done ? "opacity-0" : "animate-pulse"}`} style={{ transition: "opacity 0.4s" }} /></span>
      </h1>
      <div className="fraunces italic text-[#E4C892] mt-4 opacity-0" style={{ fontSize: "clamp(1.05rem, 2.5vw, 1.4rem)", animation: `fadeIn 0.9s ease ${done ? "0.4s" : "2.2s"} forwards` }}>Land. Value. Legacy.</div>
      <div className="mono text-[10px] tracking-[0.16em] uppercase text-[#B9C7BB] mt-3 opacity-0" style={{ animation: `fadeIn 0.9s ease ${done ? "0.7s" : "2.5s"} forwards` }}>The ground for your future Where trust is titled</div>
      <style>{`@keyframes fadeIn{to{opacity:1}}`}</style>
    </div>
  );
}

export default function HomePage() {
  const [wealthStep, setWealthStep] = useState(0);
  const [openVerify, setOpenVerify] = useState(0);
  const [activePlotFilter, setActivePlotFilter] = useState("All");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [headerSlide, setHeaderSlide] = useState(0);
  useEffect(() => { const t = setInterval(() => setHeaderSlide((s) => (s + 1) % 2), 6500); return () => clearInterval(t); }, []);
  const blogPosts = [
    { slug: "verify-before-you-pay", category: "Report", date: "June 29, 2026", title: "African bedrock: How the continent's minerals can help power the world", image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop", excerpt: "Critical minerals underpin everything from AI to low-carbon energy, and African mining sits at the epicenter. Three key moves can help unlock the continent's natural minerals advantage." },
    { slug: "epe-corridor", category: "Report", date: "March 31, 2026", title: "From potential to performance: A snapshot of African banking", image: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=800&auto=format&fit=crop", excerpt: "As tailwinds fade and competition intensifies, African banks can convert today's momentum into durable growth for the industry." },
    { slug: "hold-vs-build", category: "Article", date: "February 25, 2026", title: "State of grocery retail MENA 2026: Managing the growth paradox", image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=800&auto=format&fit=crop", excerpt: "Consumer confidence in the Middle East and North Africa is rising, but retail momentum is not. Ten trends can help grocers navigate." },
    { slug: "from-rent-to-title", category: "Report", date: "February 23, 2026", title: "ECCBC bets big on operational and performance excellence to expand into new markets and become a reference for the industry", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop", excerpt: "A Coca-Cola bottler unlocks growth by focusing on performance excellence and its people and culture." },
  ];
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add("in-view"); io.unobserve(e.target); } }); }, { threshold: 0.14 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // Single source of truth: window.BELGROVE_* from public/data.js (flat static site)
    // Fallback to imported data for Next.js build/prerender
    const w = window as unknown as { BELGROVE_PLOTS?: typeof FALLBACK_PLOTS; BELGROVE_SIZES?: typeof FALLBACK_SIZES; BELGROVE_ESTATE_INFO?: typeof FALLBACK_ESTATE_INFO };
    const PLOTS = w.BELGROVE_PLOTS ?? FALLBACK_PLOTS;
    const SIZES = w.BELGROVE_SIZES ?? FALLBACK_SIZES;
    const ESTATE_INFO: Record<string, {tagline:string, features:string[], whatsapp:string, instagram:string}> = w.BELGROVE_ESTATE_INFO ?? FALLBACK_ESTATE_INFO;
    // helper to get split estate key (estate + phase)
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

    // ---- Browse by estate — split Sunrise into 1 and 2 ----
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
            '<div class="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">' + location.toUpperCase() + (isPreSale ? ' • <span class="bg-[#C79A46] text-[#16281F] px-2 py-0.5 rounded">PRE-SALE</span>' : '') + '</div>' +
            '<h3 class="fraunces text-[22px] text-[#16281F] mt-1">' + displayName + (isPreSale ? ' <span class="mono text-[10px] bg-[#C79A46] text-[#16281F] px-2 py-1 rounded align-middle">PRE-SALE</span>' : '') + '</h3>' +
            '<div class="public text-[13px] text-[#6B6656] mt-1">' + count + ' unit' + (count>1?'s':'') + (phase ? ' • ' + phase : '') + ' • ' + sizeLabel + ' • ' + priceLabel + '</div>' +
          '</div>' +
          '<a href="/gallery?estate=' + encodeURIComponent(baseEstate) + (phase ? '&phase=' + encodeURIComponent(phase) : '') + '" class="mono text-[12px] bg-[#16281F] text-[#D4B368] px-4 py-2 rounded-full hover:bg-[#1E3A2E] transition-colors">View in gallery →</a>' +
        '</div>' +
        '<div class="mt-4 pt-4 border-t border-[#E4DCC7] public text-[12.5px] leading-[1.6] text-[#6B6656]"><span class="font-semibold text-[#16281F]">FCTA Approved:</span> Prototype you see ' + (count>1?'are':'is') + ' the FCTA-approved building prototype for ' + displayName + ' — located at ' + location + ', ' + sizeLabel + ' from ' + basePriceLabel + (isPreSale ? ' (Pre-Sale offers)' : '') + '. Verified land, what you see is what is approved to build.</div>';
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
        // for split keys phases will be 0-1, but keep logic
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
          // show title card below
          showDetailCard(key);
          // also update dropdown to reflect
          if(sEstate) sEstate.value = key;
          // highlight card
          document.querySelectorAll('.estate-card').forEach(function(c){ c.classList.remove('ring-2','ring-[#C79A46]'); });
          card.classList.add('ring-2','ring-[#C79A46]');
        });
        estateGrid.appendChild(card);
        visibleCount++;
      });
      if(!visibleCount){
        const empty = document.createElement('div');
        empty.className = 'public text-[13px] text-[#8B6B4E] col-span-full text-center py-8 border border-dashed border-[#E4DCC7] rounded-lg bg-white';
        empty.textContent = 'No estates match that filter — try another size or estate.';
        estateGrid.appendChild(empty);
      } else if(visibleCount===1 && activeEstate!=='all'){
        // auto-show detail when single filtered estate
        showDetailCard(activeEstate);
        const single = estateGrid.querySelector('.estate-card') as HTMLElement | null;
        if(single) single.classList.add('ring-2','ring-[#C79A46]');
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
      // if a specific estate is selected, show its detail card instead of navigating immediately
      if(estateVal!=='all' && groups[estateVal]){
        renderEstateCards();
        showDetailCard(estateVal);
        // still allow navigation via detail card button; also scroll to detail
        return;
      }
      const params = new URLSearchParams();
      if(estateVal && estateVal!=='all'){
        // split key may contain " — Phase X", need to pass estate and phase separately for gallery
        const parts = estateVal.split(' — ');
        params.set('estate', parts[0]);
        if(parts[1]) params.set('phase', parts[1]);
      }
      if(sizeVal) params.set('size', sizeVal);
      window.location.href = '/gallery' + (params.toString() ? '?' + params.toString() : '');
    });
  }, []);

  return (
    <div className="bg-[#F7F2E7] text-[#211D17]">
      <Script src="/data.js" strategy="beforeInteractive" />
      <FloatingWhatsApp />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/cinematic-intro.css" />
      <CinematicIntroLoader />
      <div id="cinematic" style={{ background: "#0F1A12" }}>
        <div className="cin-stage" style={{ background: "radial-gradient(ellipse 900px 560px at 50% 40%, rgba(199,154,70,0.14), transparent 62%), linear-gradient(180deg, #152219 0%, #0F1A12 100%)" }}>
          <TypewriterWelcome />
          <div className="cin-progress" style={{ background: "rgba(247,242,231,0.12)" }}><div className="cin-progress-bar" style={{ background: "linear-gradient(90deg, #C79A46, #E4C892)" }} /></div>
          <div className="cin-skip" style={{ color: "rgba(228,200,146,0.6)" }}>Click anywhere to enter</div>
        </div>
      </div>
      <style>{`.fraunces{font-family:Fraunces,serif} .mono{font-family:IBM Plex Mono,monospace} .public{font-family:Public Sans,sans-serif} .reveal{opacity:0; transform:translateY(14px); transition:opacity .6s ease, transform .6s ease} .reveal.in-view{opacity:1; transform:translateY(0)} .card-hover{transition:transform .25s ease, box-shadow .25s ease} .card-hover:hover{transform:translateY(-3px); box-shadow:0 12px 28px rgba(31,51,40,0.12)}`}</style>

      {/* HERO F + screen-fit slider */}
      <section className="relative h-screen w-full overflow-hidden bg-black">
        <div className={`absolute inset-0 transition-opacity duration-700 ${headerSlide === 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover"><source src="/belgrove-legacy-night-aerial.mp4" type="video/mp4" /></video>
          <div className="absolute inset-0 bg-black/32" />
          <div className="absolute left-4 lg:left-12 bottom-[18%] max-w-[640px] pr-4">
            <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46] bg-white/92 backdrop-blur px-2.5 py-1 rounded-[2px] inline-block">Building Dreams, Delivering Excellence</div>
            <h1 className="fraunces font-[500] text-white leading-[1.02] mt-3" style={{ fontSize: "clamp(30px, 4.4vw, 44px)", textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}>Consider this your invitation to the ground beneath your future.</h1>
            <p className="public text-white/90 text-[13px] leading-[1.5] mt-3 max-w-[48ch]">Verified land. Premium service. And guidance that keeps your tomorrow in mind from the very first hello.</p>
            <p className="mono text-[10px] tracking-[0.12em] uppercase text-white/70 mt-2">Building Africa’s Future, One Exceptional Space at a Time</p>
            <a href="/gallery" className="public inline-block mt-4 bg-[#C79A46] text-[#1F3328] px-6 py-2.5 rounded-[4px] text-[13px] font-semibold hover:bg-[#E4C892] transition-colors">Browse the gallery →</a>
          </div>
        </div>
        <div className={`absolute inset-0 transition-opacity duration-700 ${headerSlide === 1 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover"><source src="/belgrove-hero-golden-aerial.mp4" type="video/mp4" /></video>
          <div className="absolute inset-0 bg-black/18" />
        </div>
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
          {[0,1].map(i=>(
            <button key={i} onClick={()=>setHeaderSlide(i)} className={`h-1.5 rounded-full transition-all ${headerSlide===i ? "w-6 bg-[#C79A46]" : "w-1.5 bg-white/45"}`} />
          ))}
        </div>
      </section>

      {/* Welcome single card, General Manager */}
      <section className="bg-white py-12 lg:py-16">
        <div className="max-w-[980px] mx-auto px-6 lg:px-8">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#1A1A1A] font-medium text-center">A Welcome from the General Manager</div>
          <div className="relative mt-6">
            <div className="relative h-[320px] lg:h-[380px] overflow-hidden rounded-[4px]">
              <img src="/belgrove-team.jpg" alt="Belgrove team" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(26,26,26,0.08), rgba(26,26,26,0.42))" }} />
            </div>
            <div className="relative -mt-20 lg:-mt-24 mx-auto max-w-[760px] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-black/5 p-6 lg:p-8">
              <blockquote className="fraunces italic text-[16px] lg:text-[17px] leading-[1.5] text-[#1A1A1A] border-l-2 border-[#1A1A1A] pl-4">
                Real estate cannot be lost or stolen, nor can it be carried away. Purchased with common sense, paid for in full, and managed with reasonable care, it is about the safest investment in the world.
              </blockquote>
              <div className="mono text-[10px] tracking-[0.08em] uppercase text-[#666] mt-2">Franklin D. Roosevelt</div>
              <div className="flex gap-4 items-start mt-6">
                <img src="/manager-dp.jpg" alt="General Manager" className="h-20 w-20 rounded-full object-cover shrink-0 hidden sm:block border border-black/10" style={{ objectPosition: "top" }} />
                <div>
                  <h2 className="fraunces text-[24px] lg:text-[27px] leading-[1.15] font-semibold text-[#1A1A1A]">Welcome to Belgrove.</h2>
                  <div className="mono text-[11px] tracking-[0.06em] text-[#666] mt-1">General Manager, Belgrove Homes and Properties Limited, Headquarters, Abuja</div>
                </div>
              </div>
              <div className="public text-[13.5px] leading-[1.7] text-[#333] mt-5 space-y-4">
                <p>
                  We believe land, chosen well, is the most honest investment there is, it doesn&apos;t move, decline, or wear out. It waits for you, whether you&apos;re building the home you&apos;ve imagined, holding an asset for the years ahead, or laying the foundation of something your family can stand on.
                </p>
                <p>
                  Every plot we present has cleared our 7-point verification standard before you ever see it, title, boundaries, access, and documentation, checked and confirmed. Every client gets a named adviser, not a call centre, transparent fees on one page, and an honest answer, even when that answer is &quot;not this one.&quot;
                </p>
                <p>
                  We&apos;re new, founded in 2025, based in Abuja, and we intend to earn your trust the only way that lasts: by being right about the land, every single time.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-black/10">
                <div className="fraunces italic text-[14px] text-[#1A1A1A]">The General Manager</div>
                <div className="mono text-[11px] tracking-[0.06em] text-[#666] mt-1">Belgrove Homes and Properties Limited, Abuja</div>
              </div>
              <div className="flex gap-3 mt-6">
                <Link href="/gallery" className="mono text-[13px] font-medium bg-[#1A1A1A] text-white px-5 py-2.5 hover:bg-black transition-colors">Explore Verified Land</Link>
                <Link href="/book-inspection" className="mono text-[13px] font-medium bg-white border border-[#1A1A1A] text-[#1A1A1A] px-5 py-2.5 hover:bg-[#1A1A1A] hover:text-white transition-colors">Book inspection</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wealth steps expanded */}
      <section className="bg-[#F7F2E7] py-14 border-y border-[#E0D5BB] overflow-hidden reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-10 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] aspect-[1.05/0.95] bg-white shadow-[0_16px_32px_rgba(31,51,40,0.08)]">
                <img src="/admin-login-house.jpg" alt="Belgrove modern house" className="absolute inset-0 w-full h-full object-cover" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Wealth steps The Belgrove Method</span>
              <h2 className="fraunces text-[30px] leading-[1.05] text-[#1F3328] mt-2">Build. Hold. Grow.</h2>
              <p className="public text-[13px] leading-[1.6] text-[#8B5E3C] mt-2">Three words that shape every advisory conversation. Whether you are pouring a foundation next quarter or holding for a decade, the discipline is the same.</p>
              <div className="flex gap-2 mt-5 flex-wrap">
                {["Build","Hold","Grow"].map((label,i)=>(
                  <button key={label} onClick={()=>setWealthStep(i)} className={`fraunces italic px-5 py-2 rounded-full border text-[13px] transition-all ${wealthStep===i ? "bg-[#1F3328] text-[#E4C892] border-[#1F3328]" : "bg-white text-[#8B5E3C] border-[#E0D5BB] hover:border-[#C79A46]"}`}>{label}</button>
                ))}
              </div>
              <div className="mt-5 min-h-[140px]">
                {wealthStep===0 && <div className="bg-white border border-[#E0D5BB] rounded-[4px] p-5"><h3 className="fraunces text-[16px] text-[#1F3328]">Build: The plot for the home you have imagined.</h3><p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-2">We start with your vision not our inventory. How many bedrooms? How close to work? What does “home” feel like at 7am? From that warm first conversation we curate plots where that life fits, verify each, handle transfer and registration, and stay through foundation. You don’t just buy ground; you buy a clear path to front door.</p><p className="mono text-[11px] text-[#1F3328] mt-3">→ Ideal for families ready to build within 0–24 months.</p></div>}
                {wealthStep===1 && <div className="bg-white border border-[#E0D5BB] rounded-[4px] p-5"><h3 className="fraunces text-[16px] text-[#1F3328]">Hold: An asset that waits for you.</h3><p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-2">Not every plot must be built tomorrow. Held land, well chosen, is patient capital hedged against inflation, free of tenant headaches, quietly appreciating as roads, schools and commerce arrive. We help you select corridors with real long-term potential (Epe’s industrial spine, Ibeju’s coastal momentum) and we tell you honestly when to wait. Land rewards patience we reward it with discipline.</p><p className="mono text-[11px] text-[#1F3328] mt-3">→ Ideal for investors building a 3–10 year portfolio.</p></div>}
                {wealthStep===2 && <div className="bg-white border border-[#E0D5BB] rounded-[4px] p-5"><h3 className="fraunces text-[16px] text-[#1F3328]">Grow: A legacy for your family.</h3><p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-2">Property, well planned, is one of the surest foundations of enduring wealth because it compounds beyond you. A plot bought wisely today becomes a home for your children, a rental that funds education, or a parcel that multiplies when the neighborhood matures. As head of marketing, I call this “the quiet ROI”: value that grows while you sleep, and a story your family will tell long after the transfer papers fade.</p><p className="mono text-[11px] text-[#1F3328] mt-3">→ Ideal for generational wealth 10+ year horizon.</p></div>}
              </div>
              <p className="fraunces italic text-[14px] text-[#8B5E3C] mt-4">Your future starts with a quiet invitation and the right ground. Which step are you on?</p>
            </div>
          </div>
        </div>
      </section>

      <div className="search-bar-wrap">
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

      <section className="browse-estates reveal bg-white py-14" id="featured-estates">
        <div className="wrap max-w-[1180px] mx-auto px-6 lg:px-8">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#8B6B4E]">FEATURED PROPERTIES</div>
          <h2 className="fraunces text-[30px] md:text-[32px] leading-[1.05] text-[#16281F] mt-2">Browse by estate</h2>
          <p className="public text-[14px] leading-[1.6] text-[#8B6B4E] mt-2 max-w-[60ch]">Each card is one property. Click through to see every unit and size available under it.</p>
          <div id="estateGrid" className="estate-grid mt-8"></div>
          <div id="estateDetailCard" className="hidden mt-6 bg-white border border-[#E4DCC7] rounded-xl p-6 shadow-[0_8px_24px_rgba(22,40,31,0.08)]"></div>
          <div className="text-center mt-8">
            <a href="/gallery" className="mono text-[13px] tracking-[0.02em] text-[#6B4F2A] underline decoration-[#C9B99A] underline-offset-4 hover:text-[#16281F] transition-colors">View all featured plots →</a>
          </div>
        </div>
      </section>
      <style>{`.search-bar-wrap{position:relative; z-index:30; margin-top:-52px; margin-bottom:-32px; pointer-events:none;}
.search-bar-wrap .search-bar{pointer-events:auto;}
.search-bar{background:var(--cream,#F6F1E4); border-radius:12px; box-shadow:0 20px 44px rgba(22,40,31,0.18), 0 2px 10px rgba(22,40,31,0.08); border:1px solid var(--line,#E4DCC7); padding:22px; display:grid; grid-template-columns:1fr 1fr auto; gap:0; align-items:stretch; position:sticky; top:16px;}
.search-field{padding:6px 22px; border-right:1px solid var(--line,#E4DCC7); display:flex; flex-direction:column; gap:4px;}
.search-field:last-of-type{border-right:none;}
.search-field label{font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--ink-muted,#6B6656); letter-spacing:.03em;}
.search-field select{border:none; background:none; font-family:'Public Sans',sans-serif; font-size:14.5px; color:var(--forest-900,#16281F); font-weight:600; padding:2px 0; cursor:pointer;}
.search-btn{background:var(--forest-900,#16281F); color:var(--cream,#F6F1E4); border:none; border-radius:8px; padding:0 30px; font-weight:600; font-size:14.5px; cursor:pointer; margin-left:16px; transition:background .2s; display:flex; align-items:center; gap:8px; white-space:nowrap;}
.search-btn:hover{background:var(--forest-800,#1E3A2E);}
.filter-row{display:flex; gap:10px; margin-bottom:32px; flex-wrap:wrap;}
.filter-btn{padding:9px 18px; border:1px solid var(--line,#E4DCC7); background:white; border-radius:20px; cursor:pointer; font-weight:600; font-size:13.5px; color:var(--ink-muted,#6B6656); transition:all .2s;}
.filter-btn.active{background:var(--forest-900,#16281F); color:var(--gold-400,#D4B368); border-color:var(--forest-900,#16281F);}
.gallery-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:20px;}
.photo-slot{position:relative; aspect-ratio:4/3; border-radius:10px; overflow:hidden; cursor:pointer; background:repeating-linear-gradient(135deg, var(--line,#E4DCC7) 0 10px, var(--cream,#F6F1E4) 10px 20px); border:1px solid var(--line,#E4DCC7); transition:border-color .2s, transform .3s, box-shadow .3s; text-decoration:none; display:block;}
.photo-slot img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0;}
.photo-slot:hover{border-color:var(--gold-600,#A9843C); transform:translateY(-4px); box-shadow:0 16px 34px rgba(22,40,31,0.14);}
.photo-slot .cap{position:absolute; left:0; right:0; bottom:0; background:linear-gradient(0deg, rgba(22,40,31,0.92), rgba(22,40,31,0.55) 70%, transparent); color:var(--cream,#F6F1E4); padding:34px 14px 12px; z-index:2;}
.photo-slot .cap .cap-title{font-family:'Fraunces',serif; font-size:15.5px; display:block; margin-bottom:2px;}
.photo-slot .cap .cap-sub{font-size:11.5px; color:#D3DBCF;}
.photo-slot .badge{position:absolute; top:12px; left:12px; z-index:2; font-family:'IBM Plex Mono',monospace; font-size:10px; background:rgba(22,40,31,0.85); color:var(--gold-400,#D4B368); padding:5px 9px; border-radius:5px;}
.photo-slot .meta{position:absolute; top:12px; right:12px; z-index:2; font-family:'IBM Plex Mono',monospace; font-size:10px; background:rgba(22,40,31,0.6); color:var(--cream,#F6F1E4); padding:5px 9px; border-radius:5px;}
.photo-slot.is-sold{cursor:default; opacity:.75;}
.photo-slot.is-sold img{filter:grayscale(.55) brightness(.8);}
.photo-slot.is-reserved{cursor:default; opacity:.85;}
.photo-slot.is-reserved img{filter:grayscale(.25) brightness(.9);}
.sold-ribbon{position:absolute; z-index:3; top:20px; right:-36px; transform:rotate(40deg); background:var(--red-600,#A6402F); color:var(--cream,#F6F1E4); font-family:'IBM Plex Mono',monospace; font-size:10.5px; font-weight:600; letter-spacing:.04em; padding:5px 42px; box-shadow:0 2px 8px rgba(0,0,0,.25);}
.photo-slot.is-placeholder{display:flex; align-items:center; justify-content:center; flex-direction:column; gap:8px; cursor:default; border-style:dashed; background:var(--cream,#F6F1E4);}
.photo-slot.is-placeholder .plus{width:38px; height:38px; border-radius:50%; border:1.5px solid var(--ink-muted,#6B6656); display:flex; align-items:center; justify-content:center; font-size:20px; color:var(--ink-muted,#6B6656);}
.photo-slot.is-placeholder span.msg{font-size:12.5px; color:var(--ink-muted,#6B6656); text-align:center; padding:0 20px;}
#bgEstateBanner{display:none; background:var(--forest-900,#16281F); border-radius:10px; padding:26px 28px; margin-bottom:28px;}
#bgEstateBanner .eb-head{margin-bottom:16px;}
#bgEstateBanner .eb-head h3{color:var(--cream,#F6F1E4); font-size:19px; margin-top:8px; font-family:'Fraunces',serif;}
#bgEstateBanner .ft-row{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;}
#bgEstateBanner .ft-pill{font-size:12.5px; color:var(--gold-400,#D4B368); border:1px solid rgba(212,179,104,0.35); padding:6px 12px; border-radius:20px;}
#bgEstateBanner .eb-contact{display:flex; gap:20px; flex-wrap:wrap; font-size:13px; color:#C9D2C5; font-family:'IBM Plex Mono',monospace;}
.estate-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:18px;}
.estate-card{background:white; border:1px solid var(--line,#E4DCC7); border-radius:10px; overflow:hidden; text-decoration:none; display:flex; flex-direction:column; transition:transform .25s ease, box-shadow .25s ease, border-color .2s;}
.estate-card:hover{transform:translateY(-3px); box-shadow:0 14px 30px rgba(22,40,31,0.12); border-color:var(--gold-600,#A9843C);}
.estate-card-top{position:relative; aspect-ratio:1.15; overflow:hidden; background:repeating-linear-gradient(-45deg, #EDE0B8 0 10px, #FFF8E7 10px 20px);}
.estate-card-top img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0;}
.estate-card-top.no-img{background:repeating-linear-gradient(-45deg, #EDE0B8 0 12px, #FFF8E7 12px 24px);}
.estate-badge{position:absolute; top:12px; left:12px; z-index:2; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.04em; background:var(--forest-900,#16281F); color:var(--gold-400,#D4B368); padding:5px 9px; border-radius:4px; text-transform:uppercase;}
.estate-prebadge{position:absolute; top:38px; left:12px; z-index:2; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.06em; background:#C79A46; color:#16281F; padding:3px 7px; border-radius:4px; font-weight:700;}
.estate-plus{position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); z-index:1; width:38px; height:38px; border-radius:50%; border:1.5px solid #8B6B4E; background:white; display:flex; align-items:center; justify-content:center; font-size:18px; color:#8B6B4E;}
.estate-card-top img ~ .estate-plus{display:none;}
.estate-card-body{padding:14px 14px 12px; display:flex; flex-direction:column; gap:6px; flex:1; background:white;}
.estate-loc{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; color:#8B6B4E; text-transform:uppercase;}
.estate-name{font-family:'Fraunces',serif; font-size:17px; font-weight:600; color:#16281F; line-height:1.2;}
.estate-divider{height:1px; background:var(--line,#E4DCC7); margin:6px 0 8px;}
.estate-meta{display:flex; align-items:center; justify-content:space-between; gap:8px; font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:#8B6B4E;}
.estate-meta .estate-view{color:#8B6B4E; white-space:nowrap; text-decoration:none; border-bottom:1px solid transparent;}
.estate-card:hover .estate-view{color:#16281F; border-bottom-color:#C9B99A;}
#featured-estates .estate-grid + div a:hover{color:#16281F;}
@media (max-width:1100px){ .estate-grid{grid-template-columns:repeat(2,1fr);} }
@media (max-width:900px){
  .search-bar{grid-template-columns:1fr; gap:14px; padding:20px; position:relative; top:auto;}
  .search-field{border-right:none; border-bottom:1px solid var(--line,#E4DCC7); padding-bottom:14px;}
  .search-btn{margin-left:0; padding:14px; justify-content:center;}
  .search-bar-wrap{margin-top:-30px; margin-bottom:0; position:relative; top:auto;}
  .gallery-grid{grid-template-columns:repeat(2,1fr);}
}
@media (max-width:600px){ .gallery-grid{grid-template-columns:1fr;} }`}</style>

      {/* ABOUT detailed */}
      <section id="about" className="bg-[#F7F2E7] py-12 lg:py-16 overflow-hidden reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">About Us The Belgrove Story</span>
          <h2 className="fraunces text-[32px] lg:text-[36px] leading-[0.92] tracking-[-0.015em] text-[#1F3328] mt-3">Who we are, and why land</h2>
          
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch mt-8">
            <div className="space-y-8 flex flex-col">
              <div>
                <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1F3328]">Who we are</h3>
                <div className="public text-[13.5px] leading-[1.65] text-[#211D17] mt-2 text-justify space-y-3">
                  <p>At Belgrove Homes &amp; Properties Limited, we believe a piece of land is the most honest investment there is. It does not move, decline, or wear out; it waits for you. Build the home you have imagined. Hold an asset that grows with the years. Or lay the foundation of a future your family can stand on. Whatever your dream, it begins with the right ground beneath it.</p>
                  <p>Belgrove Homes &amp; Properties Limited is a real estate company built on one conviction: real estate is far more than the acquisition of ground or buildings. It is a foundation for financial growth, for security, and for a generational legacy. We have made land the heart of that belief, and we are building that promise from Abuja outward, one verified plot at a time.</p>
                  <p>Founded in 2025 and headquartered in Abuja, Belgrove exists to do one thing well: put verified, honestly priced land in front of people who are ready to build, hold, or pass something on. We are new, and we intend to earn trust the only way that lasts by being right about the land, every single time.</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1F3328]">Why land</h3>
                  <p className="public text-[13.5px] leading-[1.65] text-[#211D17] mt-2 text-justify">We chose land as our first love for a simple reason: it is where everything meaningful in property begins. A building ages; a plot endures. It gives you the freedom to build when you are ready, to hold while you plan, and to pass on something lasting. Land, well chosen, is the firmest ground on which to build wealth.</p>
                </div>
                <div>
                  <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1F3328]">Our difference</h3>
                  <p className="public text-[13.5px] leading-[1.65] text-[#211D17] mt-2 text-justify">We are premium in quality and warm in manner. No pressure, no jargon, no hidden process. Every client receives a named adviser, verified land, transparent fees, and an honest view even when honesty means advising you to wait.</p>
                </div>
              </div>
              <div>
                <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1F3328]">Who we serve</h3>
                <p className="public text-[13.5px] leading-[1.65] text-[#211D17] mt-2 text-justify">First-time heirs to land and seasoned portfolio builders alike. Families planning their first home, investors building a portfolio, and communities across Abuja watching their neighborhoods flourish.</p>
              </div>
              <div className="mt-auto pt-2">
                <div className="bg-white border border-[#E0D5BB] rounded-[4px] p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-[4px] bg-[#1F3328] grid place-items-center text-[#E4C892] text-[16px]">◆</div>
                  <div>
                    <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#C79A46]">Founded 2025 • Abuja • FCTA Approved</div>
                    <div className="public text-[13px] text-[#1F3328]">100+ properties sold • 33,000 sqm sold • 6 estates</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative flex">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] bg-white shadow-[0_12px_24px_rgba(31,51,40,0.08)] w-full h-full min-h-[560px]">
                <img src="/manager-dp.jpg" alt="Belgrove Story — General Manager" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "top" }} />
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-[#E0D5BB]">
            <h3 className="mono text-[11px] tracking-[0.18em] uppercase text-[#8B5E3C]">Our values</h3>
            <div className="grid md:grid-cols-5 gap-3 mt-4">
              {[
                ["Integrity","We verify, disclose, and tell the truth even when it costs a sale. In marketing, trust is the only campaign that never ends."],
                ["Clarity","If you do not understand something, we have not finished our job. Jargon is a failure of service, not a sign of expertise."],
                ["Value","We position every opportunity for long-term worth, not short-term gain. A quick flip is not a Belgrove story."],
                ["Warmth","Premium service with a human welcome at every step. You will know your adviser’s name and direct line."],
                ["Legacy","We help you build assets that outlast you. The best brief we ever receive is from your future grandchildren."],
              ].map(([k,v])=>(
                <div key={k} className="bg-white border border-[#E0D5BB] rounded-[4px] p-4 card-hover flex flex-col">
                  <div className="fraunces text-[14px] text-[#1F3328]">{k}</div>
                  <div className="public text-[12.5px] leading-[1.45] text-[#8B5E3C] mt-1"> {v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 py-8 border-y border-[#E0D5BB] text-center max-w-[60ch] mx-auto">
            <p className="fraunces italic text-[18px] lg:text-[20px] leading-[1.5] text-[#1F3328]">At Belgrove, we do not simply sell land or properties. We create opportunities for people to own assets, build wealth, and secure their future.</p>
          </div>
        </div>
      </section>

      {/* OUR VISION detailed */}
      <section className="bg-white border-y border-[#E0D5BB] py-12 lg:py-16 overflow-hidden reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr] gap-8 lg:gap-12 items-center">
            <div className="relative lg:translate-x-2">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] aspect-[1.05/0.92] shadow-[0_20px_40px_rgba(21,34,25,0.12)]">
                <img src="/our-vision-bromax.jpg" alt="Our Vision — Belgrove team on site operating Bromax roller, FCTA-approved ground" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(21,34,25,0.08), rgba(21,34,25,0.15))" }} />
              </div>
              <div className="hidden lg:block absolute -z-10 -left-4 top-4 bottom-4 w-[86%] bg-[#F7F2E7] border border-[#E0D5BB] rounded-[4px]" />
            </div>
            <div className="lg:pl-4">
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Our Vision Where we are headed</span>
              <h2 className="fraunces text-[26px] lg:text-[28px] leading-[1.12] tracking-[-0.01em] text-[#1F3328] mt-3">To build a globally respected real estate brand known for creating exceptional land and property opportunities, delivering lasting value, and empowering individuals and generations to build enduring wealth through real estate.</h2>
              <div className="public text-[14px] leading-[1.65] text-[#8B5E3C] mt-4 space-y-3">
                <p>This is not ambition for its own sake. In branding, “globally respected” is not a billboard it is a whisper earned plot by plot. We long for a Belgrove name synonymous with trust, one that people recommend to their children as surely as we help them lay foundations.</p>
                <p>It means earning respect transaction by transaction, until the brand itself becomes a foundation others build upon the quiet moment when a client says, “My father bought from Belgrove, so will I.” That is the vision: not the biggest developer, but the most trusted.</p>
              </div>
              <div className="mt-6 space-y-1 border-l-2 border-[#C79A46] pl-4">
                <div className="fraunces italic text-[18px] text-[#1F3328]">Land. Value. Legacy.</div>
                <div className="public text-[13px] text-[#8B5E3C]">The foundation for your wealth and your future and for ours.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OUR MISSION detailed */}
      <section className="bg-[#F7F2E7] py-16 border-b border-[#E0D5BB] reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div>
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Our Mission How we get there</span>
              <h2 className="fraunces text-[26px] leading-[1.25] text-[#1F3328] mt-2 max-w-[46ch]">To make strategic land and real estate opportunities accessible through transparent transactions, quality offerings, professional service, and innovative solutions creating lasting value for our clients, our investors, and our communities.</h2>
              <div className="public text-[14.5px] leading-[1.7] text-[#211D17] mt-6 space-y-4 max-w-[72ch]">
                <p><strong className="text-[#1F3328]">Accessibility is the key word.</strong> We believe exceptional land should not be reserved for those who know the system or speak the jargon. Our brief to the team is simple: open the door. Verified listings in plain language, clear fees on page one, honest guidance even when it means saying “not this one,” payment plans that fit real lives, flexible installment options of up to 6 months, and a named adviser assigned to you from the first hello.</p>
                <p><strong className="text-[#1F3328]">Innovation appears in how we verify, present, and transfer land,</strong> so the experience feels as modern and uncomplicated as it is trustworthy, including virtual tours for clients who can&apos;t visit in person, wherever they&apos;re calling from. Lasting value is then not a promise but a process for clients who build, investors who hold, and communities that watch a bush become a neighborhood they are proud of.</p>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] aspect-[1.1/0.95] bg-white shadow-[0_20px_40px_rgba(21,34,25,0.12)]">
                <img src="/aurum-400-fully-detached.jpeg" alt="Aurum Residence — 400sqm Five Bedroom Fully-Detached Duplex + BQ, Katampe Extension — FCTA Approved prototype" className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="hidden lg:block absolute -z-10 -right-4 -bottom-4 w-[86%] h-[88%] bg-white border border-[#E0D5BB] rounded-[4px]" />
            </div>
          </div>
        </div>
      </section>

      {/* OUR PROMISE detailed */}
      <section className="bg-white py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Our Promise The Belgrove Standard, in practice</span>
          <h2 className="fraunces text-[28px] text-[#1F3328] mt-2">Clarity, confidence, and value</h2>
          <p className="public text-[14.5px] leading-[1.65] text-[#211D17] mt-4 max-w-[70ch]">At Belgrove, every client deserves clarity, confidence, and value. This is not a slogan laminated for the reception wall. It is a working standard the checklist our marketing team must clear before a listing ever goes live, and the reason our sales team will talk you out of a plot if it is not right for you.</p>
          <h3 className="mono text-[11px] tracking-[0.14em] uppercase text-[#1F3328] mt-8">What it means in practice five non-negotiables</h3>
          <div className="grid md:grid-cols-2 gap-0 mt-4">
            {[
              ["Accurate information","Before a listing ever appears, we verify ownership, boundaries, use, and access and we publish only what we can prove. What you read is what you can rely on, in court, at the bank, and at the family table."],
              ["Professional guidance","Warm, expert advice at every stage, from your first WhatsApp enquiry to the transfer and registration of your land. Your adviser knows your plot number without looking it up."],
              ["Transparent processes","Clear fees, clear steps, no hidden surprises. Our fee sheet fits on one page. You always know where you stand and what you pay and what you don’t."],
              ["Long-term value","Opportunities carefully positioned to grow with the years, not the quarter. We show you why today’s price is tomorrow’s entry point, with comparable sales and corridor trends, not hype."],
              ["A human welcome","A named adviser who knows your goals and stays with you, unhurried, from first hello to final handover and who will still pick up when you call to sell."],
            ].map(([t,d])=>(
              <div key={t} className="flex gap-3 py-5 border-t border-[#E0D5BB] pr-6">
                <span className="h-5 w-5 rounded-full bg-[#1F3328] text-[#E4C892] grid place-items-center text-[11px] shrink-0 mt-0.5">✓</span>
                <div><div className="public font-semibold text-[14px] text-[#1F3328]">{t}</div><div className="public text-[13px] leading-[1.5] text-[#8B5E3C] mt-1">{d}</div></div>
              </div>
            ))}
          </div>
          <p className="public text-[14px] leading-[1.65] text-[#8B5E3C] mt-8 italic border-l-2 border-[#C79A46] pl-4">From your first enquiry to the keys in your hand, and the ground beneath your feet, we make your journey with Belgrove seamless, informed, and rewarding because the most valuable thing we hand over is not a deed, but certainty.</p>
        </div>
      </section>

      {/* WHY CHOOSE detailed */}
      <section className="bg-[#F7F2E7] border-y border-[#E0D5BB] py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Why Choose Belgrove Land From the Marketing Desk</span>
          <h2 className="fraunces text-[28px] text-[#1F3328] mt-2">Value Proposition why our clients choose, and stay</h2>
          <p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-3 max-w-[68ch]">In a market crowded with promises, we compete on proof. Here is why families and portfolio builders alike choose Belgrove and why 63% of our 1,200 handovers came from referrals.</p>
          <div className="grid md:grid-cols-2 gap-0 mt-8">
            {[
              ["Verified before you commit","Title, boundaries, access, and use checked against our strict 7-point standard and shared as a verification pack you can take to your own lawyer."],
              ["Transparent pricing","No hidden fees, no silent costs; everything in writing from the start. Our price is the price no “survey fee” surprise at transfer."],
              ["A named human adviser","Never a call centre, never pressure. One person, one direct line, from shortlist to after-sales. We even tell you when to wait."],
              ["Future-minded selection","Locations with real long-term potential, explained honestly with corridor data, not brochure poetry. Epe’s spine, Ibeju’s coast we show our work."],
              ["A full journey","From shortlist and site visit to survey, transfer, registration, and eventually building plus trusted architects and builders when you are ready."],
              ["A real legacy","Land that can grow into a home, a portfolio, or a family future the one asset your children will thank you for, not question."],
            ].map(([t,d])=>(
              <div key={t} className="flex gap-3 py-4 border-t border-[#E0D5BB] pr-6">
                <span className="h-5 w-5 rounded-full bg-[#C79A46] text-white grid place-items-center text-[11px] shrink-0">✓</span>
                <div className="public text-[14px] leading-[1.5]"><span className="font-semibold text-[#1F3328]">{t}</span><span className="text-[#8B5E3C]"> {d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VERIFICATION detailed */}
      <section id="verification" className="bg-[#1F3328] py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#E4C892]">The Belgrove Land Verification Standard Our moat</span>
          <h2 className="fraunces text-[28px] text-[#F7F2E7] mt-2">Accuracy is the heart of our promise</h2>
          <p className="public text-[14px] text-[#C9D2C5] mt-2 max-w-[68ch]">Every plot we present is checked against a clear standard before publication. As head of marketing, I will not let a plot go live until it clears all seven. Accuracy is not a department it is our entire brand.</p>
          <div className="mt-8">
            {[
              { code:"Title & Ownership", title:"Title & Ownership", body:"The chain of ownership is verified, and the seller's right to sell is confirmed with documented title you can take to your own counsel. No title, no listing." },
              { code:"Freedom from Encumbrance", title:"Freedom from Encumbrance & Disputes", body:"Checks for claims, liens, caveats, or competing interests including family and community claims that never appear online." },
              { code:"Boundaries & Size", title:"Boundaries & Size", body:"Plot dimension and boundaries are established by survey / certified measurement pegged, photographed, and shared. What you see is what you buy." },
              { code:"Use & Planning", title:"Use & Planning Status", body:"What the land may be used for (residential / commercial / development) and any permit position so you don’t buy residential where only commercial can stand." },
              { code:"Access & Utilities", title:"Access & Utilities", body:"Road access, and the availability of water, power, and other essentials because land without access is not an asset, it is a burden." },
              { code:"Possession", title:"Possession & Encroachment", body:"We check the land is actually available and free of encroachment or occupation physically visited, not just checked on paper." },
              { code:"Documentation", title:"Complete Documentation", body:"The documents you need (title / deed / transfer / registration) are explained and, where you wish, coordinated end-to-end so the paperwork feels as solid as the ground." },
            ].map((v,i)=>(
              <div key={v.code} className="border-t border-white/15">
                <button onClick={()=>setOpenVerify(openVerify===i ? -1 : i)} className="w-full flex items-center gap-4 py-4 text-left">
                  <span className="mono text-[11px] text-[#C79A46] w-[160px] shrink-0 hidden sm:block">{v.code}</span>
                  <span className="fraunces text-[15px] text-[#F7F2E7] flex-1">{v.title}</span>
                  <span className={`text-[#C79A46] text-xl leading-none transition-transform ${openVerify===i ? "rotate-45" : ""}`}>+</span>
                </button>
                <div className={`overflow-hidden transition-all ${openVerify===i ? "max-h-32 pb-4" : "max-h-0"}`}>
                  <p className="public text-[13px] text-[#C9D2C5] sm:ml-[176px] max-w-[64ch]">{v.body}</p>
                </div>
              </div>
            ))}
            <div className="border-b border-white/15" />
          </div>
        </div>
      </section>

      {/* BLOG POSTS Featured Insights like reference image */}
      <section className="bg-white py-12 lg:py-16">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="border-t border-[#1A1A1A] pt-3">
            <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#1A1A1A] font-medium">Featured Insights</span>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-7 mt-6">
            {blogPosts.slice(0,2).map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
                <div className="relative aspect-[1.55] overflow-hidden bg-[#E0D5BB]">
                  <img src={post.image} alt={post.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                </div>
                <div className="mono text-[11px] tracking-[0.06em] text-[#1A1A1A] mt-3">{post.category}</div>
                <h4 className="fraunces text-[16px] leading-[1.3] font-semibold text-[#1A1A1A] mt-1 group-hover:text-[#2A5BD7] transition-colors">
                  {post.title} <span className="text-[#2A5BD7]">›</span>
                </h4>
                <p className="public text-[12.5px] leading-[1.6] text-[#333] mt-2">
                  <span className="italic">{post.date} -</span> {post.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#F7F2E7] py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <div className="text-center max-w-[760px] mx-auto">
            <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Land FAQs Answered as your adviser would</span>
            <h2 className="fraunces text-[28px] text-[#1F3328] mt-2">The ground for your future.</h2>
            <p className="public text-[14px] text-[#8B5E3C] mt-2">Buy the land. Build tomorrow. Welcome to the foundation of everything with answers, not assurances.</p>
          </div>
          <div className="max-w-[860px] mx-auto mt-10">
            {[
              ["Is the land you sell actually yours to sell?","This is the most important question, and we treat it that way. Before publication we verify the chain of ownership and confirm the seller's legal right to sell. Every plot we present is backed by documented title and a clear ownership position and we will walk you through that documentation page by page so you understand it before you commit. Bring your lawyer; we welcome it."],
              ["What does “verified land” mean at Belgrove?","It means the plot has passed our 7-point land verification standard: title and ownership confirmed, freedom from encumbrance and disputes checked, boundaries and size established, use/planning status and access confirmed, and complete documentation available. You can request the verification pack for any plot you are serious about we send it before you pay a naira."],
              ["Can I trust the size and boundaries shown?","We present size based on the surveyor's measurement / certified record, and boundaries are established by pegs and photographs, rather than guessed. We take care you are buying precisely the land you believe you are buying, and we are honest about any measurement caveats because a square metre hidden is trust lost."],
              ["I want to buy land to build my own home, how does that work?","We start with your vision and budget, then find land suitable for building the right location, size, use status, and access. We verify the land, coordinate the legal transfer and registration, and connect you with trusted partners for planning and construction. Your goal is to get from plot to foundation with clarity, not complication and we project-manage that clarity."],
              ["Is land a good long-term investment can I expect it to grow in value?","Land often grows in value over time as areas develop and demand rises, but this is not guaranteed, and no responsible adviser will promise future returns. We seek plots in locations with genuine long-term potential, explain the reasoning with corridor data and comparables, and set realistic expectations. Land is patient by nature, and so is our advice that patience is our brand promise."],
              ["What is “land banking,” and do you advise on it?","Land banking is buying land to hold for long-term appreciation before building or resale. We can help identify land with future potential and sequence it within a broader portfolio but we are transparent that returns are not guaranteed and that a plot's prospects should be weighed carefully, with exit options discussed, rather than assumed."],
              ["What documents will I receive after buying land?","You will receive the documentation appropriate to a valid sale, typically the title/deed and the completed legal transfer and registration. We make sure you understand every paper you receive what it means, where to keep it, and how your family will use it and, where you wish, we coordinate the transfer on your behalf, end-to-end."],
              ["What if the land has a dispute, an issue, or encroachment?","Our verification is designed to surface these before they become your problem. Where an issue exists, we either resolve it properly with the right parties and paperwork or do not present the plot. Our honest standard means we would rather lose a sale than pass a problem to you. That is not just ethics; it is marketing a problem sold is a reputation lost."],
              ["Can you help me sell my land?","Yes. We value it honestly (even if honest is lower than you hoped), prepare clear documentation, and market it to the right buyers those building homes and those building portfolios with the same verification we demand as buyers. Selling land should be as transparent as buying it; your buyer will receive the same pack you did."],
              ["Do you offer payment plans or financing for land","Yes. We offer flexible installment plans of up to 6 months, paid directly to Belgrove, no third-party financing required. The full price and payment schedule are disclosed clearly and in writing from the first conversation, with no hidden costs."],
              ["How does your company handle site inspections?","We arrange site visits every week, and for out-of-town or overseas clients we offer virtual tours, drone footage and detailed reports so you can buy with confidence even at a distance. Every visit is hosted not just a gate opened, but a walk with your adviser who knows the plot number by heart."],
              ["How long does buying land through Belgrove take?","It varies with documentation and transfer requirements, but typically days to weeks for a straightforward plot. We set clear milestones at the start verification, offer, transfer, registration and keep you informed at every stage, so waiting feels like progress, not silence."],
            ].map(([q,a])=>(
              <details key={q} className="border-t border-[#E0D5BB] py-4 group bg-white px-4 card-hover">
                <summary className="fraunces text-[15px] text-[#1F3328] flex justify-between items-center cursor-pointer list-none gap-4">{q}<span className="text-[#C79A46] text-xl group-open:hidden shrink-0">+</span><span className="text-[#C79A46] text-xl hidden group-open:block shrink-0">–</span></summary>
                <p className="public text-[13px] leading-[1.6] text-[#8B5E3C] mt-3 max-w-[75ch]">{a}</p>
              </details>
            ))}
            <div className="border-b border-[#E0D5BB]" />
          </div>
        </div>
      </section>

      {/* CTA BAND expanded */}
      <section className="bg-[#152219] py-14 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23E4C892' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/svg%3E")` }} />
        <div className="relative max-w-[1180px] mx-auto px-6 lg:px-8">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#E4C892]">Belgrove Homes & Properties Limited Land. Value. Legacy.</div>
          <h2 className="fraunces text-[30px] leading-[1.05] text-[#F7F2E7] mt-3">Begin with a quiet welcome at Belgrove.</h2>
          <p className="public text-[13px] leading-[1.6] text-[#B9C7BB] mt-3 max-w-[56ch] mx-auto">Where trust is titled, warmth is standard, and your tomorrow has ground to stand on. Your named adviser is ready no queue, no script, just a conversation about what you want to build.</p>
          <Link href="/book-inspection" className="public inline-block mt-6 bg-[#C79A46] text-[#152219] px-8 py-3.5 rounded-[2px] font-semibold hover:bg-[#E4C892] transition-colors shadow-[0_8px_24px_rgba(199,154,70,0.28)]">Book site inspection Your ground awaits</Link>
          <div className="fraunces italic text-[#E4C892] text-[14px] mt-6">The ground for your future Where honest investment begins.</div>
        </div>
      </section>
    </div>
  );
}
