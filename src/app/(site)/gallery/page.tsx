import { Suspense } from "react";
import GalleryGrid from "./GalleryGrid";

export default function GalleryPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 py-12">
        <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">GALLERY — VERIFIED LAND, CURRENTLY AVAILABLE</div>
        <h1 className="fraunces text-[30px] leading-[1.05] text-[#16281F] mt-2">
          Every plot here has passed <em style={{ fontStyle: "italic", color: "var(--ink-muted,#6B6656)" }}>our verification standard</em>
        </h1>
        <p className="public text-[14px] leading-[1.6] text-[#6B6656] max-w-[68ch] mt-3">
          All properties listed by estate name. Filter by status or click a unit to book a site inspection. Nothing appears here until it&apos;s been walked, titled, and checked.
        </p>
        <div className="mt-8">
          <Suspense fallback={<div className="public text-[13px] text-[#8B6B4E]">Loading gallery…</div>}>
            <GalleryGrid />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
