"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SITE_ESTATES } from "@/lib/site";

export default function VisitForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [estate, setEstate] = useState(SITE_ESTATES[1].name);
  const [date, setDate] = useState("");

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const p = new URLSearchParams();
    if (estate) p.set("estate", estate);
    if (name.trim()) p.set("name", name.trim());
    if (phone.trim()) p.set("phone", phone.trim());
    if (date) p.set("date", date);
    router.push(`/book-inspection?${p.toString()}`);
  }

  const field =
    "mt-1 w-full bg-[#F6EEE3] border border-[#E4D8C1] rounded-[10px] px-3.5 h-[52px] public text-[15px] focus:outline-none focus:border-[#C49A3A]";
  const label = "mono text-[12px] tracking-[0.14em] uppercase text-[#5B5346]";

  return (
    <form onSubmit={submit} className="bg-white rounded-[14px] p-6 lg:p-8 shadow-[0_24px_60px_rgba(18,41,31,0.18)]" aria-label="Request a visit">
      <h3 className="fraunces text-[22px]">Request a visit</h3>
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <label className="block">
          <span className={label}>Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your full name" className={field} autoComplete="name" />
        </label>
        <label className="block">
          <span className={label}>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="080..." className={field} autoComplete="tel" />
        </label>
        <label className="block">
          <span className={label}>Estate</span>
          <select value={estate} onChange={(e) => setEstate(e.target.value)} className={field}>
            {SITE_ESTATES.map((e) => (
              <option key={e.name} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Preferred date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={field} />
        </label>
      </div>
      <button
        type="submit"
        className="public w-full mt-5 bg-[#12291F] text-white rounded-[10px] h-[52px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors"
      >
        Book inspection
      </button>
      <div className="text-center mt-4">
        <a
          href="https://wa.me/2348103760063?text=Hello%20Belgrove%2C%20I%20want%20to%20book%20an%20inspection"
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[12px] tracking-[0.14em] uppercase text-[#5B5346] underline decoration-[#C49A3A] decoration-2 underline-offset-4 hover:text-[#12291F]"
        >
          Or chat on WhatsApp
        </a>
      </div>
    </form>
  );
}
