// Single source of truth for Naira formatting — use everywhere, do not reimplement per component.
// Ensures consistent output: ₦33,200,000 and proper glyph handling via embedded/loaded font.
export function formatNaira(amount: number): string {
  if (!Number.isFinite(amount)) return "₦0";
  const n = Math.round(amount);
  return `₦${n.toLocaleString("en-NG")}`;
}

export function formatNairaRange(min: number, max: number): string {
  if (min === max) return formatNaira(min);
  return `${formatNaira(min)} – ${formatNaira(max)}`;
}

// Compact ledger figure: 67400000 → "₦67.4M". For dashboard cards
// and anywhere a full figure won't fit.
export function formatCompactNaira(n: number): string {
  if (!Number.isFinite(n)) return "₦0";
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `₦${v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `₦${v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `₦${v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}
