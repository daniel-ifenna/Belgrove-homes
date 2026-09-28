// Shared trend chip: never shows a fake "▲100%" when the prior period is 0.
// Prior 0 + current > 0 → "New"; both 0 → "—".
export type Trend = { kind: "up" } & { pct: number } | { kind: "down" } & { pct: number } | { kind: "new" } | { kind: "flat" };

export function trendFor(cur: number, prev: number): Trend {
  if (prev > 0) {
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (pct === 0) return { kind: "flat" };
    return pct > 0 ? { kind: "up", pct } : { kind: "down", pct: Math.abs(pct) };
  }
  if (cur > 0) return { kind: "new" };
  return { kind: "flat" };
}

export default function TrendChip({ cur, prev }: { cur: number; prev: number }) {
  const trend = trendFor(cur, prev);
  if (trend.kind === "flat") {
    return <span className="fraunces italic text-[13px] text-[var(--ops-muted)]">— 0%</span>;
  }
  if (trend.kind === "new") {
    return <span className="fraunces italic text-[13px] text-[#1F6B3E]">New</span>;
  }
  const up = trend.kind === "up";
  return (
    <span className={`fraunces italic text-[13px] ${up ? "text-[#1F6B3E]" : "text-[#A6402F]"}`}>
      {up ? "▲" : "▼"} {trend.pct}%
    </span>
  );
}
