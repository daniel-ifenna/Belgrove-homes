// Moves receipt PDFs from public/receipts/ to private storage/receipts/,
// backfills Receipt.accessToken for tokenized client URLs (/r/{token}),
// and removes leftover files from public/receipts/.
//
// Usage: npx tsx scripts/migrate-receipt-storage.ts [--apply]
// Default is --dry-run: prints exactly what would change. Nothing is written
// without --apply. Run BEFORE scripts/regenerate-receipts.ts --apply.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { generateReceiptAccessToken, getReceiptAccessUrl } from "../src/lib/app-url.js";
import { RECEIPT_STORAGE_DIR, receiptPdfPath } from "../src/lib/receipt-storage.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const receipts = await prisma.receipt.findMany({
    select: { id: true, ref: true, pdfPath: true, accessToken: true, receiptUrl: true },
    orderBy: { ref: "asc" },
  });
  console.log(`[dry-run=${!APPLY}] ${receipts.length} receipts in DB`);

  const moves: string[] = [];
  const tokenBackfills: string[] = [];
  for (const r of receipts) {
    const token = r.accessToken ?? generateReceiptAccessToken();
    if (!r.accessToken) tokenBackfills.push(`${r.ref}: backfill accessToken + receiptUrl ${getReceiptAccessUrl(token)}`);
    else if (!r.receiptUrl.includes("/r/")) tokenBackfills.push(`${r.ref}: rewrite receiptUrl to ${getReceiptAccessUrl(token)}`);
    const oldAbs = r.pdfPath ? path.join(process.cwd(), r.pdfPath) : null;
    const newRel = receiptPdfPath(r.ref);
    const newAbs = path.join(process.cwd(), newRel);
    if (oldAbs && path.resolve(oldAbs) !== path.resolve(newAbs) && fs.existsSync(oldAbs)) {
      moves.push(`${r.ref}: ${r.pdfPath} → ${newRel}`);
    } else if (!fs.existsSync(newAbs)) {
      moves.push(`${r.ref}: MISSING on disk (regenerate-receipts will rebuild)`);
    }
    if (APPLY) {
      await prisma.receipt.update({
        where: { id: r.id },
        data: {
          accessToken: token,
          receiptUrl: getReceiptAccessUrl(token),
          qrTargetUrl: getReceiptAccessUrl(token),
        },
      });
      if (oldAbs && path.resolve(oldAbs) !== path.resolve(newAbs) && fs.existsSync(oldAbs)) {
        fs.mkdirSync(path.dirname(newAbs), { recursive: true });
        fs.renameSync(oldAbs, newAbs);
        await prisma.receipt.update({ where: { id: r.id }, data: { pdfPath: newRel } });
      }
    }
  }
  for (const m of moves) console.log("  MOVE " + m);
  for (const t of tokenBackfills) console.log("  TOKEN " + t);

  // Leftover files in public/receipts/ (e.g. deleted manual receipt
  // BEL-2026-91329.pdf): no DB row references them.
  const publicDir = path.join(process.cwd(), "public", "receipts");
  const orphans: string[] = [];
  if (fs.existsSync(publicDir)) {
    for (const f of fs.readdirSync(publicDir)) {
      if (!f.endsWith(".pdf")) continue;
      const ref = f.replace(/\.pdf$/, "");
      const known = receipts.some((r) => r.ref === ref);
      if (!known) orphans.push(`public/receipts/${f}`);
    }
  }
  for (const o of orphans) console.log("  DELETE-ORPHAN " + o);
  if (APPLY) {
    for (const o of orphans) fs.unlinkSync(path.join(process.cwd(), o));
    // Ensure storage dir exists even when empty
    fs.mkdirSync(path.join(process.cwd(), RECEIPT_STORAGE_DIR), { recursive: true });
  }

  if (!APPLY) console.log("Dry run complete — re-run with --apply to write changes.");
  else console.log("Applied: files moved, tokens backfilled, orphans deleted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
