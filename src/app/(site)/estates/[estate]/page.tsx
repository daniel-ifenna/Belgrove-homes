import { notFound } from "next/navigation";
import Link from "next/link";
import { BELGROVE_ESTATE_INFO } from "@/lib/belgroveData";
import { estateNameFromSlug, getPlotsForEstate } from "@/lib/estateSlug";
import { formatNaira, formatNairaRange } from "@/lib/currency";

export function generateStaticParams() {
  return [
    { estate: "aurum-residence" },
    { estate: "belgrove-peninsula" },
    { estate: "starlight-estate" },
    { estate: "sunrise-estate" },
  ];
}

export default async function EstateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ estate: string }>;
  searchParams: Promise<{ phase?: string }>;
}) {
  const { estate } = await params;
  const { phase } = await searchParams;
  const estateName = estateNameFromSlug(estate);
  if (!estateName) notFound();

  const allPlots = getPlotsForEstate(estateName);
  const plots = phase ? allPlots.filter((p) => p.phase === phase) : allPlots;
  if (!plots.length) notFound();

  const info = BELGROVE_ESTATE_INFO[estateName];
  const location = plots[0].location;
  const sizes = [...new Set(plots.map((p) => p.size))].sort((a, b) => a - b);
  const sizeRange = sizes.length === 1 ? `${sizes[0]}sqm` : `${Math.min(...sizes)}–${Math.max(...sizes)}sqm`;
  const prices = plots.map((p) => p.price).filter((v): v is number => typeof v === "number");
  const priceRange = prices.length ? formatNairaRange(Math.min(...prices), Math.max(...prices)) : "Price on request";
  const available = plots.filter((p) => p.status === "available").length;
  const isSunrise = estateName === "Sunrise Estate";

  const galleryImages = plots.map((p) => p.image).filter(Boolean) as string[];

  return (
    <div className="bg-white min-h-screen">


      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <div className="mono text-[11px] tracking-wide uppercase text-[#8B6B4E] flex items-center gap-2">
          <Link href="/gallery" className="hover:text-[#16281F]">Gallery</Link>
          <span className="text-[#E4DCC7]">/</span>
          <span className="text-[#16281F] font-medium normal-case tracking-normal">{estateName}</span>
          {phase && (
            <>
              <span className="text-[#E4DCC7]">/</span>
              <span className="text-[#16281F] font-medium normal-case tracking-normal">{phase}</span>
            </>
          )}
        </div>

        {/* Title */}
        <div className="mt-4">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">{location.toUpperCase()}</div>
          <h1 className="fraunces text-[30px] lg:text-[36px] leading-[1.05] text-[#16281F] mt-2">
            {estateName}
            {phase && <span className="ml-3 mono text-[11px] bg-[#C79A46] text-[#16281F] px-2 py-1 rounded align-middle tracking-wide uppercase">{phase}</span>}
          </h1>
          {info?.tagline && <p className="public text-[14px] text-[#6B6656] mt-2">{info.tagline}</p>}
          <div className="mono text-[12px] text-[#8B6B4E] mt-3">
            {plots.length} unit{plots.length > 1 ? "s" : ""} • {sizeRange} • <span className="price">{priceRange}</span> • {available} available
          </div>
        </div>

        {/* Gallery */}
        <div className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-[#F6F1E4] border border-[#E4DCC7]">
              {galleryImages[0] ? (
                <img src={`/${galleryImages[0].replace(/^\//, "")}`} alt={`${estateName} hero`} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center mono text-[12px] text-[#8B6B4E]">No image available</div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <div className="mono text-[11px] tracking-wide uppercase text-white/90">{estateName} • {location}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {galleryImages.slice(1, 5).map((img, i) => (
                <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#F6F1E4] border border-[#E4DCC7]">
                  <img src={`/${img.replace(/^\//, "")}`} alt={`${estateName} ${i + 2}`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
              {galleryImages.length < 5 &&
                Array.from({ length: 4 - (galleryImages.length - 1) }).map((_, i) => (
                  <div key={`ph-${i}`} className="aspect-[4/3] rounded-xl border border-dashed border-[#E4DCC7] bg-[#FBF8F0] grid place-items-center mono text-[11px] text-[#8B6B4E]">
                    More views on inspection
                  </div>
                ))}
            </div>
          </div>
          <p className="mono text-[11px] text-[#8B6B4E] mt-3">Photos show the FCTA-approved building prototype for {estateName}. Final finish may vary — walk the land to see boundaries pegged on site.</p>
        </div>

        {/* Two-col: details + specs */}
        <div className="mt-10 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
          <div className="space-y-6">
            <div className="bg-white border border-[#E4DCC7] rounded-xl p-6">
              <h2 className="fraunces text-[20px] text-[#16281F]">About this estate</h2>
              <p className="public text-[14px] leading-[1.65] text-[#6B6656] mt-3">
                {estateName} is located at {location}. This {phase ? `${phase} of ` : ""}estate offers verified, titled land in sizes from {sizeRange}, with documented ownership and surveyed boundaries. What you see in the gallery is the FCTA-approved prototype for this estate — the form the building takes when you develop.
              </p>
              <p className="public text-[14px] leading-[1.65] text-[#6B6656] mt-3">
                Every plot here has passed our 7-point verification — title, boundaries, access and documentation checked before listing. Bring your adviser or lawyer to inspection; we welcome it.
              </p>
              <div className="mt-6 grid sm:grid-cols-3 gap-4">
                <div className="rounded-lg bg-[#FBF8F0] border border-[#E4DCC7] p-4">
                  <div className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Size range</div>
                  <div className="fraunces text-[18px] text-[#16281F] mt-1">{sizeRange}</div>
                  <div className="public text-[12px] text-[#6B6656] mt-1">{sizes.length} size{sizes.length > 1 ? "s" : ""} option{sizes.length > 1 ? "s" : ""}</div>
                </div>
                <div className="rounded-lg bg-[#FBF8F0] border border-[#E4DCC7] p-4">
                  <div className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Price range</div>
                  <div className="fraunces text-[18px] text-[#16281F] mt-1">{priceRange}</div>
                  <div className="public text-[12px] text-[#6B6656] mt-1">{isSunrise && phase === "Phase 2" ? "Pre-Sale offers" : "Verified pricing"}</div>
                </div>
                <div className="rounded-lg bg-[#FBF8F0] border border-[#E4DCC7] p-4">
                  <div className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Location</div>
                  <div className="fraunces text-[15px] text-[#16281F] mt-1">{location}</div>
                  <div className="public text-[12px] text-[#6B6656] mt-1">Pegged & surveyed</div>
                </div>
              </div>
            </div>

            {/* Amenities — filtered to real characteristics, CTA copy removed */}
            {(() => {
              const raw = info?.features ?? [];
              const amenities = raw.filter((f) => !["FCTA Approved", "Secure Your Unit Today"].includes(f));
              const hasFcta = raw.includes("FCTA Approved");
              if (!amenities.length && !hasFcta) return null;
              return (
                <div className="bg-[#16281F] rounded-xl p-6">
                  {hasFcta && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="mono text-[10px] tracking-[0.12em] uppercase bg-[#D4B368] text-[#16281F] px-2.5 py-1 rounded-full font-bold">FCTA Approved</span>
                      <span className="mono text-[11px] text-[#D4B368]/80">Verified & titled</span>
                    </div>
                  )}
                  {amenities.length > 0 && (
                    <>
                      <h3 className="mono text-[11px] tracking-[0.14em] uppercase text-[#D4B368]">Amenities & Infrastructure</h3>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {amenities.map((f) => (
                          <span key={f} className="mono text-[12px] text-[#F5EFE2] border border-[#2A3F34] bg-white/5 px-3 py-1.5 rounded-full">
                            {f}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="public text-[12px] text-[#D4B368]/70 mt-4">Infrastructure status is confirmed at inspection. Ask your adviser for the current site plan and access update.</p>
                </div>
              );
            })()}

            {/* Plot/size selector */}
            <div className="bg-white border border-[#E4DCC7] rounded-xl p-6">
              <div className="flex items-center justify-between">
                <h3 className="fraunces text-[18px] text-[#16281F]">Available units & sizes</h3>
                <Link href="/gallery" className="mono text-[11px] text-[#6B6656] underline underline-offset-4">View full gallery</Link>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {plots.map((p) => (
                  <Link
                    key={p.id}
                    href={`/estates/${estate}/${p.id}`}
                    className="group relative rounded-xl border border-[#E4DCC7] overflow-hidden hover:border-[#C79A46] hover:shadow-[0_8px_20px_rgba(22,40,31,0.08)] transition-all bg-white"
                  >
                    <div className="relative aspect-[16/9] bg-[#FBF8F0] overflow-hidden">
                      {p.image ? (
                        <img src={`/${p.image.replace(/^\//, "")}`} alt={p.unitType ?? p.code} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" loading="lazy" />
                      ) : null}
                      <span className={`absolute top-2 left-2 mono text-[10px] px-2 py-1 rounded ${p.status === "available" ? "bg-[#16281F] text-[#D4B368]" : p.status === "sold" ? "bg-[#A6402F] text-white" : "bg-[#B98A2E] text-white"}`}>{p.status.toUpperCase()}</span>
                      <span className="absolute top-2 right-2 mono text-[10px] bg-white/90 border border-[#E4DCC7] px-2 py-1 rounded">{p.size}sqm</span>
                    </div>
                    <div className="p-3">
                      <div className="fraunces text-[14px] leading-[1.2] text-[#16281F] line-clamp-1">{p.unitType ?? p.estate}</div>
                      <div className="mono text-[11px] text-[#6B6656] mt-1 price">{p.price ? formatNaira(p.price) : "Price on request"}</div>
                      <div className="mono text-[11px] text-[#16281F] mt-2 font-medium group-hover:underline underline-offset-4">View details →</div>
                    </div>
                  </Link>
                ))}
              </div>
              {isSunrise && !phase && (
                <div className="mt-4 flex gap-2">
                  <Link href={`/estates/${estate}?phase=Phase%201`} className="mono text-[12px] border border-[#E4DCC7] rounded-full px-4 py-2 hover:border-[#C79A46]">Filter: Phase 1</Link>
                  <Link href={`/estates/${estate}?phase=Phase%202`} className="mono text-[12px] border border-[#E4DCC7] rounded-full px-4 py-2 hover:border-[#C79A46]">Filter: Phase 2 (Pre-Sale)</Link>
                </div>
              )}
            </div>
          </div>

          {/* Right rail */}
          <div className="space-y-4 lg:sticky lg:top-[112px]">
            <div className="bg-[#FBF8F0] border border-[#E4DCC7] rounded-xl p-6">
              <h3 className="fraunces text-[16px] text-[#16281F]">Book an inspection</h3>
              <p className="public text-[13px] leading-[1.6] text-[#6B6656] mt-2">See the land pegged and surveyed before you commit. Walk the plot with a named adviser — no booking fee, no pressure.</p>
              <Link
                href={`/book-inspection?estate=${encodeURIComponent(estateName)}${phase ? `&phase=${encodeURIComponent(phase)}` : ""}`}
                className="mt-4 flex items-center justify-center mono text-[13px] font-semibold bg-[#16281F] text-[#F5EFE2] px-6 py-3 rounded-[6px] hover:bg-[#1B2E23] transition-colors"
              >
                Book Inspection for {estateName} →
              </Link>
              <p className="mono text-[11px] text-[#8B6B4E] mt-3 text-center">Confirmation sent from <span className="text-[#16281F] font-medium">info@belgrovehomes.com</span></p>
              <div className="mt-4 pt-4 border-t border-[#E4DCC7] mono text-[11px] leading-[1.5] text-[#6B6656]">
                <div>WhatsApp: {info?.whatsapp ?? "+234 810 376 0063"}</div>
                <div>Instagram: {info?.instagram ?? "@belgrove_homes"}</div>
              </div>
            </div>

            <div className="bg-white border border-[#E4DCC7] rounded-xl p-6">
              <h4 className="mono text-[11px] tracking-[0.12em] uppercase text-[#8B6B4E]">Floor plan & specification</h4>
              <p className="public text-[13px] leading-[1.6] text-[#6B6656] mt-2">
                Floor plans are not currently published online. Detailed specifications and surveyed dimensions are shared directly by your adviser at inspection — no hidden documents are withheld, what you see here is the full information available.
              </p>
              <ul className="public text-[13px] leading-[1.6] text-[#6B6656] mt-3 list-disc pl-5 space-y-1">
                <li>Survey pegs and photographs on record</li>
                <li>Documented chain of ownership</li>
                <li>Use / planning status and access confirmed</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom CTA repeated */}
        <div className="mt-10 flex justify-center">
          <Link
            href={`/book-inspection?estate=${encodeURIComponent(estateName)}${phase ? `&phase=${encodeURIComponent(phase)}` : ""}`}
            className="mono text-[14px] font-semibold bg-[#C79A46] text-[#16281F] px-8 py-3 rounded-full hover:bg-[#D4B368] transition-colors"
          >
            Book Inspection — {estateName} →
          </Link>
        </div>
      </div>
    </div>
  );
}
