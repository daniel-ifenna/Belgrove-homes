// Single source of truth for the application's public origin.
// Reads APP_URL only (canonical: https://www.belgrovehomes.com — every client
// link already sent uses it). In production a missing APP_URL — or one
// pointing at localhost/private origins — throws loudly rather than silently
// minting bad receipt links, QR codes or emails.
export function getAppUrl(): string {
  const url = process.env.APP_URL?.trim();
  if (url) {
    if (process.env.NODE_ENV === "production" && isLocalOrigin(url)) {
      throw new Error(
        `Refusing to build client-facing URLs from local APP_URL=${url} in production. Set APP_URL=https://www.belgrovehomes.com.`
      );
    }
    return url.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing APP_URL: set it to https://www.belgrovehomes.com in production. Refusing to build client-facing URLs as localhost."
    );
  }
  return "http://localhost:3000";
}

function isLocalOrigin(url: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.|0\.0\.0\.0|\[::|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);
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
