"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import ContactModal from "./ContactModal";

const links = [
  { href: "/gallery", label: "GALLERY" },
  { href: "/about", label: "ABOUT" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const logo = (
    <Link href="/" className="flex items-center gap-0 shrink-0">
      <span className="font-serif text-[16px] tracking-[-0.02em] text-[#16281D] font-semibold">Belgrove</span>
      <span className="font-serif text-[16px] tracking-[-0.02em] text-[#C89B3C] font-semibold ml-1">Homes</span>
    </Link>
  );

  if (isHome) {
    return (
      <header className={`fixed top-0 inset-x-0 z-30 flex justify-center px-4 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${scrolled ? "bg-[rgba(247,239,226,0.92)] backdrop-blur-md border-b border-[#E4D8C1] shadow-[0_4px_16px_rgba(22,40,29,0.08)] pt-2 pb-2" : "bg-transparent border-transparent pt-4"}` }>
        <nav className={`w-full max-w-[1160px] bg-white rounded-[8px] flex items-center justify-between px-5 lg:px-7 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${scrolled ? "shadow-[0_4px_16px_rgba(22,40,29,0.08)] py-2.5" : "shadow-[0_8px_28px_rgba(22,40,29,0.16)] py-3"}`}>
          {logo}
          <div className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`mono text-[12px] tracking-[0.08em] uppercase ${pathname === l.href ? "text-[#C89B3C]" : "text-[#5B5346] hover:text-[#16281D]"} transition-colors`}
              >
                {l.label}
              </Link>
            ))}
            <button onClick={() => setContactOpen(true)} className="mono text-[12px] tracking-[0.08em] uppercase text-[#5B5346] hover:text-[#16281D] transition-colors">
              GET IN TOUCH
            </button>
          </div>
          <Link href="/book-inspection" className="hidden md:inline-flex mono text-[12px] tracking-[0.08em] uppercase bg-[#C89B3C] text-[#16281D] px-7 py-2.5 rounded-[6px] hover:bg-[#E8C77A] transition-colors font-medium">
            BOOK INSPECTION
          </Link>
          <button className="md:hidden h-8 w-8 grid place-items-center" onClick={() => setOpen(!open)} aria-label="Menu">
            <span className="block w-5 h-0.5 bg-[#16281D] mb-1" /><span className="block w-5 h-0.5 bg-[#16281D] mb-1" /><span className="block w-5 h-0.5 bg-[#16281D]" />
          </button>
        </nav>
        {open && (
          <div className="absolute top-[62px] inset-x-4 bg-white rounded-[8px] shadow-lg p-4 flex flex-col gap-3 md:hidden border border-[#E4D8C1]">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="public text-[13px] text-[#1C2B20]" onClick={() => setOpen(false)}>{l.label}</Link>
            ))}
            <button className="mono text-[12px] uppercase text-[#1C2B20] px-0 py-2 text-left tracking-[0.08em]" onClick={() => { setOpen(false); setContactOpen(true); }}>GET IN TOUCH</button>
            <Link href="/book-inspection" className="mono text-[12px] uppercase tracking-[0.08em] bg-[#C89B3C] text-[#16281D] px-4 py-3 rounded-[6px] text-center font-medium" onClick={() => setOpen(false)}>BOOK INSPECTION</Link>
          </div>
        )}
        <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      </header>
    );
  }

  return (
    <header className={`sticky top-0 z-40 bg-[var(--bg-cream)] border-b transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${scrolled ? "border-[#E4D8C1] shadow-[0_4px_16px_rgba(22,40,29,0.08)]" : "border-[var(--border-hairline)]"}` }>
      <nav className={`max-w-[1280px] mx-auto flex items-center justify-between px-6 lg:px-8 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${scrolled ? "h-[60px]" : "h-[68px]"}`}>
        {logo}
        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`mono text-[12px] tracking-[0.08em] uppercase ${pathname === l.href ? "text-[#C89B3C]" : "text-[#5B5346] hover:text-[#1C2B20]"} transition-colors`}>{l.label}</Link>
          ))}
          <button onClick={() => setContactOpen(true)} className="mono text-[12px] tracking-[0.08em] uppercase text-[#5B5346] hover:text-[#1C2B20] transition-colors">GET IN TOUCH</button>
          <Link href="/book-inspection" className="mono text-[12px] tracking-[0.08em] uppercase bg-[#16281D] text-[#F5EFE2] px-7 py-2.5 rounded-[6px] hover:bg-[#1B2E23] transition-colors font-medium">BOOK INSPECTION</Link>
        </div>
        <button className="md:hidden h-8 w-8 grid place-items-center text-[#16281D]" onClick={() => setOpen(!open)} aria-label="Menu">{open ? "✕" : "☰"}</button>
      </nav>
      {open && (
        <div className="md:hidden border-t border-[var(--border-hairline)] bg-white px-6 py-4 flex flex-col gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="public text-[13px] text-[#1C2B20]" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <button className="public text-[13px] text-left text-[#1C2B20]" onClick={() => { setOpen(false); setContactOpen(true); }}>GET IN TOUCH</button>
          <Link href="/book-inspection" className="mono text-[12px] uppercase tracking-[0.08em] bg-[#16281D] text-[#F5EFE2] px-4 py-3 rounded-[6px] text-center font-medium" onClick={() => setOpen(false)}>BOOK INSPECTION</Link>
        </div>
      )}
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </header>
  );
}
