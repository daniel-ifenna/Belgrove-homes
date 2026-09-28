// Presentation-only name formatter — does not mutate stored DB value.
// DANIEL IFENNA DANIEL → Daniel Ifenna Daniel
// Handles multi-word, hyphenated, apostrophes, mixed case.
export function formatDisplayName(name: string): string {
  if (!name) return name;
  // Trim and collapse whitespace
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  // If name is all uppercase/lowercase, title-case each word. If already mixed case, preserve but normalize.
  return trimmed
    .split(" ")
    .map((word) => {
      if (!word) return word;
      // Handle hyphenated parts: e.g. SMITH-JONES → Smith-Jones
      return word
        .split("-")
        .map((part) => {
          if (!part) return part;
          // Handle apostrophes: O'NEILL → O'Neill
          return part
            .split("'")
            .map((p) => {
              if (!p) return p;
              const lower = p.toLowerCase();
              return lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join("'");
        })
        .join("-");
    })
    .join(" ");
}
