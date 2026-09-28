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

// Normalize a phone number to E.164 for storage/matching. Handles Nigerian
// formats (+2348012345678, 2348012345678, 08012345678, 8012345678 →
// +2348012345678). Returns null when no usable digits are present.
export function normalizePhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.length === 13 && digits.startsWith("234")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  if (phone.trim().startsWith("+")) return `+${digits}`;
  return digits;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const v = email.trim().toLowerCase();
  return v || null;
}

// Trim and collapse inner whitespace. Stored as-entered (never re-cased).
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  const v = name.trim().replace(/\s+/g, " ");
  return v || null;
}
