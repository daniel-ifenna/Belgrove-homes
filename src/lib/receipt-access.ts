// Tokenized receipt access rules (single place, unit-tested).
// The unguessable accessToken in /r/{token} is the authorization — no login.
// Revoked or unknown tokens behave identically (404) so callers cannot probe
// which tokens ever existed.

export type TokenedReceipt = {
  accessToken: string | null;
  accessTokenRevokedAt: Date | null;
} | null;

export type UsableTokenReceipt = {
  accessToken: string;
  accessTokenRevokedAt: null;
};

export function isTokenUsable<T extends TokenedReceipt>(
  receipt: T | null
): receipt is T & { accessToken: string; accessTokenRevokedAt: null } {
  if (!receipt) return false;
  if (!receipt.accessToken) return false;
  if (receipt.accessTokenRevokedAt) return false;
  return true;
}

export function clientReceiptPath(accessToken: string): string {
  return `/r/${accessToken}`;
}
