export default function VisionPage() {
  return (
    <div className="bg-[#F7F2E7]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet" />
      <style>{`.fraunces{font-family:Fraunces,serif} .mono{font-family:IBM Plex Mono,monospace} .public{font-family:Public Sans,sans-serif}`}</style>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#152219]">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-70">
          <source src="/belgrove-legacy-night-aerial.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,26,18,0.55), rgba(15,26,18,0.78))" }} />
        <div className="relative max-w-[1180px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#E4C892]">Our Vision · Our Promise</span>
          <h1 className="fraunces text-[38px] lg:text-[48px] leading-[0.95] tracking-[-0.02em] text-[#F7F2E7] mt-4 max-w-[18ch]" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
            Real estate should feel like a <span className="italic text-[#E4C892]">relationship,</span> not a transaction.
          </h1>
          <p className="public text-[#D9E0D5] text-[16px] leading-[1.65] max-w-[52ch] mt-6">A globally respected brand, known for exceptional land opportunities recommended by families to their children, decades from now.</p>
        </div>
      </section>

      {/* Narrative */}
      <section className="max-w-[1180px] mx-auto px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
          <div className="public text-[15px] leading-[1.7] text-[#211D17] space-y-5">
            <p>Belgrove Homes was founded in 2025 on a simple belief: the people buying and selling homes deserve an agent who treats the process with the same care they would want for their own family. That belief still shapes every inspection we schedule and every offer we help negotiate today.</p>
            <p>We started as a two-person office above a coffee shop, and grew because clients kept sending their friends back to us. Nearly two decades later, our approach hasn’t changed even as our reach has: we still walk every property ourselves, we still answer the hard questions honestly, and we still believe the right home is worth taking the time to find.</p>
            <p>Our mission is to make the property search transparent and unhurried giving buyers the full picture before they commit, and giving sellers a team that represents their home as carefully as they would themselves.</p>
            <div className="fraunces italic text-[20px] text-[#1F3328] border-l-2 border-[#C79A46] pl-5 mt-8">Land. Value. Legacy.</div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[4px] overflow-hidden border border-[#E0D5BB] bg-white">
              <img src="/our-vision-bromax.jpg" alt="Our Vision — Belgrove team on Bromax roller, Kabusa-Ketti North" className="w-full aspect-[1.45] object-cover" />
              <div className="p-4">
                <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#C79A46]">How we build — On Site</div>
                <div className="fraunces text-[16px] text-[#1F3328] mt-1">Acquisition → Master Plan → Construction → Infrastructure → Handover</div>
                <div className="public text-[13px] text-[#8B5E3C] mt-2">One team owns the entire lifecycle. FCTA-approved ground, Bromax-compacted. Where we are headed is built, not promised.</div>
              </div>
            </div>
            <div className="bg-[#1F3328] rounded-[4px] p-6 text-[#F7F2E7]">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-[4px] bg-[#C79A46] grid place-items-center text-[#152219]">◆</span>
                <div><div className="fraunces text-[15px]">The Belgrove Standard</div><div className="public text-[12px] text-[#B9C7BB]">6 checks before you ever see a plot</div></div>
              </div>
              <ul className="public text-[13px] leading-[1.6] text-[#D9E0D5] mt-4 grid grid-cols-2 gap-2">
                <li>• Title & ownership</li><li>• No encumbrance</li><li>• Boundaries & size</li><li>• Use & planning</li><li>• Access & utilities</li><li>• Possession</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {[
            { label: "Transparency", body: "No hidden conditions, no rushed walkthroughs. Every fee in writing before you commit." },
            { label: "Craft", body: "Every listing photographed, staged, and priced with intention like a Fortune 500 product." },
            { label: "Trust", body: "Long-term relationships over one-time closings. 1,200 families and counting." },
          ].map((v) => (
            <div key={v.label} className="bg-white border border-[#E0D5BB] rounded-[4px] p-6 hover:border-[#C79A46]/30 transition-colors">
              <h3 className="fraunces text-[18px] text-[#1F3328]">{v.label}</h3>
              <p className="public text-[13px] leading-[1.6] text-[#8B5E3C] mt-2">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-white border-y border-[#E0D5BB] py-16">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <h2 className="fraunces text-[26px] text-[#1F3328]">From coffee shop to 6 estates</h2>
          <div className="mt-8 grid md:grid-cols-4 gap-6">
            {[
              ["2025","Two advisers, one promise: tell the truth about land."],
              ["2013","Belgrove I 112 plots, first to deliver school + market with phase 1."],
              ["2019","Belgrove III 480 plots, still estate-managed."],
              ["2024","Belgrove IV 1.4 km amenity spine, night aerial live."],
            ].map(([y,d])=>(
              <div key={y} className="border-l border-[#E0D5BB] pl-4">
                <div className="fraunces text-[22px] text-[#C79A46]">{y}</div>
                <div className="public text-[13px] text-[#8B5E3C] mt-1 leading-relaxed">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
