// Verifies every receipt's QR target points at its OWN document and nothing else.
//
// Checks per receipt:
//   1. accessToken present (QR has nothing unique to encode without it)
//   2. accessToken unique across rows (a duplicate token = two QRs opening one doc)
//   3. receiptUrl + qrTargetUrl both equal getReceiptAccessUrl(accessToken)
//      (stale rows predate an APP_URL change and scan to localhost/old domain)
//   4. QR payload actually encodes (qrcode round-trip generation succeeds)
//
// Usage: npx tsx scripts/verify-qr-targets.ts [--apply]
// Default is --dry-run: prints exactly what would change. --apply rewrites
// stale receiptUrl/qrTargetUrl rows to the canonical token URL. Tokens are
// never rotated here (that would kill printed QRs) — only the URL strings.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { getAppUrl, getReceiptAccessUrl } from "../src/lib/app-url.js";
import { generateQrDataUrl } from "../src/lib/receipts/qr.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const appUrl = getAppUrl();
  console.log(`[dry-run=${!APPLY}] APP_URL=${appUrl}`);
  const receipts = await prisma.receipt.findMany({
    select: { id: true, ref: true, accessToken: true, receiptUrl: true, qrTargetUrl: true },
    orderBy: { ref: "asc" },
  });
  console.log(`${receipts.length} receipts`);

  const seen = new Map<string, string>();
  let ok = 0;
  let stale = 0;
  let broken = 0;
  for (const r of receipts) {
    if (!r.accessToken) {
      broken += 1;
      console.log(`  BROKEN ${r.ref}: missing accessToken (QR cannot identify this document)`);
      continue;
    }
    const first = seen.get(r.accessToken);
    if (first) {
      broken += 1;
      console.log(`  BROKEN ${r.ref}: duplicate accessToken also on ${first} — scans would open one document`);
      continue;
    }
    seen.set(r.accessToken, r.ref);

    const canonical = getReceiptAccessUrl(r.accessToken);
    const mismatched: string[] = [];
    if (r.receiptUrl !== canonical) mismatched.push(`receiptUrl=${r.receiptUrl}`);
    if (r.qrTargetUrl !== canonical) mismatched.push(`qrTargetUrl=${r.qrTargetUrl}`);
    if (mismatched.length > 0) {
      stale += 1;
      console.log(`  STALE ${r.ref}: canonical=${canonical} (${mismatched.join("; ")})`);
      if (APPLY) {
        await prisma.receipt.update({
          where: { id: r.id },
          data: { receiptUrl: canonical, qrTargetUrl: canonical },
        });
      }
      continue;
    }
    try {
      await generateQrDataUrl(canonical);
    } catch {
      broken += 1;
      console.log(`  BROKEN ${r.ref}: QR encoding failed for ${canonical}`);
      continue;
    }
    ok += 1;
  }
  console.log(`OK=${ok} STALE=${stale} BROKEN=${broken}`);
  if (stale > 0) {
    const storedOrigins = new Set(
      receipts
        .flatMap((r) => [r.receiptUrl, r.qrTargetUrl])
        .map((u) => {
          try {
            return new URL(u).origin;
          } catch {
            return u;
          }
        }),
    );
    console.log(`Stored URL origins: ${[...storedOrigins].join(", ")}`);
    console.log("Only --apply in the environment whose APP_URL is the public origin (production).");
    console.log("Applying elsewhere rewrites live QR targets to a dev origin and breaks scanning.");
  }
  if (stale > 0 && !APPLY) console.log("Dry run complete — re-run with --apply to rewrite stale URLs to canonical token URLs.");
  if (stale > 0 && APPLY) console.log("Applied: stale receiptUrl/qrTargetUrl rows rewritten to canonical token URLs.");
  if (broken > 0) console.log("BROKEN rows need manual review (missing/duplicate token or QR encode failure).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
