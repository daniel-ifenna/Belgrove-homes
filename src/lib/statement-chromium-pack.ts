import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Chromium binary pack for serverless renders. @sparticuz/chromium loads its
// browser binaries from .br files that no bundler trace can follow, so they
// never ship inside function bundles (verified: no .br in build output, and
// outputFileTracingIncludes is skipped by Turbopack builds). Instead the pack
// is served as a static file and downloaded once per cold instance through
// the package's own URL input:
//   executablePath("https://<app>/chromium-pack.tar")
// The tar must be UNCOMPRESSED (their downloader pipes it straight into tar
// extract) and contain exactly the bin/ entries (chromium.br, fonts.tar.br,
// swiftshader.tar.br, al2023.tar.br).

export const CHROMIUM_PACK_FILES = [
  "chromium.br",
  "fonts.tar.br",
  "swiftshader.tar.br",
  "al2023.tar.br",
] as const;

export const CHROMIUM_PACK_NAME = "chromium-pack.tar";

export function chromiumPackUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${CHROMIUM_PACK_NAME}`;
}

// Builds public/chromium-pack.tar from the installed package. Runs in `next
// build` (before Next, so the file deploys to the CDN); output is gitignored.
export function buildChromiumPack(projectRoot: string = process.cwd()): string {
  const binDir = path.join(projectRoot, "node_modules", "@sparticuz", "chromium", "bin");
  const missing = CHROMIUM_PACK_FILES.filter((f) => !fs.existsSync(path.join(binDir, f)));
  if (missing.length > 0) {
    throw new Error(`chromium pack: missing binaries in ${binDir}: ${missing.join(", ")}`);
  }
  const outDir = path.join(projectRoot, "public");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, CHROMIUM_PACK_NAME);
  execSync(`tar -cf ${JSON.stringify(out)} ${CHROMIUM_PACK_FILES.map((f) => JSON.stringify(f)).join(" ")}`, {
    cwd: binDir,
    stdio: "pipe",
  });
  return out;
}

// Lists entry names inside a pack tarball (verification).
export function listChromiumPack(tarPath: string): string[] {
  const out = execSync(`tar -tf ${JSON.stringify(tarPath)}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return out.split("\n").map((l) => l.trim()).filter(Boolean);
}
