"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import Image from "next/image";
import { GROUND_VIDEO, GROUND_PHOTOS } from "@/lib/site";

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono text-[12px] tracking-[0.14em] uppercase text-[#5B5346] mt-2 truncate">{children}</div>
  );
}

export default function Ground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function play() {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => {});
  }

  return (
    <div className="grid md:grid-cols-3 gap-5">
      <figure className="md:col-span-2 md:row-span-2">
        <div className="relative rounded-[14px] overflow-hidden aspect-[16/10] md:aspect-auto md:h-full md:min-h-[420px] bg-[#12291F]">
          <video
            ref={videoRef}
            src={GROUND_VIDEO.src}
            preload="none"
            playsInline
            controls={playing}
            className="absolute inset-0 w-full h-full object-cover"
            aria-label="Site walk video"
          />
          {!playing && (
            <button
              onClick={play}
              className="absolute inset-0 grid place-items-center group"
              aria-label="Play site walk video"
            >
              <span className="h-16 w-16 rounded-full bg-white/95 text-[#12291F] grid place-items-center group-hover:scale-105 transition-transform">
                <Play size={24} strokeWidth={2} aria-hidden="true" className="ml-1" />
              </span>
            </button>
          )}
          <span className="absolute bottom-3 left-3 mono text-[10px] tracking-[0.06em] uppercase bg-black/55 text-white px-2.5 py-1 rounded-full pointer-events-none">
            {GROUND_VIDEO.caption}
          </span>
        </div>
      </figure>
      {GROUND_PHOTOS.map((g) => (
        <figure key={g.src}>
          <div className="relative rounded-[14px] overflow-hidden aspect-[3/2]">
            <Image src={g.src} alt={g.alt} fill sizes="(max-width: 768px) 100vw, 33vw" loading="lazy" className="object-cover" />
          </div>
          <Caption>{g.caption}</Caption>
        </figure>
      ))}
    </div>
  );
}
