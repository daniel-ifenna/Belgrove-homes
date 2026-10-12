import { renderStatementHtml } from "../../docs/reference/statement-template/statement-html.mjs";
import type { StatementHtmlAssets } from "../../docs/reference/statement-template/statement-html.mjs";
import { formatCellNaira, formatSignedNaira } from "@/lib/currency";
import { brandLogo } from "@/lib/documents/brand";
import { loadSignatureBase64 } from "@/lib/receipts/pdf-assets";
import { generateQrSvg } from "@/lib/receipts/qr";
import { statementVerifyUrl } from "@/lib/statements";
import { statementFontFaceCss } from "@/lib/statement-assets";
import { launchStatementBrowser } from "@/lib/statement-chromium";
import type { StatementModel } from "@/lib/statement-model";

// THE single code path that produces a statement PDF — used by Preview,
// Generate, Download and the email attachment (issued statements are stored
// once and served from storage, never regenerated). HTML comes from the
// supplied template module, printed by headless Chromium (A4, backgrounds on,
// CSS page size). No hand-positioned text anywhere.

// Shared formatters: money for summary/closing (negative as -₦N, zero ₦0),
// cell for table cells (bare numbers, "-" when missing). The web panel uses
// these same two functions, so panel and PDF can never disagree.
export const statementFmt = {
  money: (n: number): string => formatSignedNaira(n),
  cell: (n: number | undefined): string => formatCellNaira(n ?? undefined),
};

export async function buildStatementAssets(opts: {
  token?: string | null;
  stamp?: boolean;
}): Promise<StatementHtmlAssets> {
  return {
    logoSrc: brandLogo(),
    ...(opts.stamp ? { stampSrc: loadSignatureBase64() } : {}),
    ...(opts.token ? { qrSvg: await generateQrSvg(statementVerifyUrl(opts.token)) } : {}),
    fontFamily: "'Noto Sans'",
    fontFaceCss: statementFontFaceCss(),
  };
}

export async function renderStatementHtmlForModel(
  model: StatementModel,
  assets: StatementHtmlAssets
): Promise<string> {
  return renderStatementHtml(model, assets, statementFmt);
}

// Full pipeline: model → HTML → A4 PDF bytes. DB work and QR/stamp loading
// happen before this; the browser step is pure rendering.
export async function renderStatementPdf(
  model: StatementModel,
  opts: { token?: string | null } = {}
): Promise<Buffer> {
  const draft = model.isDraft;
  const assets = await buildStatementAssets({ token: opts.token, stamp: !draft });
  const html = await renderStatementHtmlForModel(model, assets);
  const browser = await launchStatementBrowser();
  try {
    const page = await browser.newPage();
    // No network access during render: every image and font is a data URL.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.resourceType() === "document" || req.url().startsWith("data:")) {
        void req.continue();
      } else {
        void req.abort();
      }
    });
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
