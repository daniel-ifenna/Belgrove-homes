import { describe, it, expect, beforeAll } from "vitest";
import { PDFParse } from "pdf-parse";
import { renderStatementHtml } from "../../../docs/reference/statement-template/statement-html.mjs";
import {
  renderStatementHtmlForModel,
  renderStatementPdf,
  statementFmt,
  buildStatementAssets,
} from "../statement-pdf";
import { resolveChromeExecutable } from "../statement-chromium";
import { generateQrSvg } from "../receipts/qr";
import { statementVerifyUrl } from "../statements";
import type { StatementModel } from "../statement-model";

function draftModel(): StatementModel {
  return {
    isDraft: true,
    accountRef: "TXN-2026-62831",
    generatedOn: "12-10-2026",
    asOf: "12-10-2026",
    company: {
      name: "BELGROVE HOMES AND PROPERTIES LIMITED",
      addressLine: "Suite 25, Lebrex Plaza",
      website: "www.belgrovehomes.com",
      email: "info@belgrovehomes.com",
      phone: "+234 8103760063",
    },
    client: { name: "Valentine Nzube Onweluzo", phone: "+2348000000000", email: "v@x.com" },
    property: { estate: "Sunrise Estate", unitType: "Duplex", sku: "SUN-P1-500SQM", plots: 1 },
    summary: { contractPrice: 18_500_000, totalPaid: 12_000_000, outstanding: 6_500_000 },
    rows: [
      { date: "09-08-2026", line1: "Contract price", line2: "Sunrise Estate, SUN-P1-500SQM", charge: 18_500_000, balance: 18_500_000 },
      { date: "09-08-2026", line1: "Payment received, Bank Transfer", line2: "Ref 262220980712 · Receipt RCT-1", payment: 3_000_000, balance: 15_500_000 },
    ],
    totals: { charges: 18_500_000, payments: 3_000_000 },
    closing: { balance: 15_500_000, settled: false, credit: false },
    layoutVersion: "stmt-v1",
    contractDate: "09-08-2026",
    contractAssumed: false,
    dataCheckErrors: [],
    warnings: [],
  };
}

describe("draft layout marker (no browser needed)", () => {
  it("fails if the draft marker is missing", async () => {
    const html = await renderStatementHtmlForModel(draftModel(), {
      logoSrc: "data:image/png;base64,xx",
      fontFamily: "'Noto Sans'",
      fontFaceCss: "",
    });
    expect(html).toContain("stmt-v1 draft");
    // Issued HTML must not carry the draft marker.
    const issued = await renderStatementHtmlForModel(
      { ...draftModel(), isDraft: false, number: "STM-2026-00014" },
      { logoSrc: "data:image/png;base64,xx", fontFamily: "'Noto Sans'", fontFaceCss: "" }
    );
    expect(issued).not.toContain("stmt-v1 draft");
    expect(issued).toContain("STM-2026-00014");
  });

  it("uses the supplied template module (single visual source)", () => {
    expect(renderStatementHtml).toBeDefined();
    expect(statementFmt.money(6_500_000)).toBe("₦6,500,000");
    expect(statementFmt.money(-3_000_000)).toBe("-₦3,000,000");
    expect(statementFmt.cell(undefined)).toBe("-");
    expect(statementFmt.cell(3_000_000)).toBe("3,000,000");
  });
});

describe("QR payload", () => {
  it("encodes the production verify URL for the statement token", async () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = "https://www.belgrovehomes.com";
    try {
      expect(statementVerifyUrl("tok123")).toBe("https://www.belgrovehomes.com/s/tok123");
      const svg = await generateQrSvg("https://www.belgrovehomes.com/s/tok123");
      expect(svg.trimStart().startsWith("<svg")).toBe(true);
      expect(svg).toContain("#16281F");
    } finally {
      if (prev === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prev;
    }
  });
});

