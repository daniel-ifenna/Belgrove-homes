"use client";
import { useEffect } from "react";

export default function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1F3328]/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#F7F2E7] rounded-[8px] w-full max-w-[440px] p-6 lg:p-7 shadow-[0_24px_48px_rgba(15,26,18,0.24)] border border-[#E0D5BB]">
        <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full bg-white border border-[#E0D5BB] text-[#1F3328] hover:bg-[#1F3328] hover:text-white transition-colors" aria-label="Close">✕</button>
        <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Get in touch</div>
        <h3 className="fraunces text-[22px] leading-[1.1] text-[#1F3328] mt-2">How would you like to reach us?</h3>
        <p className="public text-[13px] leading-[1.6] text-[#8B5E3C] mt-2">Choose email for detailed enquiries or WhatsApp for quick chat. We reply the same day.</p>

        <div className="grid gap-3 mt-6">
          <button
            type="button"
            onClick={() => {
              window.location.href = "mailto:info@belgrovehomes.com?subject=Enquiry%20from%20Belgrove%20Website";
            }}
            className="w-full text-left flex items-center gap-4 bg-white border border-[#E0D5BB] rounded-[6px] p-4 hover:border-[#C79A46] hover:shadow-[0_8px_16px_rgba(31,51,40,0.08)] transition-all group"
          >
            <span className="h-10 w-10 rounded-full bg-[#1F3328] text-white grid place-items-center shrink-0 group-hover:bg-[#C79A46] group-hover:text-[#1F3328] transition-colors">✉</span>
            <span className="flex-1 min-w-0">
              <span className="public block text-[13px] font-semibold text-[#1F3328]">Send us an email</span>
              <span className="mono block text-[12px] text-[#8B5E3C] truncate">info@belgrovehomes.com</span>
            </span>
            <span className="mono text-[11px] text-[#C79A46] shrink-0">→</span>
          </button>

          <a
            href="https://wa.me/2348103760063?text=Hello%20Belgrove%20Homes%2C%20I%20would%20like%20to%20enquire%20about%20your%20properties."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-[#1F3328] rounded-[6px] p-4 hover:bg-black transition-colors group"
          >
            <span className="h-10 w-10 rounded-full bg-[#25D366] text-white grid place-items-center shrink-0">◉</span>
            <span className="flex-1 min-w-0">
              <span className="public block text-[13px] font-semibold text-white">Chat on WhatsApp</span>
              <span className="mono block text-[12px] text-[#B9C7BB]">+234 810 376 0063</span>
            </span>
            <span className="mono text-[11px] text-white/70 group-hover:text-white shrink-0">→</span>
          </a>
        </div>

        <div className="mono text-[10px] leading-[1.6] text-[#8B5E3C] mt-4 text-center">Suite 25, Lebrex Plaza, 47 Ajose Adeogun Street, Utako, Abuja</div>
      </div>
    </div>
  );
}
