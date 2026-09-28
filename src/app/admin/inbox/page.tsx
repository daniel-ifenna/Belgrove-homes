import Link from "next/link";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { getActionCounts, getActionItems, INBOX_CATEGORIES, type InboxCategory } from "@/lib/inbox";
import { showTestFromParams } from "@/lib/test-data";
import TestDataToggle from "@/components/admin/TestDataToggle";

export const dynamic = "force-dynamic";

type SearchParams = { category?: string; showTest?: string };

export default async function InboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const params = await searchParams;
  const showTest = showTestFromParams(params);
  const active = (params.category as InboxCategory | undefined) ?? null;

  const [items, counts] = await Promise.all([
    getActionItems({ includeTest: showTest }),
    getActionCounts({ includeTest: showTest }),
  ]);
  const visible = active ? items.filter((i) => i.category === active) : items;
  const toggleHref = showTest ? "/admin/inbox" + (active ? `?category=${active}` : "") : "/admin/inbox?showTest=1" + (active ? `&category=${active}` : "");

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">
              Action inbox{counts.total > 0 ? ` · ${counts.total}` : ""}
            </h1>
            <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">
              Live work queue — items clear themselves once handled. No dismiss buttons.
            </p>
          </div>
          <TestDataToggle href={toggleHref} showing={showTest} />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <Link
            href={`/admin/inbox${showTest ? "?showTest=1" : ""}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${!active ? "bg-[var(--ops-primary)] text-white border-[var(--ops-primary)]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)]"}`}
          >
            All · {counts.total}
          </Link>
          {INBOX_CATEGORIES.map((c) => (
            <Link
              key={c.category}
              href={`/admin/inbox?category=${c.category}${showTest ? "&showTest=1" : ""}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active === c.category ? "bg-[var(--ops-primary)] text-white border-[var(--ops-primary)]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)] hover:border-[var(--ops-border-strong)]"}`}
            >
              {c.label} · {counts.byCategory[c.category]}
            </Link>
          ))}
        </div>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
          {visible.length === 0 ? (
            <p className="public text-[14px] text-[var(--ops-muted)] px-5 py-12 text-center">You&apos;re all caught up.</p>
          ) : (
            <div className="divide-y divide-[var(--ops-border)]/60">
              {visible.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[rgba(28,43,32,0.03)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="row-lead font-mono text-[12px] font-medium text-[var(--ops-primary)]">{item.ref}</span>
                      <span className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">{item.age}</span>
                    </div>
                    <div className="text-[13px] font-medium text-[var(--ops-text)] leading-tight break-all">{item.title}</div>
                    <div className="text-[12px] text-[var(--ops-muted)] break-all">{item.subtitle}</div>
                  </div>
                  <Link
                    href={item.href}
                    className="shrink-0 mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium hover:bg-[var(--ops-deep)] transition-colors"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
