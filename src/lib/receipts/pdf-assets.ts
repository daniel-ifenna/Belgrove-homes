import { jsPDF } from "jspdf";
import { NOTO_BOLD_B64, NOTO_REGULAR_B64, STAMP_PNG_B64 } from "./embedded-assets";

// Shared server-only PDF assets (receipts + statements). Binary content is
// bundled as base64 constants (scripts/embed-assets.ts) — NOT read from disk
// at request time: file-tracing does not follow fs.readFileSync, so disk
// reads work locally but go missing in production serverless bundles.
// NotoSans embedding is MANDATORY: it is the only bundled font containing
// U+20A6 (₦). A missing asset throws loudly (recoverable PDF failure) — never
// a silent fallback to helvetica (which renders ₦ as ¦) or an unsigned
// document.

// Company stamp + authorized signature (single image supplied by the owner):
// server-side asset only, never a public URL. This is the one allowed stamp
// — the code-drawn gold stamp stays removed; draw no other stamp/watermark.
export function loadSignatureBase64(): string {
  return `data:image/png;base64,${STAMP_PNG_B64}`;
}

export function embedNotoSans(doc: jsPDF): void {
  const reg = NOTO_REGULAR_B64;
  (doc as unknown as { addFileToVFS: (n: string, d: string) => void }).addFileToVFS("NotoSans-Regular.ttf", reg);
  (doc as unknown as { addFont: (n: string, f: string, s: string) => void }).addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  const bold = NOTO_BOLD_B64;
  (doc as unknown as { addFileToVFS: (n: string, d: string) => void }).addFileToVFS("NotoSans-Bold.ttf", bold);
  (doc as unknown as { addFont: (n: string, f: string, s: string) => void }).addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
}
