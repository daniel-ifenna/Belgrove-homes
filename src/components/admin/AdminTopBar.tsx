"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import NotificationBell from "./NotificationBell";
import { useState } from "react";

export default function AdminTopBar() {
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;
  return <TopBarInner />;
}

function TopBarInner() {
  const router = useRouter();
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

  const nav = [
    { href: "/admin/bookings", label: "Dashboard", icon: DashboardIcon, active: false },
    { href: "/admin/bookings", label: "Bookings", icon: BookingsIcon, active: isActive("/admin/bookings") },
    { href: "/admin/agents", label: "Agents", icon: AgentsIcon, active: isActive("/admin/agents") },
  ];

  return (
    <aside className="w-[252px] shrink-0 bg-[var(--ops-deep)] text-white flex flex-col min-h-screen sticky top-0 border-r border-white/[0.06]">
      <div className="px-6 pt-7 pb-6">
        <Link href="/admin/bookings" className="block">
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-[22px] tracking-[-0.02em] text-white font-semibold">Belgrove</span>
            <span className="font-serif text-[22px] tracking-[-0.02em] text-[var(--ops-gold)] font-semibold">Homes</span>
          </div>
          <span className="block mono text-[10px] tracking-[0.18em] uppercase text-white/40 -mt-1">Operations</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.active;
          const disabled = (item as any).disabled;
          if (disabled) {
            return (
              <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] text-white/30 cursor-not-allowed">
                <span className="h-8 w-8 rounded-[9px] bg-white/[0.04] border border-white/[0.04] grid place-items-center shrink-0">
                  <Icon active={false} dim />
                </span>
                <span className="font-medium">{item.label}</span>
                <span className="ml-auto text-[10px] tracking-wide uppercase bg-white/[0.06] border border-white/5 rounded-full px-1.5 py-0.5">Soon</span>
              </div>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] transition-colors ${active ? "bg-white text-[var(--ops-primary)] font-medium shadow-sm" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
            >
              <span className={`h-8 w-8 rounded-[9px] grid place-items-center shrink-0 border ${active ? "bg-[var(--ops-primary)] text-white border-transparent" : "bg-white/[0.06] border-white/5 text-white/70"}`}>
                <Icon active={active} />
              </span>
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--ops-gold)]" />}
            </Link>
          );
        })}
      </nav>
    </aside>
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
