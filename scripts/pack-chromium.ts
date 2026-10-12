// Builds public/chromium-pack.tar (uncompressed tar of @sparticuz/chromium's
// bin/*.br) so serverless renders can download the browser binaries from our
// own CDN — bundlers cannot trace them into function bundles. Gitignored;
// runs in `next build` before Next, and never touches the database.
// Usage: npx tsx scripts/pack-chromium.ts (idempotent).
import { buildChromiumPack, listChromiumPack } from "../src/lib/statement-chromium-pack.js";

async function main() {
  const out = buildChromiumPack();
  console.log(`chromium pack: ${out}`);
  console.log(`entries: ${listChromiumPack(out).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
