"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchBar } from "@/components/site/home/Hero";
import EstatesGrid, { type EstateFilter } from "@/components/site/home/EstatesGrid";
import Reveal from "@/components/site/home/Reveal";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#7A5C17]">{children}</div>;
}

const EMPTY: EstateFilter = { estate: "any", size: "any", budget: "any" };

export default function EstatesSection() {
  const [filter, setFilter] = useState<EstateFilter>(EMPTY);

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <div className="-mt-[28px] lg:-mt-[64px] relative z-20">
          <SearchBar onFilter={(estate, size, budget) => setFilter({ estate, size, budget })} />
        </div>
      </div>

      <section id="estates" className="scroll-mt-20" style={{ background: "#F6EEE3" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 pt-[64px] lg:pt-[112px] pb-[64px] lg:pb-[112px]">
          <Reveal>
            <Label>Our estates</Label>
            <h2 className="fraunces text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">
              Find your ground.
            </h2>
            <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3 max-w-[60ch]">
              Five estates across Abuja. Choose a location, then a plot.
            </p>
          </Reveal>
          <div className="mt-8">
            <EstatesGrid filter={filter} onClear={() => setFilter(EMPTY)} />
          </div>
          <Reveal className="mt-8">
            <Link
              href="/gallery"
              className="mono text-[12px] tracking-[0.14em] uppercase text-[#12291F] underline decoration-[#C49A3A] decoration-2 underline-offset-4 hover:text-[#8a6d2b]"
            >
              View all estates →
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
