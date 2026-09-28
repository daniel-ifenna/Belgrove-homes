"use client";

import { useRef, useState } from "react";
import { METHOD_STEPS } from "@/lib/site";

export default function MethodTabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const step = METHOD_STEPS[active];

  function onKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (active + dir + METHOD_STEPS.length) % METHOD_STEPS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
      <div>
        <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#D9B25C]">The Belgrove method</div>
        <h2 className="fraunces text-white text-[28px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] mt-2">
          Build. Hold. Grow.
        </h2>
        <p className="public text-white/75 text-[17px] leading-[1.6] mt-3">Which step are you on?</p>
        <div role="tablist" aria-label="The Belgrove method" onKeyDown={onKey} className="mt-6 grid grid-cols-3 lg:grid-cols-1 gap-2">
          {METHOD_STEPS.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={i === active}
              aria-controls={`panel-${s.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={`h-[52px] rounded-[10px] public text-[15px] font-semibold transition-colors ${
                i === active ? "bg-[#C49A3A] text-[#12291F]" : "border border-white/25 text-white/80 hover:text-white hover:border-white/60"
              }`}
            >
              {s.tab}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${step.id}`}
        aria-labelledby={`tab-${step.id}`}
        className="rounded-[14px] bg-[#F6EEE3] text-[#1C2B20] p-6 lg:p-8"
      >
        <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#8a6d2b]">{step.kicker}</div>
        <h3 className="fraunces text-[24px] lg:text-[28px] leading-[1.15] mt-2">{step.title}</h3>
        <p className="public text-[17px] leading-[1.6] text-[#5B5346] mt-3">{step.body}</p>
        <p className="mono text-[12px] tracking-[0.06em] uppercase text-[#1C2B20] mt-4">→ {step.ideal}</p>
        <a
          href="#book"
          className="public inline-flex items-center justify-center bg-[#12291F] text-white px-8 h-[52px] rounded-[10px] text-[15px] font-semibold hover:bg-[#1B2E23] transition-colors mt-6 w-full lg:w-auto"
        >
          Talk to an adviser
        </a>
      </div>
    </div>
  );
}
