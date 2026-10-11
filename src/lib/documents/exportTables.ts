// Shared wrapping rules for PDF exports (jsPDF + jspdf-autotable).
// autotable's `overflow: "linebreak"` wraps at spaces but lets a long
// unbroken string (email, URL, reference) run past its cell border, so cell
// text additionally goes through wrapLongWords: words longer than the limit
// are pre-split with "\n", which autotable renders as explicit line breaks.
// Nothing is ever truncated — content wraps inside its cell instead.
export const TABLE_OVERFLOW_LINEBREAK = "linebreak" as const;

// Normalize free text admins typed or pasted (Windows CRLF, stray CR, tabs)
// into plain "\n" newlines + spaces BEFORE wrapLongWords. jsPDF measures
// "\r" and "\t" unpredictably, so unnormalized bodies can run past their
// cell border ("out of the line") even with linebreak overflow on.
export function cleanExportText(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n").replaceAll("\t", " ");
}

// Strip every emoji (plus variation selectors, ZWJ scaffolding and
// regional indicators) for PDF output — jsPDF's standard fonts carry no
// emoji glyphs, so they render as garbled wide glyphs that also break width
// measurement (text then overruns its column). "🔥 Hot" becomes "Hot".
// Arrows and currency symbols that actually occur in booking data are folded
// to ASCII instead ("[Interested → Hot]" → "[Interested -> Hot]") so meaning
// survives; cp1252 neighbours (·, …, ’, –, —) pass through untouched.
// App storage/display is untouched — export rendering only.
const PDF_FOLD_MAP: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "↑": "^",
  "↓": "v",
  "⇒": "=>",
  "₦": "NGN",
  "✓": "v",
  "✕": "x",
  "✗": "x",
};
export function stripEmojiForPdf(value: string | null | undefined): string {
  if (value == null) return "";
  const stripped = String(value)
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[️‍⬆⬇⬅➡©®‼⁉™ℹ↔↕▪▫▶◀●○■□★☆✔✖]/gu, "")
    .replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, "");
  const folded = stripped
    .split("")
    .map((ch) => PDF_FOLD_MAP[ch] ?? ch)
    .join("");
  return folded.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// PDF-safe cell text: normalize, strip emoji, normalize letter spacing
// (collapse double spaces), then pre-split unbroken runs so nothing clips
// at the page edge. Storage/display text is never changed — callers pass
// the app string through this only for PDF output.
export function pdfCellText(value: string | null | undefined, limit = 20): string {
  return wrapLongWords(stripEmojiForPdf(cleanExportText(value)), limit);
}

// Chunk any word longer than `limit` chars into "\n"-joined pieces.
// Splits on spaces first so existing words and line breaks are preserved;
// characters are never added or removed, only break hints inserted.
export function wrapLongWords(value: string | null | undefined, limit = 40): string {
  if (value == null) return "";
  const text = String(value);
  if (text.length === 0) return "";
  return text
    .split(" ")
    .map((word) => {
      if (word.length <= limit) return word;
      const chunks: string[] = [];
      for (let i = 0; i < word.length; i += limit) chunks.push(word.slice(i, i + limit));
      return chunks.join("\n");
    })
    .join(" ");
}
