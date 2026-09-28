import Link from "next/link";

const FAQS: [string, string][] = [
  ["Is the land you sell actually yours to sell?", "This is the most important question, and we treat it that way. Before publication we verify the chain of ownership and confirm the seller's legal right to sell. Every plot we present is backed by documented title and a clear ownership position and we will walk you through that documentation page by page so you understand it before you commit. Bring your lawyer; we welcome it."],
  ["What does “verified land” mean at Belgrove?", "It means the plot has passed our 7-point land verification standard: title and ownership confirmed, freedom from encumbrance and disputes checked, boundaries and size established, use/planning status and access confirmed, and complete documentation available. You can request the verification pack for any plot you are serious about; we send it before you pay a naira."],
  ["Can I trust the size and boundaries shown?", "We present size based on the surveyor's measurement / certified record, and boundaries are established by pegs and photographs, rather than guessed. We take care you are buying precisely the land you believe you are buying, and we are honest about any measurement caveats because a square metre hidden is trust lost."],
  ["I want to buy land to build my own home, how does that work?", "We start with your vision and budget, then find land suitable for building: the right location, size, use status, and access. We verify the land, coordinate the legal transfer and registration, and connect you with trusted partners for planning and construction. Your goal is to get from plot to foundation with clarity, not complication, and we project-manage that clarity."],
  ["Is land a good long-term investment: can I expect it to grow in value?", "Land often grows in value over time as areas develop and demand rises, but this is not guaranteed, and no responsible adviser will promise future returns. We seek plots in locations with genuine long-term potential, explain the reasoning with corridor data and comparables, and set realistic expectations. Land is patient by nature, and so is our advice. That patience is our brand promise."],
  ["What is “land banking,” and do you advise on it?", "Land banking is buying land to hold for long-term appreciation before building or resale. We can help identify land with future potential and sequence it within a broader portfolio, but we are transparent that returns are not guaranteed and that a plot's prospects should be weighed carefully, with exit options discussed, rather than assumed."],
  ["What documents will I receive after buying land?", "You will receive the documentation appropriate to a valid sale, typically the title/deed and the completed legal transfer and registration. We make sure you understand every paper you receive: what it means, where to keep it, and how your family will use it. Where you wish, we coordinate the transfer on your behalf, end to end."],
  ["What if the land has a dispute, an issue, or encroachment?", "Our verification is designed to surface these before they become your problem. Where an issue exists, we either resolve it properly with the right parties and paperwork or do not present the plot. Our honest standard means we would rather lose a sale than pass a problem to you. That is not just ethics; it is marketing: a problem sold is a reputation lost."],
  ["Can you help me sell my land?", "Yes. We value it honestly (even if honest is lower than you hoped), prepare clear documentation, and market it to the right buyers (those building homes and those building portfolios) with the same verification we demand as buyers. Selling land should be as transparent as buying it; your buyer will receive the same pack you did."],
  ["Do you offer payment plans or financing for land?", "Yes. We offer flexible installment plans of up to 6 months, paid directly to Belgrove, no third-party financing required. The full price and payment schedule are disclosed clearly and in writing from the first conversation, with no hidden costs."],
  ["How does your company handle site inspections?", "We arrange site visits every week, and for out-of-town or overseas clients we offer virtual tours, drone footage and detailed reports so you can buy with confidence even at a distance. Every visit is hosted: not just a gate opened, but a walk with your adviser who knows the plot number by heart."],
  ["How long does buying land through Belgrove take?", "It varies with documentation and transfer requirements, but typically days to weeks for a straightforward plot. We set clear milestones at the start: verification, offer, transfer, registration, and keep you informed at every stage, so waiting feels like progress, not silence."],
];

export default function FaqPage() {
  return (
    <div className="bg-[#F7EFE2] texture-cream">
      <section className="pt-16 lg:pt-24 pb-8">
        <div className="max-w-[880px] mx-auto px-6 lg:px-8 text-center">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C89B3C]">FAQ</div>
          <div className="hairline-gold mx-auto"></div>
          <h1 className="fraunces font-medium text-[36px] lg:text-[48px] leading-[1.0] tracking-[-0.02em] text-[#1C2B20] mt-4">
            Answered as your adviser would.
          </h1>
        </div>
      </section>
      <section className="pb-20 lg:pb-28">
        <div className="max-w-[880px] mx-auto px-6 lg:px-8">
          <div className="divide-y divide-[#E4D8C1] border-y border-[#E4D8C1] bg-white rounded-[12px] overflow-hidden shadow-[var(--shadow-sm)]">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group bg-white open:bg-[#FAF4EA] transition-colors">
                <summary className="fraunces text-[15px] leading-[1.3] font-medium text-[#1C2B20] flex justify-between items-center cursor-pointer list-none gap-4 px-5 lg:px-6 py-4 hover:bg-[#FAF4EA] transition-colors">
                  <span>{q}</span>
                  <span className="shrink-0 h-6 w-6 rounded-full border border-[#E4D8C1] grid place-items-center text-[#C89B3C] text-[14px] leading-none group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 lg:px-6 pb-4">
                  <p className="public text-[14px] leading-[1.65] text-[#5B5346] max-w-[72ch]">{a}</p>
                </div>
              </details>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/book-inspection" className="mono text-[11px] tracking-[0.08em] uppercase text-[#5B5346] hover:text-[#1C2B20] underline decoration-[#E4D8C1] underline-offset-4">
              Still have questions? Talk to your named adviser →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
