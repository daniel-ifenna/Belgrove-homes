import { notFound } from "next/navigation";
import Link from "next/link";
import { BELGROVE_ESTATE_INFO } from "@/lib/belgroveData";
import { estateNameFromSlug, getPlotBySlug } from "@/lib/estateSlug";
import { formatNaira } from "@/lib/currency";

export function generateStaticParams() {
  // generate for every plot
  const slugs = [
    { estate: "aurum-residence", plot: "aurum-200" },
    { estate: "aurum-residence", plot: "aurum-300" },
    { estate: "aurum-residence", plot: "aurum-400" },
    { estate: "belgrove-peninsula", plot: "peninsula-150" },
    { estate: "belgrove-peninsula", plot: "peninsula-250" },
    { estate: "belgrove-peninsula", plot: "peninsula-350" },
    { estate: "belgrove-peninsula", plot: "peninsula-500" },
    { estate: "belgrove-peninsula", plot: "peninsula-900" },
    { estate: "starlight-estate", plot: "starlight-150" },
    { estate: "starlight-estate", plot: "starlight-200" },
    { estate: "starlight-estate", plot: "starlight-350" },
    { estate: "starlight-estate", plot: "starlight-450" },
    { estate: "starlight-estate", plot: "starlight-750" },
  ];
  // sunrise phases
  for (const p of ["150","250","300","350","400","450","500","800"]) {
    slugs.push({ estate: "sunrise-estate", plot: `sunrise-p1-${p}` });
    slugs.push({ estate: "sunrise-estate", plot: `sunrise-p2-${p}` });
  }
  return slugs;
}

