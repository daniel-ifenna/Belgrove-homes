import Link from "next/link";

// Ledger pagination — current page is a solid dark-green filled circle,
// other pages plain numerals, prev/next chevron buttons, and a
// left-aligned "Showing X–Y of Z" label in muted mono.
export default function AdminPagination({
  page,
  totalPages,
  total,
  pageSize,
  basePath,
  query,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  basePath: string;
  query: string;
}) {
  if (totalPages <= 1 && total === 0) return null;

  const hrefFor = (p: number) => {
    const pagePart = p === 1 ? "" : `page=${p}`;
    const qs = [query, pagePart].filter(Boolean).join("&");
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Window of up to 7 page numbers around the current page.
  const windowSize = 7;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const chevron =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ops-border)] bg-white text-[var(--ops-muted)] hover:text-[var(--ops-text)] hover:border-[var(--ops-border-strong)] hover:bg-[var(--ops-bg)] transition-colors disabled:opacity-40 disabled:pointer-events-none";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6">
      <span className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)]">
        Showing {from}–{to} of {total}
      </span>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Pagination">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={chevron} aria-label="Previous page">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
          ) : (
            <span className={chevron} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </span>
          )}
          {start > 1 && (
            <>
              <Link
                href={hrefFor(1)}
                className="min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-full text-[13px] text-[var(--ops-muted)] hover:text-[var(--ops-text)] hover:bg-white transition-colors"
              >
                1
              </Link>
              {start > 2 && <span className="text-[var(--ops-muted)] text-[13px] px-0.5">…</span>}
            </>
          )}
          {pages.map((p) =>
            p === page ? (
              <span
                key={p}
                aria-current="page"
                className="min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-full bg-[var(--ops-primary)] text-white text-[13px] font-medium shadow-sm"
              >
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={hrefFor(p)}
                className="min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-full text-[13px] text-[var(--ops-muted)] hover:text-[var(--ops-text)] hover:bg-white transition-colors"
              >
                {p}
              </Link>
            )
          )}
          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span className="text-[var(--ops-muted)] text-[13px] px-0.5">…</span>}
              <Link
                href={hrefFor(totalPages)}
                className="min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-full text-[13px] text-[var(--ops-muted)] hover:text-[var(--ops-text)] hover:bg-white transition-colors"
              >
                {totalPages}
              </Link>
            </>
          )}
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} className={chevron} aria-label="Next page">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
          ) : (
            <span className={chevron} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
