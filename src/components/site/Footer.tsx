import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#16281D] text-[#F5EFE2] mt-0">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-12 lg:py-14">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-[20px] tracking-[-0.02em] text-[#F5EFE2] font-semibold">Belgrove</span>
              <span className="font-serif text-[20px] tracking-[-0.02em] text-[#C89B3C] font-semibold">Homes</span>
            </div>
            <p className="public text-[13px] leading-[1.6] text-[#B9C4B8] mt-3">Belgrove Homes and Properties Limited · Abuja</p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
            <Link href="/#estates" className="mono text-[12px] tracking-[0.12em] uppercase text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">Estates</Link>
            <Link href="/gallery" className="mono text-[12px] tracking-[0.12em] uppercase text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">Gallery</Link>
            <Link href="/about" className="mono text-[12px] tracking-[0.12em] uppercase text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">About</Link>
            <Link href="/faq" className="mono text-[12px] tracking-[0.12em] uppercase text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">FAQ</Link>
            <a href="#contact" className="mono text-[12px] tracking-[0.12em] uppercase text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">Contact</a>
          </nav>
          <div id="contact">
            <p className="public text-[13px] leading-[1.7] text-[#B9C4B8]">
              <a href="tel:+2348103760063" className="hover:text-[#F5EFE2] transition-colors">+234 810 376 0063</a>
              {" · "}
              <a href="mailto:info@belgrovehomes.com" className="hover:text-[#F5EFE2] transition-colors">info@belgrovehomes.com</a>
            </p>
            <p className="public text-[13px] leading-[1.7] text-[#B9C4B8] mt-1">Ste 25, Lebrex Plaza, 47 Ajose Adeogun St, Utako, Abuja</p>
            <div className="mt-3 flex gap-5">
              <a href="https://www.instagram.com/belgrove_homes?stkn=MTdjZWgyeW9jMWY3Nw==" target="_blank" rel="noopener noreferrer" className="mono text-[12px] tracking-[0.12em] uppercase text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">Instagram</a>
              <a href="https://www.tiktok.com/@belgrove.homes?_r=1&_t=ZS-99fISorFEkD" target="_blank" rel="noopener noreferrer" className="mono text-[12px] tracking-[0.12em] uppercase text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">TikTok</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[rgba(245,239,226,0.15)]">
          <p className="public text-[12px] leading-[1.6] text-[#B9C4B8]/70">Images marked &lsquo;Artist&rsquo;s impression&rsquo; are illustrative. © {new Date().getFullYear()} Belgrove Homes &amp; Properties Limited.</p>
        </div>
      </div>
    </footer>
  );
}
