"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import NotificationBell from "./NotificationBell";
import { useState, useEffect } from "react";
import { formatCompactNaira } from "@/lib/currency";

export default function AdminTopBar() {
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;
  return <TopBarInner />;
}

function TopBarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const userName = "Admin";
  const userRole = "Operations";
  const initials = userName.split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    params.delete("page");
    router.push(`/admin/bookings?${params.toString()}`);
  }

  return (
    <header className="h-[64px] bg-[var(--ops-surface)] border-b border-[var(--ops-border)] flex items-center gap-4 px-6 sticky top-0 z-20">
      {/* Global Search */}
      <form onSubmit={onSearch} className="flex-1 max-w-[640px] relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ops-muted)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, reference..."
          className="w-full bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-full pl-10 pr-4 py-2.5 text-[13px] placeholder:text-[var(--ops-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10 focus:border-[var(--ops-primary)]/20 transition-colors"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1">
          <span className="text-[11px] tracking-wide uppercase text-[var(--ops-muted)] bg-white border border-[var(--ops-border)] rounded-md px-1.5 py-0.5">↵</span>
        </span>
      </form>

      <div className="flex items-center gap-3 ml-auto">
        {/* Quick action — one consistent create location, contextual primary */}
        <QuickActionSplit pathname={pathname} />

        <div className="h-6 w-px bg-[var(--ops-border)] hidden sm:block" />

        {/* Notifications — light theme */}
        <div className="h-8 w-8 rounded-full bg-[var(--ops-bg)] border border-[var(--ops-border)] grid place-items-center text-[var(--ops-muted)] hover:bg-white hover:border-[var(--ops-border-strong)] transition-colors">
          <NotificationBellLight />
        </div>

        <div className="h-6 w-px bg-[var(--ops-border)] hidden sm:block" />

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[var(--ops-primary)] text-white grid place-items-center text-[12px] font-medium">
            {initials}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <div className="text-[13px] font-medium text-[var(--ops-text)] leading-none">{userName}</div>
            <div className="text-[11px] tracking-wide uppercase text-[var(--ops-muted)] capitalize">{userRole}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="hidden lg:inline-flex items-center gap-1.5 text-[12px] text-[var(--ops-muted)] hover:text-[var(--ops-text)] border border-[var(--ops-border)] rounded-full px-3 py-1.5 bg-white hover:bg-[var(--ops-bg)] transition-colors ml-1"
          >
            <span>Sign out</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

// Right-aligned quick-action split button: contextual primary create plus a
// caret dropdown for the other common creates — one predictable location.
function QuickActionSplit({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  const creates = [
    { label: "New Booking", href: "/book-inspection" },
    { label: "New Transaction", href: "/admin/transactions/new" },
    { label: "Add Agent", href: "/admin/agents" },
  ];

  const primary = pathname.startsWith("/admin/transactions")
    ? creates[1]
    : pathname.startsWith("/admin/agents")
      ? creates[2]
      : creates[0];

  const others = creates.filter((c) => c.href !== primary.href);

  return (
    <div className="relative hidden md:block">
      <div className="flex items-stretch rounded-full overflow-hidden bg-[var(--ops-primary)] shadow-sm">
        <Link
          href={primary.href}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white pl-4 pr-3 py-2 hover:bg-[var(--ops-deep)] transition-colors"
        >
          <span className="text-[15px] leading-none">+</span> {primary.label.replace(/^(New|Add) /, "")}
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          onBlur={(e) => {
            if (!e.currentTarget.parentElement?.parentElement?.contains(e.relatedTarget as Node)) setOpen(false);
          }}
          aria-label="More create actions"
          aria-expanded={open}
          className="px-2.5 text-white/80 hover:text-white hover:bg-[var(--ops-deep)] border-l border-white/15 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[var(--ops-border)] rounded-xl shadow-[var(--ops-shadow-md)] p-1.5 z-30">
          <div className="mono text-[10px] tracking-[0.1em] uppercase text-[var(--ops-muted)] px-3 pt-2 pb-1">Create</div>
          {others.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[var(--ops-text)] hover:bg-[var(--ops-bg)] transition-colors"
            >
              <span className="text-[var(--ops-muted)] text-[14px] leading-none">+</span> {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Light-theme wrapper for existing NotificationBell to avoid dark styles leaking
function NotificationBellLight() {
  // Reuse existing logic but override styles via CSS
  return (
    <div className="[&>div>button]:!text-[var(--ops-muted)] [&>div>button]:!bg-transparent [&_span.bg-white\/10]:!bg-transparent">
      <NotificationBell />
    </div>
  );
}

export function AdminSidebar() {
  return <SidebarInner />;
}

function SidebarInner() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const groups: { label: string; items: { href: string; label: string; icon: React.ComponentType<{ active?: boolean; dim?: boolean }>; active: boolean }[] }[] = [
    {
      label: "Overview",
      items: [{ href: "/admin", label: "Dashboard", icon: DashboardIcon, active: pathname === "/admin" }],
    },
    {
      label: "Sales",
      items: [
        { href: "/admin/bookings", label: "Bookings", icon: BookingsIcon, active: isActive("/admin/bookings") },
        { href: "/admin/transactions", label: "Transactions", icon: TransactionsIcon, active: isActive("/admin/transactions") },
        { href: "/admin/payments", label: "Payments", icon: PaymentsIcon, active: isActive("/admin/payments") },
        { href: "/admin/receipts", label: "Receipts", icon: ReceiptsIcon, active: isActive("/admin/receipts") },
        { href: "/admin/inspections", label: "Completed Inspections", icon: InspectionsIcon, active: isActive("/admin/inspections") },
      ],
    },
    {
      label: "Team",
      items: [{ href: "/admin/agents", label: "Agents", icon: AgentsIcon, active: isActive("/admin/agents") }],
    },
  ];

  return (
    <aside className="w-[252px] shrink-0 bg-[var(--ops-deep)] text-white flex flex-col h-screen sticky top-0 border-r border-white/[0.06]">
      <div className="px-6 pt-7 pb-6">
        <Link href="/admin" className="block">
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-[22px] tracking-[-0.02em] text-white font-semibold">Belgrove</span>
            <span className="font-serif text-[22px] tracking-[-0.02em] text-[var(--ops-gold)] font-semibold">Homes</span>
          </div>
          <span className="block mono text-[10px] tracking-[0.18em] uppercase text-white/40 -mt-1">Operations</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-5 overflow-y-auto pb-4">
        {groups.map((group, gi) => (
          <div key={group.label}>
            <div
              className={`mono text-[11px] tracking-[0.08em] uppercase text-white/40 px-3 mb-3 ${gi > 0 ? "mt-5" : ""}`}
            >
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.active;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] transition-colors min-h-[44px] ${active ? "bg-white text-[var(--ops-primary)] font-medium shadow-sm" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
                  >
                    <span className={`h-8 w-8 rounded-[9px] grid place-items-center shrink-0 border ${active ? "bg-[var(--ops-primary)] text-white border-transparent" : "bg-white/[0.06] border-white/5 text-white/70"}`}>
                      <Icon active={active} />
                    </span>
                    {item.label}
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--ops-gold)]" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <MonthlyTargetWidget />
    </aside>
  );
}

function MonthlyTargetWidget() {
  const [data, setData] = useState<{ soldThisMonth: number; goal: number; pct: number } | null>(null);
  const searchParams = useSearchParams();
  const showTest = searchParams.get("showTest") === "1";

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/admin/summary${showTest ? "?showTest=1" : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j && typeof j.soldThisMonth === "number") setData(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showTest]);

  return (
    <div className="px-3 pb-5">
      <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.04] p-4">
        <div className="mono text-[11px] tracking-[0.08em] uppercase text-white/40">Monthly target</div>
        <div className="mt-2 font-mono text-[15px] font-medium text-white price">
          {data ? (
            <>
              {formatCompactNaira(data.soldThisMonth)}{" "}
              <span className="text-white/40 text-[12px] font-normal">of {formatCompactNaira(data.goal)}</span>
            </>
          ) : (
            <span className="text-white/40">—</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-end">
          <span className="mono text-[11px] text-white/60">{data ? `${data.pct}%` : "—"}</span>
        </div>
        <div className="mt-1.5 h-[6px] rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--ops-gold)] transition-[width] duration-500"
            style={{ width: `${data ? data.pct : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Thin-line icons 1.5px
function DashboardIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : active ? "white" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}
function BookingsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : active ? "white" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}
function PropertiesIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10L12 3l9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10Z" /><path d="M9 21V12h6v9" />
    </svg>
  );
}
function ClientsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="3.5" /><path d="M16 8a3 3 0 0 1 2.8 2M20 21v-2a5 5 0 0 0-3-4.5" />
    </svg>
  );
}
function AgentsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : active ? "white" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M12 12v4" />
    </svg>
  );
}
function InspectionsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : active ? "white" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </svg>
  );
}
function ReceiptsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : active ? "white" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function TransactionsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : active ? "white" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}
function PaymentsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : active ? "white" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}
function ReportsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3Z" /><path d="M8 13l3 3 5-6" />
    </svg>
  );
}
function SettingsIcon({ active, dim }: { active?: boolean; dim?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dim ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}
