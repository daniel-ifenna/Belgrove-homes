"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BELGROVE_PLOTS, BELGROVE_ESTATE_INFO } from "@/lib/belgroveData";

function formatNaira(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

export default function GalleryGrid() {
  const searchParams = useSearchParams();
  const initialEstate = searchParams.get("estate") || "all";
  const initialPhase = searchParams.get("phase") || "";
  const initialSize = searchParams.get("size") || "";

  const [activeEstate] = useState<string>(initialEstate);
  const [activePhase] = useState<string>(initialPhase);
  const [activeSize] = useState<string>(initialSize);
  const [status, setStatus] = useState<"all" | "available" | "sold">("all");

  // Group plots by estate + phase (split Sunrise 1 / 2)
  const grouped = useMemo(() => {
    const groups: Record<string, typeof BELGROVE_PLOTS> = {};
    BELGROVE_PLOTS.forEach((p) => {
      const key = p.phase ? `${p.estate} — ${p.phase}` : p.estate;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    // filter by estate/phase/size query if present
    const filteredGroups: typeof groups = {};
    Object.entries(groups).forEach(([key, plots]) => {
      const baseEstate = key.split(" — ")[0];
      const phase = key.includes(" — ") ? key.split(" — ")[1] : "";
      if (activeEstate !== "all" && baseEstate !== activeEstate) return;
      if (activePhase && phase !== activePhase) return;
      const filtered = plots.filter((p) => {
        if (activeSize && String(p.size) !== activeSize) return false;
        if (status !== "all" && p.status !== status) return false;
        return true;
      });
      if (filtered.length) filteredGroups[key] = filtered;
    });
    // sort by key for “according to their property name” — Aurum, Peninsula, Starlight, Sunrise Phase 1, Sunrise Phase 2
    const sortedKeys = Object.keys(filteredGroups).sort((a, b) => a.localeCompare(b));
    const sortedGroups: typeof groups = {};
    sortedKeys.forEach((k) => {
      sortedGroups[k] = [...filteredGroups[k]].sort((a, b) => a.size - b.size);
    });
    return sortedGroups;
  }, [activeEstate, activePhase, activeSize, status]);

  const estates = Object.keys(grouped);

  // detail card for single filtered property (title card below)
  const detailKey = estates.length === 1 ? estates[0] : null;
  const detailGroup = detailKey ? grouped[detailKey] : null;

  if (!estates.length) {
    return (
      <div className="public text-[13px] text-[#8B6B4E] text-center py-12 border border-dashed border-[#E4DCC7] rounded-lg bg-white">
        No plots match that filter — try Another estate or status.
      </div>
    );
  }

  return (
    <div>
      {/* Status filter */}
      <div className="flex gap-2 mb-8 flex-wrap">
        <button
          onClick={() => setStatus("all")}
          className={`px-4 py-2 rounded-full border text-[13px] font-semibold transition-colors ${status === "all" ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : "bg-white border-[#E4DCC7] text-[#6B6656] hover:border-[#A9843C]"}`}
        >
          All statuses
        </button>
        <button
          onClick={() => setStatus(status === "available" ? "all" : "available")}
          className={`px-4 py-2 rounded-full border text-[13px] font-semibold transition-colors ${status === "available" ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : "bg-white border-[#E4DCC7] text-[#6B6656] hover:border-[#A9843C]"}`}
        >
          Available
        </button>
        <button
          onClick={() => setStatus(status === "sold" ? "all" : "sold")}
          className={`px-4 py-2 rounded-full border text-[13px] font-semibold transition-colors ${status === "sold" ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : "bg-white border-[#E4DCC7] text-[#6B6656] hover:border-[#A9843C]"}`}
        >
          Sold Out
        </button>
      </div>

      {detailKey && detailGroup && (
        (() => {
          const key = detailKey;
          const group = detailGroup;
          const baseEstate = key.split(" — ")[0];
          const location = group[0].location;
          const sizes = [...new Set(group.map((p) => p.size))].sort((a, b) => a - b);
          const sizeLabel = sizes.length === 1 ? `${sizes[0]}sqm` : sizes.length === 2 ? `${sizes[0]}, ${sizes[1]}sqm` : `${Math.min(...sizes)}–${Math.max(...sizes)}sqm`;
          const prices = group.map((p) => p.price).filter((v): v is number => typeof v === "number");
          const isPreSaleGroup = key.includes("Phase 2");
          const basePriceLabel = prices.length ? `${formatNaira(Math.min(...prices))} – ${formatNaira(Math.max(...prices))}` : "Price on request";
          const priceLabel = basePriceLabel + (isPreSaleGroup ? " • Pre-Sale" : "");
          return (
            <div className="mb-8 bg-white border border-[#E4DCC7] rounded-xl p-6 shadow-[0_8px_24px_rgba(22,40,31,0.08)]">
              <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">{location.toUpperCase()}</div>
              <h3 className="fraunces text-[22px] text-[#16281F] mt-1">{key}{isPreSaleGroup && <span className="ml-2 mono text-[10px] bg-[#C79A46] text-[#16281F] px-2 py-1 rounded">PRE-SALE</span>}</h3>
              <div className="public text-[13px] text-[#6B6656] mt-2">
                {group.length} unit{group.length > 1 ? "s" : ""} • {sizeLabel} • {priceLabel}
              </div>
              <div className="mt-4 pt-4 border-t border-[#E4DCC7] public text-[12.5px] leading-[1.6] text-[#6B6656]">
                <span className="font-semibold text-[#16281F]">FCTA Approved:</span> Prototype you see {group.length > 1 ? "are" : "is"} the FCTA-approved building prototype for {key} — located at {location}, available in {sizeLabel} from {basePriceLabel}{isPreSaleGroup ? " (Pre-Sale offers)" : ""}. Verified land, what you see is what is approved to build.
              </div>
            </div>
          );
        })()
      )}

      <style>{`
        .gallery-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:20px;}
        .photo-slot{position:relative; aspect-ratio:4/3; border-radius:10px; overflow:hidden; cursor:pointer; background:repeating-linear-gradient(135deg, var(--line,#E4DCC7) 0 10px, var(--cream,#F6F1E4) 10px 20px); border:1px solid var(--line,#E4DCC7); transition:border-color .2s, transform .3s, box-shadow .3s; text-decoration:none; display:block;}
        .photo-slot img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0;}
        .photo-slot:hover{border-color:var(--gold-600,#A9843C); transform:translateY(-4px); box-shadow:0 16px 34px rgba(22,40,31,0.14);}
        .photo-slot .cap{position:absolute; left:0; right:0; bottom:0; background:linear-gradient(0deg, rgba(22,40,31,0.92), rgba(22,40,31,0.55) 70%, transparent); color:var(--cream,#F6F1E4); padding:34px 14px 12px; z-index:2; transition:opacity .2s;}
        .photo-slot:hover .cap{opacity:0.92;}
        .photo-slot .cap .cap-title{font-family:'Fraunces',serif; font-size:15.5px; display:block; margin-bottom:2px;}
        .photo-slot .cap .cap-sub{font-size:11.5px; color:#D3DBCF;}
        .photo-slot .badge{position:absolute; top:12px; left:12px; z-index:2; font-family:'IBM Plex Mono',monospace; font-size:10px; background:rgba(22,40,31,0.85); color:var(--gold-400,#D4B368); padding:5px 9px; border-radius:5px;}
        .photo-slot .pre-badge{position:absolute; top:38px; left:12px; z-index:2; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.06em; background:#C79A46; color:#16281F; padding:3px 7px; border-radius:4px; font-weight:700;}
        .photo-slot .meta{position:absolute; top:12px; right:12px; z-index:2; font-family:'IBM Plex Mono',monospace; font-size:10px; background:rgba(22,40,31,0.6); color:var(--cream,#F6F1E4); padding:5px 9px; border-radius:5px;}
        .photo-slot.is-sold{cursor:default; opacity:.75;}
        .photo-slot.is-sold img{filter:grayscale(.55) brightness(.8);}
        .photo-slot.is-reserved{cursor:default; opacity:.85;}
        .photo-slot.is-reserved img{filter:grayscale(.25) brightness(.9);}
        .sold-ribbon{position:absolute; z-index:3; top:20px; right:-36px; transform:rotate(40deg); background:var(--red-600,#A6402F); color:var(--cream,#F6F1E4); font-family:'IBM Plex Mono',monospace; font-size:10.5px; font-weight:600; letter-spacing:.04em; padding:5px 42px; box-shadow:0 2px 8px rgba(0,0,0,.25);}
        .photo-slot.is-placeholder{border-style:dashed; background:var(--cream,#F6F1E4);}
        .tile-pop{position:absolute; left:10px; right:10px; top:50%; transform:translateY(-46%) scale(0.98); z-index:4; background:rgba(255,255,255,0.98); border:1px solid var(--line,#E4DCC7); border-radius:10px; padding:14px; box-shadow:0 12px 28px rgba(22,40,31,0.18); opacity:0; pointer-events:none; transition:opacity .22s ease, transform .22s ease; backdrop-filter:blur(6px);}
        .photo-slot:hover .tile-pop{opacity:1; transform:translateY(-50%) scale(1); pointer-events:auto;}
        .tile-pop h4{font-family:'Fraunces',serif; font-size:14px; color:#16281F; line-height:1.2; margin:0;}
        .tile-pop .pop-loc{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; color:#C79A46; margin-top:3px; text-transform:uppercase;}
        .tile-pop .pop-meta{font-family:'IBM Plex Mono',monospace; font-size:11px; color:#6B6656; margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;}
        .tile-pop .pop-meta span{background:#F6F1E4; border:1px solid #E4DCC7; padding:3px 7px; border-radius:999px;}
        .tile-pop .pop-note{font-family:'Public Sans',sans-serif; font-size:11.5px; line-height:1.5; color:#6B6656; margin-top:8px; border-top:1px solid #E4DCC7; padding-top:8px;}
        .tile-pop .pop-cta{margin-top:10px; font-family:'IBM Plex Mono',monospace; font-size:11px; color:#16281F; font-weight:700; display:flex; align-items:center; gap:6px;}
        .estate-section{margin-bottom:40px;}
        .estate-section-head{margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--line,#E4DCC7);}
        .estate-section-head h3{font-family:'Fraunces',serif; font-size:20px; color:#16281F; margin-top:6px;}
        @media (max-width:900px){ .gallery-grid{grid-template-columns:repeat(2,1fr);} }
        @media (max-width:600px){ .gallery-grid{grid-template-columns:1fr;} .tile-pop{left:8px; right:8px; padding:12px;} }
      `}</style>

      {estates.map((key) => {
        const plots = grouped[key];
        const baseEstate = key.split(" — ")[0];
        const info = BELGROVE_ESTATE_INFO[baseEstate];
        const sizes = [...new Set(plots.map((p) => p.size))].sort((a, b) => a - b);
        const prices = plots.map((p) => p.price).filter((v): v is number => typeof v === "number");
        const isPreSaleGroup = key.includes("Phase 2");
        const basePriceLabel = prices.length ? `${formatNaira(Math.min(...prices))} – ${formatNaira(Math.max(...prices))}` : "Price on request";
        const priceLabel = basePriceLabel + (isPreSaleGroup ? " • Pre-Sale" : "");
        const sizeLabel = sizes.length === 1 ? `${sizes[0]}sqm` : sizes.length === 2 ? `${sizes[0]}, ${sizes[1]}sqm` : `${Math.min(...sizes)}–${Math.max(...sizes)}sqm`;
        return (
          <div key={key} className="estate-section">
            <div className="estate-section-head">
              <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">{key.toUpperCase()} — {plots[0].location}{isPreSaleGroup && " • PRE-SALE"}</div>
              <h3>{key}{isPreSaleGroup && <span className="ml-2 mono text-[10px] bg-[#C79A46] text-[#16281F] px-2 py-1 rounded align-middle">PRE-SALE</span>}</h3>
              {info?.tagline && <div className="public text-[13px] text-[#6B6656] mt-1">{info.tagline}</div>}
              {info && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {info.features.slice(0, 8).map((f) => (
                    <span key={f} className="text-[11px] text-[#D4B368] border border-[rgba(212,179,104,0.35)] px-2.5 py-1 rounded-full bg-[#16281F]">
                      {f}
                    </span>
                  ))}
                </div>
              )}
              <div className="mono text-[11px] text-[#8B6B4E] mt-2">{plots.length} unit{plots.length > 1 ? "s" : ""} • {sizeLabel} • {priceLabel}</div>
              <div className="public text-[12px] leading-[1.5] text-[#6B6656] mt-2 border-l-2 border-[#C79A46] pl-3">
                <span className="font-semibold text-[#16281F]">FCTA Approved:</span> Prototype you see {plots.length > 1 ? "are" : "is"} the FCTA-approved building prototype for {key} — located at {plots[0].location}, {sizeLabel} from {basePriceLabel}{isPreSaleGroup ? " (Pre-Sale offers)" : ""}. Verified land, what you see is what is approved to build.
              </div>
            </div>
            <div className="gallery-grid">
              {plots.map((p) => {
                const isSold = p.status === "sold";
                const isReserved = p.status === "reserved";
                const isNotAvailable = isSold || isReserved;
                const isPreSale = p.estate === "Sunrise Estate" && p.phase === "Phase 2";
                const phaseSuffix = p.phase ? ` — ${p.phase}` : "";
                const title = p.unitType || p.estate + phaseSuffix;
                const sub = p.unitType ? `${p.estate}${phaseSuffix} — ${p.location}` : p.location + (phaseSuffix ? ` (${p.phase})` : "");
                const priceLine = p.price ? formatNaira(p.price) + (isPreSale ? " • Pre-Sale" : "") : "";
                const href = `/book-inspection?estate=${encodeURIComponent(p.estate)}&size=${encodeURIComponent(String(p.size))}&code=${encodeURIComponent(p.code)}${p.phase ? `&phase=${encodeURIComponent(p.phase)}` : ""}${p.unitType ? `&unit=${encodeURIComponent(p.unitType)}` : ""}${p.price ? `&price=${encodeURIComponent(String(p.price))}` : ""}`;
                const inner = (
                  <>
                    {p.image ? (
                      <img src={`/${p.image.replace(/^\//, "")}`} alt={title} loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    ) : (
                      <span className="plus" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 38, height: 38, borderRadius: "50%", border: "1.5px solid var(--ink-muted,#6B6656)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "var(--ink-muted,#6B6656)", background: "var(--cream,#F6F1E4)" }}>
                        +
                      </span>
                    )}
                    <span className="badge">{p.code} · {p.status.toUpperCase()}</span>
                    <span className="meta">{p.size}sqm</span>
                    {isPreSale && <span className="pre-badge">PRE-SALE</span>}
                    {isSold && <span className="sold-ribbon">SOLD OUT</span>}
                    {isReserved && <span className="sold-ribbon" style={{ background: "var(--amber-600,#B98A2E)" }}>RESERVED</span>}
                    <span className="cap">
                      <span className="cap-title">{title}</span>
                      <span className="cap-sub">
                        {sub}
                        {priceLine ? ` · ${priceLine}` : ""}
                      </span>
                    </span>
                    <div className="tile-pop">
                      <h4>{title}</h4>
                      <div className="pop-loc">{p.estate} • {p.location}{p.phase ? ` • ${p.phase}` : ""}</div>
                      <div className="pop-meta">
                        <span>{p.size}sqm</span>
                        {p.price && <span>{formatNaira(p.price)}{isPreSale ? " • Pre-Sale" : ""}</span>}
                        <span>{p.status}</span>
                        <span>{p.code}</span>
                      </div>
                      <div className="pop-note">
                        <span style={{ fontWeight: 600, color: "#16281F" }}>FCTA Approved:</span> Prototype you see is the FCTA-approved building prototype for {p.estate}
                        {p.phase ? ` ${p.phase}` : ""} — {p.location}. Verified land at {p.size}sqm.
                      </div>
                      <div className="pop-cta">Want to know more? Book an inspection →</div>
                    </div>
                  </>
                );

                return isNotAvailable ? (
                  <div key={p.id} className={`photo-slot ${isSold ? "is-sold" : "is-reserved"}`}>
                    {inner}
                  </div>
                ) : (
                  <Link key={p.id} href={href} className="photo-slot">
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
