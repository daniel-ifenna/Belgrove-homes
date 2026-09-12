"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ContactModal from "./ContactModal";

const links = [
  { href: "/gallery", label: "GALLERY" },
  { href: "/#vision", label: "VISION" },
  { href: "/#about", label: "ABOUT" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <header className="absolute top-0 inset-x-0 z-30 flex justify-center pt-3 px-4">
        <nav className="w-full max-w-[860px] bg-white rounded-[6px] shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex items-center justify-between px-4 lg:px-6 py-2.5">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="font-serif text-[15px] tracking-[-0.02em] text-[#1F3328] font-semibold">Belgrove <span className="text-[#C79A46]">Homes</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`mono text-[11px] tracking-[0.08em] ${pathname === l.href ? "text-[#C79A46] border-b-2 border-[#C79A46] pb-1" : "text-[#6B7A6F] hover:text-[#1F3328]"}`}
              >
                {l.label}
              </Link>
            ))}
            <button onClick={() => setContactOpen(true)} className="mono text-[11px] tracking-[0.08em] text-[#6B7A6F] hover:text-[#1F3328]">GET IN TOUCH</button>
          </div>
          <Link href="/book-inspection" className="hidden md:inline-flex mono text-[11px] tracking-[0.08em] bg-[#C79A46] text-[#1F3328] px-5 py-2.5 rounded-[4px] hover:bg-[#E4C892] transition-colors shrink-0 font-medium">
            BOOK INSPECTION
          </Link>
          <button className="md:hidden h-8 w-8 grid place-items-center" onClick={() => setOpen(!open)} aria-label="Menu">
            <span className="block w-5 h-0.5 bg-[#1F3328] mb-1" /><span className="block w-5 h-0.5 bg-[#1F3328] mb-1" /><span className="block w-5 h-0.5 bg-[#1F3328]" />
          </button>
        </nav>
        {open && (
          <div className="absolute top-[58px] inset-x-4 bg-white rounded-[6px] shadow-lg p-4 flex flex-col gap-3 md:hidden">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="public text-[13px] text-[#1F3328]" onClick={() => setOpen(false)}>{l.label}</Link>
            ))}
            <button className="mono text-[11px] text-[#1F3328] px-4 py-2 text-left" onClick={() => { setOpen(false); setContactOpen(true); }}>GET IN TOUCH</button>
            <Link href="/book-inspection" className="mono text-[11px] bg-[#C79A46] text-[#1F3328] px-4 py-3 rounded-[4px] text-center font-medium" onClick={() => setOpen(false)}>BOOK INSPECTION</Link>
          </div>
        )}
        <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E0D5BB]">
      <nav className="max-w-[1280px] mx-auto flex items-center justify-between px-6 lg:px-8 h-[64px]">
        <Link href="/" className="font-serif text-[17px] tracking-[-0.02em] text-[#1F3328] font-semibold">Belgrove <span className="text-[#C79A46]">Homes</span></Link>
        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="mono text-[11px] tracking-[0.08em] text-[#8B5E3C] hover:text-[#1F3328]">{l.label}</Link>
          ))}
          <button onClick={() => setContactOpen(true)} className="mono text-[11px] tracking-[0.08em] text-[#8B5E3C] hover:text-[#1F3328]">GET IN TOUCH</button>
          <Link href="/book-inspection" className="mono text-[11px] tracking-[0.08em] bg-[#C79A46] text-[#1F3328] px-5 py-2 rounded-[2px] hover:bg-[#E4C892] transition-colors font-medium">BOOK INSPECTION</Link>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? "✕" : "☰"}</button>
      </nav>
      {open && (
        <div className="md:hidden border-t border-[#E0D5BB] bg-white px-6 py-4 flex flex-col gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="public text-[13px]" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <button className="public text-[13px] text-left" onClick={() => { setOpen(false); setContactOpen(true); }}>GET IN TOUCH</button>
          <Link href="/book-inspection" className="mono text-[11px] bg-[#C79A46] text-[#1F3328] px-4 py-3 rounded-[4px] text-center font-medium" onClick={() => setOpen(false)}>BOOK INSPECTION</Link>
        </div>
      )}
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </header>
  );
}
