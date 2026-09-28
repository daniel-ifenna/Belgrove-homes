// Amount in words — Naira only, programmatic, derive from numeric total
// Example: 8500000 -> "Eight Million Five Hundred Thousand Naira Only"
const UNITS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return TENS[t] + (u ? " " + UNITS[u] : "");
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return UNITS[h] + " Hundred" + (rest ? " " + underThousand(rest) : "");
}

export function amountToWords(naira: number): string {
  if (!Number.isFinite(naira) || naira <= 0) return "Zero Naira Only";
  const n = Math.floor(naira);
  const parts: string[] = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const remainder = n % 1000;
  if (billions) parts.push(underThousand(billions) + " Billion");
  if (millions) parts.push(underThousand(millions) + " Million");
  if (thousands) parts.push(underThousand(thousands) + " Thousand");
  if (remainder) parts.push(underThousand(remainder));
  const words = parts.join(" ").replace(/\s+/g, " ").trim();
  return words + " Naira Only";
}

export { formatNaira } from "../currency";
