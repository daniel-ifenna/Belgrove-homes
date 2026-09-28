// Single source of truth for the application's public origin.
// Reads APP_URL only. In production a missing APP_URL throws at startup
// rather than silently minting localhost receipt links, QR codes or emails.
export function getAppUrl(): string {
  const url = process.env.APP_URL?.trim();
  if (url) {
    return url.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing APP_URL: set it to https://belgrovehomes.com in production. Refusing to build client-facing URLs as localhost."
    );
  }
  return "http://localhost:3000";
}

// Client-facing receipt URL. Carries the random access token, never the
// receipt ref, so URLs are unguessable and individually revocable.
export function getReceiptAccessUrl(accessToken: string): string {
  return `${getAppUrl()}/r/${accessToken}`;
}

// Random 32-byte URL-safe token for Receipt.accessToken.
import { randomBytes } from "node:crypto";

export function generateReceiptAccessToken(): string {
  return randomBytes(32).toString("base64url");
}