describe("Chromium render", () => {
  let chromeOk = false;
  beforeAll(async () => {
    try {
      await resolveChromeExecutable();
      chromeOk = true;
    } catch {
      console.warn("statement-pdf render tests skipped: no Chromium available");
    }
  });

  // The web panel renders model.rows with statementFmt (same functions);
  // every panel row segment must appear verbatim in the PDF's extracted text.
  async function panelSegmentsInPdf(model: StatementModel) {
    const panelLines = model.rows.map((r) =>
      [r.date, r.line1, r.line2 ?? "", statementFmt.cell(r.charge), statementFmt.cell(r.payment), statementFmt.cell(r.balance)].join(" | ")
    );
    const pdf = await renderStatementPdf(model, { token: null });
    const parser = new PDFParse({ data: pdf });
    const { text, total: numpages } = await parser.getText();
    await parser.destroy();
    const flat = text.replace(/\s+/g, " ");
    const missing: string[] = [];
    for (const line of panelLines) {
      for (const seg of line.split(" | ").filter((s) => s && s !== "-")) {
        if (!flat.includes(seg)) missing.push(seg);
      }
    }
    return { missing, numpages, flat };
  }

  it("renders a draft PDF with rows, page numbers and the naira sign", async () => {
    if (!chromeOk) return;
    const t0 = Date.now();
    const pdf = await renderStatementPdf(draftModel(), { token: null });
    console.log(`draft render took ${Date.now() - t0}ms, ${pdf.length} bytes`);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const parser = new PDFParse({ data: pdf });
    const { text } = await parser.getText();
    await parser.destroy();
    const flat = text.replace(/\s+/g, " ");
    expect(flat).toContain("STATEMENT OF ACCOUNT");
    expect(flat).toContain("18,500,000");
    expect(flat).toContain("Page 1 of 1");
    expect(flat).toContain("₦");
    expect(flat).toContain("stmt-v1 draft");
  });

  it("issued render carries stamp, QR and footer, and no draft marking", async () => {
    if (!chromeOk) return;
    const assets = await buildStatementAssets({ token: "tok123", stamp: true });
    expect(assets.stampSrc).toMatch(/^data:image\/png;base64,/);
    expect(assets.qrSvg).toContain("<svg");
    expect(assets.fontFaceCss).toContain("font-family:'Noto Sans'");
    const pdf = await renderStatementPdf(
      { ...draftModel(), isDraft: false, number: "STM-2026-00014" },
      { token: "tok123" }
    );
    const parser = new PDFParse({ data: pdf });
    const { text } = await parser.getText();
    await parser.destroy();
    const flat = text.replace(/\s+/g, " ");
    expect(flat).toContain("STM-2026-00014");
    expect(flat).toContain("SCAN TO VERIFY");
    expect(flat).not.toContain("stmt-v1 draft");
  });

  it("panel rows equal PDF row text line for line", async () => {
    if (!chromeOk) return;
    const { missing } = await panelSegmentsInPdf(draftModel());
    expect(missing).toEqual([]);
  });

  it("40-row ledger paginates with totals and closing once, on the last page", async () => {
    if (!chromeOk) return;
    const pays = Array.from({ length: 40 }, (_, i) => ({
      date: `${String(1 + (i % 28)).padStart(2, "0")}-09-2026`,
      line1: "Payment received, Bank Transfer",
      line2: `Ref 26${2200000000 + i} · Receipt RCT-2026-${10000 + i}`,
      payment: 200_000,
      balance: 18_500_000 - (i + 1) * 200_000,
    }));
    const model: StatementModel = {
      ...draftModel(),
      isDraft: false,
      number: "STM-2026-00015",
      rows: [
        { date: "09-08-2026", line1: "Contract price", line2: "Sunrise Estate, SUN-P1-500SQM", charge: 18_500_000, balance: 18_500_000 },
        ...pays,
      ],
      totals: { charges: 18_500_000, payments: 8_000_000 },
      summary: { contractPrice: 18_500_000, totalPaid: 8_000_000, outstanding: 10_500_000 },
      closing: { balance: 10_500_000, settled: false, credit: false },
    };
    const { missing, numpages, flat } = await panelSegmentsInPdf(model);
    expect(missing).toEqual([]);
    expect(numpages).toBeGreaterThan(1);
    // Totals, closing, stamp block and QR appear exactly once (last page only).
    for (const once of ["Totals", "Closing balance", "AUTHORIZED BY BELGROVE", "SCAN TO VERIFY"]) {
      expect(flat.split(once).length - 1, once).toBe(1);
    }
    expect(flat).toContain("Page 1 of");
  });
});
