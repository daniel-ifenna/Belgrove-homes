import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

// Shared server-only PDF assets (receipts + statements), resolved relative to
// THIS module so serverless file tracing bundles them. NotoSans embedding is
// MANDATORY: it is the only bundled font containing U+20A6 (₦). A missing
// asset throws loudly (recoverable PDF failure) — never a silent fallback to
// helvetica (which renders ₦ as ¦) or an unsigned document.

function assetPath(...parts: string[]): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, ...parts),
    path.join(process.cwd(), "src", "lib", "receipts", ...parts),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // try next candidate
    }
  }
  throw new Error(`PDF asset missing: ${parts.join("/")} (checked module-relative and cwd paths)`);
}

// Verified cashier signature: server-side asset only, never a public URL.
export function loadSignatureBase64(): string {
  const buf = fs.readFileSync(assetPath("belgrove-cashier-signature.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export function embedNotoSans(doc: jsPDF): void {
  const reg = fs.readFileSync(assetPath("fonts", "NotoSans-Regular.ttf")).toString("base64");
  (doc as unknown as { addFileToVFS: (n: string, d: string) => void }).addFileToVFS("NotoSans-Regular.ttf", reg);
  (doc as unknown as { addFont: (n: string, f: string, s: string) => void }).addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  const bold = fs.readFileSync(assetPath("fonts", "NotoSans-Bold.ttf")).toString("base64");
  (doc as unknown as { addFileToVFS: (n: string, d: string) => void }).addFileToVFS("NotoSans-Bold.ttf", bold);
  (doc as unknown as { addFont: (n: string, f: string, s: string) => void }).addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
}
