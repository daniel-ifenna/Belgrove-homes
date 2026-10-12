import { createHash } from "node:crypto";
import { getAppUrl, generateReceiptAccessToken } from "./app-url";
import { generateUniqueStatementNumber } from "./ref";
import { getEffectiveEntries, hashLedgerEntries, type TxClient } from "./finance/ledger";
import { buildStatementModel, type StatementModelDb } from "./statement-model";
import { renderStatementPdf } from "./statement-pdf";
import { logLedgerError } from "./finance/ledger";

// Single statement lifecycle: preview renders on the fly (never stored);
// issue stores an immutable PDF + number + token (deduped by ledger hash);
// email sends only through the explicit per-statement endpoint.
// Generating or downloading NEVER emails — audit the call sites if in doubt.
//
// Every issued PDF comes from the one entry point, renderStatementPdf
// (supplied HTML template + headless Chromium). Stored bytes are served for
// downloads and attachments — never regenerated.

// PDFs stay as private bytes on the row (never under public/): on ephemeral
// serverless filesystems a storage-key backend would be less durable, not
// more. asOfDate/layoutVersion/pdfSha256 are recorded alongside.

export type IssueResult = {
  statement: { id: string; number: string; token: string; closingBalance: number; asAt: Date };
  created: boolean;
};

export class StatementDataError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Statement data check failed: ${problems.join("; ")}`);
    this.name = "StatementDataError";
    this.problems = problems;
  }
}

export function statementVerifyUrl(token: string): string {
  return `${getAppUrl()}/s/${token}`;
}

export async function issueStatement(
  db: StatementModelDb & {
    statement: {
      findFirst(args: unknown): Promise<{ id: string; number: string; token: string; closingBalance: number; asAt: Date } | null>;
      create(args: unknown): Promise<{ id: string; asAt: Date }>;
    };
    auditEvent: { create(args: unknown): Promise<unknown> };
    $transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T>;
  },
  opts: {
    transactionId: string;
    actorId?: string | null;
    actorName?: string | null;
    asOf?: Date;
    warnAcknowledged?: boolean;
  }
): Promise<IssueResult> {
  // Phase 1 — reads + render outside any transaction (DB work and Chromium
  // must never share a transaction: a slow render must not hold one open).
  const txn = await db.transaction.findUnique({
    where: { id: opts.transactionId },
  });
  if (!txn) throw new Error("Transaction not found");
  const entries = await getEffectiveEntries(db, opts.transactionId);
  const hash = hashLedgerEntries(entries);
  const already = await db.statement.findFirst({
    where: { transactionId: opts.transactionId, ledgerHash: hash },
    orderBy: { createdAt: "desc" },
  });
  if (already) {
    return {
      statement: { id: already.id, number: already.number, token: already.token, closingBalance: already.closingBalance, asAt: already.asAt },
      created: false,
    };
  }
  const number = await generateUniqueStatementNumber();
  const token = generateReceiptAccessToken();
  const asOf = opts.asOf ?? new Date();
  const model = await buildStatementModel(db, {
    transactionId: opts.transactionId,
    asOf,
    draft: false,
    number,
  });
  // Invariant failures block issuing everywhere (Generate route pre-checks
  // and surfaces the same list; this guard protects every other issuer too).
  if (model.dataCheckErrors.length > 0) {
    logLedgerError(`statement ${number}: data check failed`, model.dataCheckErrors);
    throw new StatementDataError(model.dataCheckErrors);
  }
  let pdf: Buffer;
  try {
    pdf = await renderStatementPdf(model, { token });
  } catch (e) {
    logLedgerError(`statement ${number}: render failed`, e);
    throw e;
  }
  // Phase 2 — DB writes only, in one short transaction.
  return db.$transaction(async (tx) => {
    const raced = await tx.statement.findFirst({
      where: { transactionId: opts.transactionId, ledgerHash: hash },
      orderBy: { createdAt: "desc" },
    });
    if (raced) {
      return {
        statement: { id: raced.id, number: raced.number, token: raced.token, closingBalance: raced.closingBalance, asAt: raced.asAt },
        created: false,
      };
    }
    const created = await tx.statement.create({
      data: {
        number,
        transactionId: txn.id,
        token,
        pdfData: new Uint8Array(pdf),
        closingBalance: model.closing.balance,
        ledgerHash: hash,
        asOfDate: asOf,
        layoutVersion: model.layoutVersion,
        pdfSha256: createHash("sha256").update(pdf).digest("hex"),
        createdById: opts.actorId ?? null,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: opts.actorId ?? null,
        actorName: opts.actorName ?? "System",
        action: "statement.generate",
        entityType: "statement",
        entityId: created.id,
        before: { ledgerHash: null },
        after: {
          number,
          closingBalance: model.closing.balance,
          entries: entries.length,
          layoutVersion: model.layoutVersion,
          warnings: model.warnings,
          warnAcknowledged: opts.warnAcknowledged ?? false,
        },
      },
    });
    return {
      statement: { id: created.id, number, token, closingBalance: model.closing.balance, asAt: created.asAt },
      created: true,
    };
  });
}
