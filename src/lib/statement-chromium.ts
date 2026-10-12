import fs from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import { getAppUrl } from "@/lib/app-url";
import { chromiumPackUrl } from "@/lib/statement-chromium-pack";

// Headless Chromium for statement PDFs (HTML template → A4 PDF). Executable
// resolution order:
//   1. CHROME_PATH env (local dev / CI with a system browser).
//   2. macOS system Chrome (dev convenience only).
//   3. chromium-pack.tar served from our own CDN (serverless production):
//      downloaded once per cold instance through the package's own URL
//      input, then cached in /tmp for warm invocations. This is the primary
//      production path — function bundles cannot ship the .br binaries by
//      tracing (verified absent), and outputFileTracingIncludes is skipped
//      by Turbopack builds, so neither mechanism can deliver them.
//   4. The package's bundled bin dir (last resort: works wherever the full
//      node_modules ships, e.g. containers).
// Anything else throws a coded error — a statement must never render through
// a surprise engine. Production host still unconfirmed (see diagnosis).

const MACOS_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Typed launch failures so admin support can tell "package not bundled"
// apart from "binary missing" apart from "browser crashed", without ever
// surfacing paths or stack traces in the UI.
export class ChromiumError extends Error {
  readonly code: "DEP_MISSING" | "BINARY_MISSING";
  constructor(code: "DEP_MISSING" | "BINARY_MISSING", detail: string) {
    super(`${code}: ${detail}`);
    this.name = "ChromiumError";
    this.code = code;
  }
}

export function chromiumErrorCode(e: unknown): "DEP_MISSING" | "BINARY_MISSING" | "RENDER_FAILED" | "ASSET_MISSING" | "BUILD_FAILED" {
  if (e instanceof ChromiumError) return e.code;
  const msg = e instanceof Error ? e.message : String(e);
  if (/chromium|chrome|launch|browser|executable/i.test(msg)) return "RENDER_FAILED";
  if (/asset missing|U\+20A6|font/i.test(msg)) return "ASSET_MISSING";
  return "BUILD_FAILED";
}

export async function resolveChromeExecutable(): Promise<{
  executablePath: string;
  args: string[];
  headless: boolean | "shell";
  source: "env" | "macos" | "sparticuz";
}> {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return {
      executablePath: process.env.CHROME_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      headless: true,
      source: "env",
    };
  }
  if (process.platform === "darwin" && fs.existsSync(MACOS_CHROME)) {
    return {
      executablePath: MACOS_CHROME,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      headless: true,
      source: "macos",
    };
  }
  try {
    const mod = await import("@sparticuz/chromium");
    const chromium = (mod as { default: never }).default as unknown as {
      args: string[];
      executablePath(input?: string): Promise<string>;
    };
    // Prefer the CDN pack: deterministic regardless of what the bundler
    // shipped. Falls back to the bundled bin dir when APP_URL is unusable
    // (local non-macOS dev without CHROME_PATH).
    let packUrl: string | null = null;
    try {
      packUrl = chromiumPackUrl(getAppUrl());
    } catch {
      packUrl = null;
    }
    const attempts: { label: string; run: () => Promise<string> }[] = [];
    if (packUrl) {
      attempts.push({
        label: "cdn-pack",
        run: () => chromium.executablePath(packUrl as string),
      });
    }
    attempts.push({ label: "bundled-bin", run: () => chromium.executablePath() });
    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        return {
          executablePath: await attempt.run(),
          args: chromium.args,
          headless: true,
          source: "sparticuz",
        };
      } catch (e) {
        lastError = e;
      }
    }
    throw new ChromiumError(
      "BINARY_MISSING",
      `browser binaries unavailable (cdn-pack + bundled bin both failed): ${lastError instanceof Error ? lastError.message : lastError}`
    );
  } catch (e) {
    if (e instanceof ChromiumError) throw e;
    throw new ChromiumError(
      "DEP_MISSING",
      `@sparticuz/chromium not bundled (set CHROME_PATH): ${e instanceof Error ? e.message : e}`
    );
  }
}

export async function launchStatementBrowser(): Promise<Browser> {
  const { executablePath, args, headless } = await resolveChromeExecutable();
  return puppeteer.launch({
    executablePath,
    args,
    headless,
    protocolTimeout: 60_000,
  });
}