export default async function PlotDetailPage({
  params,
}: {
  params: Promise<{ estate: string; plot: string }>;
}) {
  const { estate, plot } = await params;
  const plotData = getPlotBySlug(estate, plot);
  if (!plotData) notFound();
  const estateName = estateNameFromSlug(estate)!;
  const info = BELGROVE_ESTATE_INFO[estateName];

  const prefill = `/book-inspection?estate=${encodeURIComponent(plotData.estate)}&size=${encodeURIComponent(String(plotData.size))}&code=${encodeURIComponent(plotData.code)}${plotData.phase ? `&phase=${encodeURIComponent(plotData.phase)}` : ""}${plotData.unitType ? `&unit=${encodeURIComponent(plotData.unitType)}` : ""}${plotData.price ? `&price=${encodeURIComponent(String(plotData.price))}` : ""}`;

  return (
    <div className="bg-white min-h-screen">


      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 py-10">
        <div className="mono text-[11px] tracking-wide uppercase text-[#8B6B4E] flex items-center gap-2">
          <Link href="/gallery" className="hover:text-[#16281F]">Gallery</Link>
          <span className="text-[#E4DCC7]">/</span>
          <Link href={`/estates/${estate}`} className="hover:text-[#16281F]">{estateName}</Link>
          <span className="text-[#E4DCC7]">/</span>
          <span className="text-[#16281F] font-medium normal-case tracking-normal">{plotData.code}</span>
        </div>

        <div className="mt-4 grid lg:grid-cols-[1.35fr_0.85fr] gap-8 items-start">
          <div>
            <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">{plotData.location.toUpperCase()}</div>
            <h1 className="fraunces text-[28px] lg:text-[32px] leading-[1.05] text-[#16281F] mt-2">{plotData.unitType ?? plotData.estate}</h1>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="mono text-[11px] border border-[#E4DCC7] bg-[#FBF8F0] px-2.5 py-1 rounded-full">{plotData.size} SQM</span>
              <span className={`mono text-[11px] px-2.5 py-1 rounded-full border ${plotData.status === "available" ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : plotData.status === "sold" ? "bg-[#A6402F] text-white border-[#A6402F]" : "bg-[#B98A2E] text-white border-[#B98A2E]"}`}>{plotData.status.toUpperCase()}</span>
              {plotData.phase && <span className="mono text-[11px] bg-[#C79A46] text-[#16281F] px-2.5 py-1 rounded-full font-bold">{plotData.phase}</span>}
            </div>

            <div className="mt-6 relative aspect-[16/10] rounded-xl overflow-hidden bg-[#F6F1E4] border border-[#E4DCC7]">
              {plotData.image ? (
                <img src={`/${plotData.image.replace(/^\//, "")}`} alt={plotData.unitType ?? plotData.code} className="absolute inset-0 w-full h-full object-cover" />
              ) : null}
            </div>
            <p className="mono text-[11px] text-[#8B6B4E] mt-2">Prototype view — the approved building prototype for this plot. Boundary pegs, survey and access confirmed at inspection.</p>

            <div className="mt-8 bg-white border border-[#E4DCC7] rounded-xl p-6">
              <h2 className="fraunces text-[18px] text-[#16281F]">Design & specification</h2>
              <div className="mt-3 grid sm:grid-cols-2 gap-4 public text-[13px] leading-[1.6] text-[#6B6656]">
                <div><span className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Property Type</span><div className="font-medium text-[#16281F] mt-1">{plotData.unitType ?? "—"}</div></div>
                <div><span className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Size</span><div className="font-medium text-[#16281F] mt-1">{plotData.size}sqm</div></div>
                <div><span className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Reference</span><div className="font-medium text-[#16281F] mt-1">{plotData.code}</div></div>
                <div><span className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Development</span><div className="font-medium text-[#16281F] mt-1">{plotData.estate}{plotData.phase ? ` — ${plotData.phase}` : ""}</div></div>
                <div><span className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Price</span><div className="font-medium text-[#16281F] mt-1 price">{plotData.price ? formatNaira(plotData.price) : "Price on request"}{plotData.estate === "Sunrise Estate" && plotData.phase === "Phase 2" ? " • Pre-Sale" : ""}</div></div>
                <div><span className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Location</span><div className="font-medium text-[#16281F] mt-1">{plotData.location}</div></div>
              </div>
              <p className="public text-[13px] leading-[1.6] text-[#6B6656] mt-4">This is the FCTA-approved building prototype for {plotData.estate}{plotData.phase ? ` ${plotData.phase}` : ""} at {plotData.size}sqm.</p>
            </div>

            {(() => {
              const raw = info?.features ?? [];
              const amenities = raw.filter((f) => !["FCTA Approved", "Secure Your Unit Today"].includes(f));
              const hasFcta = raw.includes("FCTA Approved");
              if (!amenities.length && !hasFcta) return null;
              return (
                <div className="mt-6 bg-[#16281F] rounded-xl p-6">
                  {hasFcta && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="mono text-[10px] tracking-[0.12em] uppercase bg-[#D4B368] text-[#16281F] px-2.5 py-1 rounded-full font-bold">FCTA Approved</span>
                      <span className="mono text-[11px] text-[#D4B368]/80">Verified & titled</span>
                    </div>
                  )}
                  {amenities.length > 0 && (
                    <>
                      <h3 className="mono text-[11px] tracking-[0.14em] uppercase text-[#D4B368]">Estate amenities</h3>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {amenities.map((f) => (
                          <span key={f} className="mono text-[12px] text-[#F5EFE2] border border-[#2A3F34] bg-white/5 px-3 py-1.5 rounded-full">{f}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
            <div className="mt-6 bg-white border border-[#E4DCC7] rounded-xl p-6">
              <h4 className="mono text-[11px] tracking-[0.12em] uppercase text-[#8B6B4E]">Floor plan & specification</h4>
              <p className="public text-[13px] leading-[1.6] text-[#6B6656] mt-2">Floor plans are not currently published online. Detailed specifications and surveyed dimensions are shared directly by your adviser at inspection — no hidden documents are withheld.</p>
            </div>
          </div>

          <div className="lg:sticky lg:top-[112px] space-y-4">
            <div className="bg-[#FBF8F0] border border-[#E4DCC7] rounded-xl p-6">
              <h3 className="fraunces text-[16px] text-[#16281F]">Inspect this plot</h3>
              <p className="public text-[13px] leading-[1.6] text-[#6B6656] mt-2">Walk the pegged boundaries with a named adviser. No gate before you see the property — this page is the full detail.</p>
              <Link href={prefill} className="mt-4 flex items-center justify-center mono text-[13px] font-semibold bg-[#16281F] text-[#F5EFE2] px-6 py-3 rounded-[6px] hover:bg-[#1B2E23] transition-colors">
                Book Inspection →
              </Link>
              <p className="mono text-[11px] text-[#8B6B4E] mt-3 text-center">Prefills this exact plot in the booking form</p>
            </div>

            <div className="bg-white border border-[#E4DCC7] rounded-xl p-6">
              <h4 className="mono text-[11px] tracking-[0.12em] uppercase text-[#8B6B4E]">What happens at inspection</h4>
              <ul className="public text-[13px] leading-[1.6] text-[#6B6656] mt-2 list-disc pl-5 space-y-1">
                <li>Meet your adviser at the estate gate</li>
                <li>Walk the pegged plot and see survey photos</li>
                <li>Review title and documentation in plain language</li>
                <li>Ask anything — we answer honestly, even “not this one”</li>
              </ul>
            </div>

            <Link href={`/estates/${estate}`} className="block mono text-[12px] text-[#6B6656] text-center underline underline-offset-4">← Back to {estateName} overview</Link>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Link href={prefill} className="mono text-[14px] font-semibold bg-[#C79A46] text-[#16281F] px-8 py-3 rounded-full hover:bg-[#D4B368] transition-colors">
            Book Inspection — {plotData.code} →
          </Link>
        </div>
      </div>
    </div>
  );
}
