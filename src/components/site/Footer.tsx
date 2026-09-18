import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#16281D] text-[#F5EFE2] mt-0">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-12 lg:py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-[20px] tracking-[-0.02em] text-[#F5EFE2] font-semibold">Belgrove</span>
              <span className="font-serif text-[20px] tracking-[-0.02em] text-[#C89B3C] font-semibold">Homes</span>
            </div>
            <p className="public text-[13px] leading-[1.6] text-[#B9C4B8] mt-3 max-w-[32ch]">Verified land. Honest pricing. A named adviser.</p>
            <p className="public text-[12px] leading-[1.6] text-[#B9C4B8]/70 mt-3 max-w-[32ch]">Headquartered in Abuja — FCTA approved. Building trust plot by plot since 2025.</p>
          </div>
          <div>
            <h4 className="mono text-[11px] tracking-[0.12em] uppercase text-[#E8C77A]">Contact</h4>
            <div className="mt-4 space-y-2">
              <p className="public text-[13px] leading-[1.5] text-[#B9C4B8]">Suite 25, Lebrex Plaza, 47 Ajose Adeogun Street, Utako, Abuja</p>
              <p className="public text-[13px] leading-none text-[#B9C4B8]"><a href="mailto:info@belgrovehomes.com" className="hover:text-[#F5EFE2] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8C77A] focus-visible:outline-offset-2">info@belgrovehomes.com</a></p>
              <p className="public text-[13px] leading-none text-[#B9C4B8]"><a href="tel:+2348103760063" className="hover:text-[#F5EFE2] transition-colors">+234 810 376 0063</a></p>
            </div>
          </div>
          <div>
            <h4 className="mono text-[11px] tracking-[0.12em] uppercase text-[#E8C77A]">Explore</h4>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/gallery" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">Gallery</Link></li>
              <li><Link href="/about" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">About</Link></li>
              <li><Link href="/book-inspection" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors">Book Inspection</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mono text-[11px] tracking-[0.12em] uppercase text-[#E8C77A]">Follow</h4>
            <div className="mt-4 flex gap-4">
              <a href="https://www.instagram.com/belgrove_homes?stkn=MTdjZWgyeW9jMWY3Nw==" target="_blank" rel="noopener noreferrer" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8C77A] focus-visible:outline-offset-2">Instagram</a>
              <a href="https://www.tiktok.com/@belgrove.homes?_r=1&_t=ZS-99fISorFEkD" target="_blank" rel="noopener noreferrer" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8C77A] focus-visible:outline-offset-2">TikTok</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[rgba(245,239,226,0.15)] text-center">
          <p className="mono text-[11px] tracking-[0.02em] text-[#B9C4B8]/60">© {new Date().getFullYear()} Belgrove Homes &amp; Properties Limited. All rights reserved.</p>
          <p className="public text-[11px] leading-[1.5] text-[#B9C4B8]/50 mt-1">Belgrove Homes &amp; Properties Limited is FCTA approved. Real estate carries risk; verify all documentation independently.</p>
        </div>
      </div>
    </footer>
  );
}
