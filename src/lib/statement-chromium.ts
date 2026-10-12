import fs from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";

// Headless Chromium for statement PDFs (HTML template → A4 PDF). Executable
// resolution order:
//   1. CHROME_PATH env (local dev / CI with a system browser).
//   2. macOS system Chrome (dev convenience only).
//   3. @sparticuz/chromium serverless build (Linux production).
// Anything else throws loudly — a statement must never render through a
// surprise engine. Approach (A) per the build spec; production host still
// unconfirmed (see diagnosis), so (B)/(C) stay open pending that answer.

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
      executablePath(): Promise<string>;
    };
    let executablePath: string;
    try {
      executablePath = await chromium.executablePath();
    } catch (e) {
      throw new ChromiumError(
        "BINARY_MISSING",
        `browser binaries not in the function bundle: ${e instanceof Error ? e.message : e}`
      );
    }
    return {
      executablePath,
      args: chromium.args,
      headless: true,
      source: "sparticuz",
    };
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
