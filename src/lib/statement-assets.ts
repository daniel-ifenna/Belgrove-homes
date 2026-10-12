import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Server-only statement assets for the Chromium HTML template: Noto Sans as
// base64 @font-face CSS (Regular/Medium/SemiBold/Bold — no fallback families
// in production, no network access during render).
//
// The naira sign U+20A6 MUST come from Noto Sans: the @font-face builder
// asserts both font files contain it (via their cmap tables) and throws
// loudly otherwise — never a silent fallback to a font that renders ₦ wrong.

export const NAIRA_CODEPOINT = 0x20a6;

// Minimal TTF cmap reader (formats 4 and 12): true when the font maps the
// codepoint to a real (non-.notdef) glyph.
export function fontHasCodepoint(ttf: Buffer, codepoint: number): boolean {
  const u16 = (at: number) => ttf.readUInt16BE(at);
  const u32 = (at: number) => ttf.readUInt32BE(at);
  if (ttf.length < 12) return false;
  const numTables = u16(4);
  let cmapAt = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > ttf.length) return false;
    if (ttf.subarray(rec, rec + 4).toString("ascii") === "cmap") {
      cmapAt = u32(rec + 8);
      break;
    }
  }
  if (cmapAt < 0 || cmapAt + 4 > ttf.length) return false;
  const numSubs = u16(cmapAt + 2);
  for (let i = 0; i < numSubs; i++) {
    const sub = cmapAt + 4 + i * 8;
    if (sub + 8 > ttf.length) continue;
    const tableAt = cmapAt + u32(sub + 4);
    if (tableAt + 2 > ttf.length) continue;
    const format = u16(tableAt);
    if (format === 4) {
      if (hasGlyphFormat4(ttf, tableAt, codepoint)) return true;
    } else if (format === 12) {
      if (hasGlyphFormat12(ttf, tableAt, codepoint)) return true;
    }
  }
  return false;
}

function hasGlyphFormat4(ttf: Buffer, at: number, cp: number): boolean {
  const u16 = (o: number) => ttf.readUInt16BE(o);
  const segCount = u16(at + 6) >> 1;
  const endBase = at + 14;
  const startBase = endBase + segCount * 2 + 2;
  const deltaBase = startBase + segCount * 2;
  const rangeBase = deltaBase + segCount * 2;
  const need = rangeBase + segCount * 2;
  if (need > ttf.length || cp > 0xffff) return false;
  for (let i = 0; i < segCount; i++) {
    const end = u16(endBase + i * 2);
    if (cp > end) continue;
    const start = u16(startBase + i * 2);
    if (cp < start) return false;
    const delta = u16(deltaBase + i * 2);
    const rangeOff = u16(rangeBase + i * 2);
    if (rangeOff === 0) {
      return ((cp + delta) & 0xffff) !== 0;
    }
    const glyphAt = rangeBase + i * 2 + rangeOff + (cp - start) * 2;
    if (glyphAt + 2 > ttf.length) return false;
    return u16(glyphAt) !== 0;
  }
  return false;
}

function hasGlyphFormat12(ttf: Buffer, at: number, cp: number): boolean {
  const u32 = (o: number) => ttf.readUInt32BE(o);
  if (at + 16 > ttf.length) return false;
  const numGroups = u32(at + 12);
  for (let i = 0; i < numGroups; i++) {
    const g = at + 16 + i * 12;
    if (g + 12 > ttf.length) return false;
    if (cp >= u32(g) && cp <= u32(g + 4)) {
      return u32(g + 8) !== 0;
    }
  }
  return false;
}

function assetPath(...parts: string[]): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, ...parts),
    path.join(process.cwd(), "src", "lib", ...parts),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Statement asset missing: ${parts.join("/")} (checked module-relative and cwd paths)`);
}

function notoTtf(weightFile: "NotoSans-Regular.ttf" | "NotoSans-Bold.ttf"): Buffer {
  return fs.readFileSync(assetPath("receipts", "fonts", weightFile));
}

// @font-face CSS with embedded Noto Sans. Only Regular and Bold files ship,
// so Medium aliases Regular and SemiBold aliases Bold — still Noto Sans only,
// never Helvetica or another family. Throws when U+20A6 is missing.
export function statementFontFaceCss(): string {
  const regular = notoTtf("NotoSans-Regular.ttf").toString("base64");
  const bold = notoTtf("NotoSans-Bold.ttf").toString("base64");
  for (const [label, buf] of [["Regular", regular], ["Bold", bold]] as const) {
    const raw = Buffer.from(buf, "base64");
    if (!fontHasCodepoint(raw, NAIRA_CODEPOINT)) {
      throw new Error(`NotoSans ${label} lacks U+20A6 (₦) — refusing to render statements without the naira sign`);
    }
  }
  const face = (weight: number, b64: string) =>
    `@font-face{font-family:'Noto Sans';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
  return face(400, regular) + face(500, regular) + face(600, bold) + face(700, bold);
}
