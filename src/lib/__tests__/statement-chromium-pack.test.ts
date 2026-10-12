import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CHROMIUM_PACK_FILES,
  buildChromiumPack,
  chromiumPackUrl,
  listChromiumPack,
} from "../statement-chromium-pack";

describe("chromiumPackUrl", () => {
  it("points at the pack tar under the app base URL", () => {
    expect(chromiumPackUrl("https://www.belgrovehomes.com")).toBe(
      "https://www.belgrovehomes.com/chromium-pack.tar"
    );
    expect(chromiumPackUrl("https://www.belgrovehomes.com/")).toBe(
      "https://www.belgrovehomes.com/chromium-pack.tar"
    );
  });
});

describe("buildChromiumPack", () => {
  it("packs exactly the four .br binaries as an uncompressed tar", () => {
    const dest = buildChromiumPack(process.cwd());
    try {
      expect(fs.existsSync(dest)).toBe(true);
      // Uncompressed tar, not gzip: the package pipes the download straight
      // into tar extract, so any compression breaks extraction.
      const head = fs.readFileSync(dest).subarray(0, 2);
      expect(head[0]).not.toBe(0x1f);
      expect(head[1]).not.toBe(0x8b);
      expect(listChromiumPack(dest).sort()).toEqual([...CHROMIUM_PACK_FILES].sort());
    } finally {
      void dest;
    }
  });

  it("pack output is gitignored (never committed)", () => {
    const ignore = fs.readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toContain("/public/chromium-pack.tar");
  });
});
