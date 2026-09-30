// Shared wrapping rules for PDF exports (jsPDF + jspdf-autotable).
// autotable's `overflow: "linebreak"` wraps at spaces but lets a long
// unbroken string (email, URL, reference) run past its cell border, so cell
// text additionally goes through wrapLongWords: words longer than the limit
// are pre-split with "\n", which autotable renders as explicit line breaks.
// Nothing is ever truncated — content wraps inside its cell instead.
export const TABLE_OVERFLOW_LINEBREAK = "linebreak" as const;

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
