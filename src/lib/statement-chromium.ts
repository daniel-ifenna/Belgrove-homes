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
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
      source: "sparticuz",
    };
  } catch (e) {
    throw new Error(
      `No Chromium available for statement rendering (set CHROME_PATH): ${e instanceof Error ? e.message : e}`
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
