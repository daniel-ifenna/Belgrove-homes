import Link from "next/link";
import { SITE_CONTACT } from "@/lib/site";

export default function Footer() {
  return (
    <footer id="contact" className="text-[#F5EFE2] scroll-mt-20" style={{ background: "#0E2019" }}>
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-12 lg:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-[20px] tracking-[-0.02em] text-[#F5EFE2] font-semibold">Belgrove</span>
              <span className="font-serif text-[20px] tracking-[-0.02em] text-[#C89B3C] font-semibold">Homes</span>
            </div>
            <p className="public text-[13px] leading-[1.6] text-[#B9C4B8] mt-3">Verified land in Abuja.</p>
            <p className="mono text-[11px] tracking-[0.1em] uppercase text-[#B9C4B8]/80 mt-2">
              Belgrove Homes and Properties Limited
              {SITE_CONTACT.rcNumber ? ` · RC ${SITE_CONTACT.rcNumber}` : ""}
            </p>
          </div>
          <nav aria-label="Estates">
            <h4 className="mono text-[12px] tracking-[0.14em] uppercase text-[#D9B25C]">Estates</h4>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/estates/aurum-residence" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">Aurum Residence</Link></li>
              <li><Link href="/estates/belgrove-peninsula" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">Belgrove Peninsula</Link></li>
              <li><Link href="/estates/sunrise-estate" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">Sunrise Estate</Link></li>
              <li><Link href="/estates/starlight-estate" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">Starlight Estate</Link></li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <h4 className="mono text-[12px] tracking-[0.14em] uppercase text-[#D9B25C]">Company</h4>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/about" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">About</Link></li>
              <li><Link href="/about#leadership" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">Leadership</Link></li>
              <li><Link href="/blog" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">Guides</Link></li>
              <li><Link href="/faq" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">FAQ</Link></li>
            </ul>
          </nav>
          <div>
            <h4 className="mono text-[12px] tracking-[0.14em] uppercase text-[#D9B25C]">Contact</h4>
            <div className="mt-4 space-y-2">
              {SITE_CONTACT.phones.map((p) => (
                <p key={p} className="public text-[13px] leading-[1.5] text-[#B9C4B8]">
                  <a href={`tel:${p.replace(/\s/g, "")}`} className="hover:text-[#F5EFE2] transition-colors">{p}</a>
                </p>
              ))}
              <p className="public text-[13px] leading-[1.5] text-[#B9C4B8]">
                <a href={`mailto:${SITE_CONTACT.email}`} className="hover:text-[#F5EFE2] transition-colors">{SITE_CONTACT.email}</a>
              </p>
              <p className="public text-[13px] leading-[1.5] text-[#B9C4B8]">{SITE_CONTACT.address}</p>
            </div>
            <h4 className="mono text-[12px] tracking-[0.14em] uppercase text-[#D9B25C] mt-6">Follow</h4>
            <div className="mt-3 flex gap-5">
              <a href="https://www.instagram.com/belgrove_homes?stkn=MTdjZWgyeW9jMWY3Nw==" target="_blank" rel="noopener noreferrer" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">Instagram</a>
              <a href="https://www.tiktok.com/@belgrove.homes?_r=1&_t=ZS-99fISorFEkD" target="_blank" rel="noopener noreferrer" className="public text-[13px] text-[#B9C4B8] hover:text-[#F5EFE2] transition-colors inline-block py-1.5">TikTok</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[rgba(245,239,226,0.15)] flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="public text-[12px] text-[#B9C4B8]/70">© 2026 Belgrove Homes and Properties Limited.</p>
          <p className="public text-[12px] text-[#B9C4B8]/70">Images marked &lsquo;Artist&rsquo;s impression&rsquo; are illustrative.</p>
        </div>
      </div>
    </footer>
  );
}
