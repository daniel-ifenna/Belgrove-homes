import Link from "next/link";

// Admin-only "Show test data" toggle for list pages. Records flagged isTest
// are hidden by default (?showTest=1 reveals them).
export default function TestDataToggle({ href, showing }: { href: string; showing: boolean }) {
  return (
    <Link
      href={href}
      className={`mono text-[11px] tracking-wide uppercase rounded-full px-4 py-2 border transition-colors ${
        showing
          ? "bg-[#16281F] text-[#D4B368] border-[#16281F]"
          : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)] hover:bg-[var(--ops-bg)]"
      }`}
    >
      {showing ? "✓ Showing test data" : "Show test data"}
    </Link>
  );
}

// Builds the toggle href preserving existing query params.
export function toggleTestQuery(params: Record<string, string | undefined>, showing: boolean): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "showTest" && k !== "page") qs.set(k, v);
  }
  if (!showing) qs.set("showTest", "1");
  const str = qs.toString();
  return str ? `?${str}` : "?";
}
