// Single source of truth for Naira formatting — use everywhere, do not reimplement per component.
// Ensures consistent output: ₦33,200,000 and proper glyph handling via embedded/loaded font.
export function formatNaira(amount: number): string {
  if (!Number.isFinite(amount)) return "₦0";
  const n = Math.round(amount);
  return `₦${n.toLocaleString("en-NG")}`;
}

// Signed variant for balances that can go negative (statements, credit
// lines): negatives print as -₦X, never ₦-X.
export function formatSignedNaira(amount: number): string {
  if (!Number.isFinite(amount)) return "₦0";
  const n = Math.round(amount);
  if (n < 0) return `-₦${Math.abs(n).toLocaleString("en-NG")}`;
  return `₦${n.toLocaleString("en-NG")}`;
}

export function formatNairaRange(min: number, max: number): string {
  if (min === max) return formatNaira(min);
  return `${formatNaira(min)} – ${formatNaira(max)}`;
}

// Plain table-cell figure for statement columns (the column header carries
// the ₦, so cells print bare numbers): thousands separators, "-" for missing,
// negatives as -N, zero as "0". THE cell formatter for the statement table —
// shared by the PDF and the web panel so the two can never disagree.
export function formatCellNaira(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}${Math.abs(r).toLocaleString("en-NG")}`;
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
