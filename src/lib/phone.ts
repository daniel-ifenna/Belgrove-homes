// Phone normalization for identity comparison (agent guard, customer
// matching). Compares the last 10 digits so +234..., 234... and 0... forms
// of the same Nigerian number match. Short/invalid numbers never match.
export function normalizePhoneForCompare(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhoneForCompare(a);
  const nb = normalizePhoneForCompare(b);
  return na !== null && nb !== null && na === nb;
}
