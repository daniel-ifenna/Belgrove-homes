import Link from "next/link";
import { notFound } from "next/navigation";

const posts: Record<string, { category: string; date: string; title: string; image: string; excerpt: string; body: string[] }> = {
  "verify-before-you-pay": {
    category: "Verification",
    date: "Nov 2025",
    title: "The 7 checks before you pay a naira",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
    excerpt: "How our Land Verification Standard protects you from encumbrance and title gaps.",
    body: [
      "At Belgrove Homes & Properties Limited, we will not let a plot go live until it clears all seven checks. That discipline is why a verification pack matters more than a brochure.",
      "1. Title & Ownership chain of ownership verified and seller's right to sell confirmed with documented title you can take to your own counsel. No title, no listing.",
      "2. Freedom from encumbrance and disputes checks for claims, liens, caveats, family and community claims that never appear online.",
      "3. Boundaries & Size plot dimension established by survey or certified measurement, pegged, photographed and shared. What you see is what you buy.",
      "4. Use & Planning Status what the land may be used for and any permit position so you do not buy residential where only commercial can stand.",
      "5. Access & Utilities road access and availability of water, power and other essentials. Land without access is not an asset.",
      "6. Possession & Encroachment physically visited to confirm the land is actually available and free of occupation, not just checked on paper.",
      "7. Complete Documentation title, deed, transfer and registration explained and, where you wish, coordinated end to end so the paperwork feels as solid as the ground.",
      "Ask for the verification pack before you pay. Bring your lawyer. We welcome it.",
    ],
  },
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) notFound();

  return (
    <div className="bg-[#F7F2E7]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet" />
      <style>{`.fraunces{font-family:Fraunces,serif} .mono{font-family:IBM Plex Mono,monospace} .public{font-family:Public Sans,sans-serif}`}</style>

      <div className="max-w-[860px] mx-auto px-6 lg:px-8 py-12">
        <Link href="/#blog" className="mono text-[11px] tracking-[0.12em] uppercase text-[#8B5E3C] hover:text-[#1F3328]">← Back to insights</Link>
        <div className="mono text-[11px] tracking-[0.14em] uppercase bg-[#1F3328] text-[#E4C892] inline-block px-2 py-1 rounded-[2px] mt-6">{post.category}</div>
        <div className="mono text-[11px] tracking-[0.12em] uppercase text-[#8B5E3C] mt-3">{post.date}</div>
        <h1 className="fraunces text-[30px] lg:text-[36px] leading-[1.05] text-[#1F3328] mt-2">{post.title}</h1>
        <p className="public text-[15px] leading-[1.6] text-[#8B5E3C] mt-3">{post.excerpt}</p>

        <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] aspect-[1.8] mt-8 bg-white">
          <img src={post.image} alt={post.title} className="absolute inset-0 w-full h-full object-cover" />
        </div>

        <div className="public text-[14.5px] leading-[1.75] text-[#211D17] mt-8 space-y-4">
          {post.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="mt-10 p-6 bg-white border border-[#E0D5BB] rounded-[4px]">
          <div className="fraunces text-[16px] text-[#1F3328]">Want the verification pack for a plot you like?</div>
          <p className="public text-[13px] text-[#8B5E3C] mt-1">We send it before you pay a naira. Talk to an adviser.</p>
          <Link href="/book-inspection" className="mono inline-flex mt-4 text-[11px] tracking-[0.08em] uppercase bg-[#1F3328] text-white px-4 py-2.5 rounded-[2px] hover:bg-black transition-colors">Book inspection</Link>
        </div>
      </div>
    </div>
  );
}
