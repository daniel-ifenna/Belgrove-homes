// Types for statement-html.mjs (the single visual source of truth, kept here
// so PDF, panel tests and routes all import one copy — never a duplicate).
export type StatementHtmlModel = {
  isDraft: boolean;
  layoutVersion: string;
  accountRef: string;
  generatedOn: string;
  asOf: string;
  number?: string;
  company: { name: string; addressLine: string; website: string; email: string; phone: string };
  client: { name: string; phone?: string; email?: string };
  property: { estate: string; unitType: string; sku: string; plots: number };
  summary: { contractPrice: number; totalPaid: number; outstanding: number };
  rows: {
    date: string;
    line1: string;
    line2?: string;
    charge?: number;
    payment?: number;
    balance: number;
  }[];
  totals: { charges: number; payments: number };
  closing: { balance: number; settled: boolean; credit: boolean };
  dataCheckErrors?: string[];
};

export type StatementHtmlAssets = {
  logoSrc: string;
  stampSrc?: string;
  qrSvg?: string;
  fontFamily?: string;
  fontFaceCss?: string;
};

export type StatementHtmlFmt = {
  money(n: number): string;
  cell(n: number | undefined): string;
};

export function renderStatementHtml(
  model: StatementHtmlModel,
  assets: StatementHtmlAssets,
  fmt: StatementHtmlFmt
): string;
