import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fontHasCodepoint, statementFontFaceCss, NAIRA_CODEPOINT } from "../statement-assets";

function fontFile(name: string): Buffer {
  return fs.readFileSync(path.join(process.cwd(), "src", "lib", "receipts", "fonts", name));
}

describe("fontHasCodepoint", () => {
  it("finds U+20A6 in both shipped Noto files", () => {
    expect(fontHasCodepoint(fontFile("NotoSans-Regular.ttf"), NAIRA_CODEPOINT)).toBe(true);
    expect(fontHasCodepoint(fontFile("NotoSans-Bold.ttf"), NAIRA_CODEPOINT)).toBe(true);
  });

  it("rejects codepoints outside any font and garbage input", () => {
    expect(fontHasCodepoint(fontFile("NotoSans-Regular.ttf"), 0x10ffff)).toBe(false);
    expect(fontHasCodepoint(Buffer.alloc(0), NAIRA_CODEPOINT)).toBe(false);
    expect(fontHasCodepoint(Buffer.from([0, 1, 0, 0]), NAIRA_CODEPOINT)).toBe(false);
  });
});

describe("statementFontFaceCss", () => {
  it("embeds Noto Sans only — no fallback families", () => {
    const css = statementFontFaceCss();
    expect(css).toContain("font-family:'Noto Sans'");
    expect(css).not.toMatch(/helvetica|arial|sans-serif/i);
    // Four weights, two files: Medium aliases Regular, SemiBold aliases Bold.
    expect(css.match(/@font-face/g)?.length).toBe(4);
  });
});
