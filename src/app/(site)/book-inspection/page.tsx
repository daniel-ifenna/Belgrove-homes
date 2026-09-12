import { Suspense } from "react";
import BookingForm from "./BookingForm";

export default function BookInspectionPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F7F2E7]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet" />
      <style>{`.fraunces{font-family:Fraunces,serif} .mono{font-family:IBM Plex Mono,monospace} .public{font-family:Public Sans,sans-serif}`}</style>

      <div className="grid lg:grid-cols-[0.92fr_1.08fr] min-h-[calc(100vh-64px)]">
        {/* Left vertical split, high quality */}
        <div className="relative min-h-[420px] lg:min-h-full overflow-hidden bg-[#0F1A12]">
          <img src="/belgrove-inspection-team.jpg" alt="Belgrove team WhatsApp Image 2026-09-06" className="absolute inset-0 w-full h-full object-cover" loading="eager" decoding="async" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,26,18,0.16) 0%, rgba(15,26,18,0.14) 45%, rgba(15,26,18,0.68) 100%)" }} />
          <div className="absolute left-6 right-6 bottom-6 lg:left-8 lg:right-8 lg:bottom-8">
            <div className="inline-flex mono text-[10px] tracking-[0.16em] uppercase bg-[#C79A46] text-[#1F3328] px-2.5 py-1 rounded-[2px] font-medium">No Rent Campaign</div>
            <h1 className="fraunces text-white leading-[0.94] mt-3" style={{ fontSize: "clamp(28px, 3vw, 34px)", textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}>
              Belgrove Helps You<br />Never Pay Rent Again.
            </h1>
            <p className="public text-white/90 text-[13px] leading-[1.6] mt-3 max-w-[36ch]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
              Tired of rent receipts that build your landlord’s wealth, not yours? The No Rent Campaign turns tenants into owners. Own ground that grows, build when ready, and never pay rent again.
            </p>
            <div className="flex items-center gap-2 mt-4 mono text-[11px] text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C79A46]" /> Own, Don’t Rent · Verified · Titled
            </div>
          </div>
        </div>

        {/* Right form */}
        <div className="bg-[#F7F2E7] flex flex-col justify-center px-6 lg:px-12 py-10 lg:py-12">
          <div className="max-w-[520px] w-full mx-auto">
            <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Book Inspection No Rent Campaign</span>
            <h2 className="fraunces text-[28px] leading-[1.05] text-[#1F3328] mt-2">Schedule a property inspection</h2>
            <p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-3">
              Tell us where and when you’d like to visit, and we’ll confirm by email from <span className="font-medium text-[#1F3328]">info@belgrovehomes.com</span> with your tracking reference. Your ground awaits rent free.
            </p>
            <div className="mt-8">
              <Suspense fallback={<div className="bg-white border border-stone-200 rounded-lg p-8 text-center mono text-sm text-stone-400">Loading form…</div>}>
                <BookingForm />
              </Suspense>
            </div>
            <p className="mono text-[10px] tracking-[0.06em] text-[#8B5E3C] mt-6 text-center">Verified · No hidden fees · Named adviser · Stop renting, start owning</p>
          </div>
        </div>
      </div>
    </div>
  );
}
