"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import NotificationBell from "./NotificationBell";

export default function AdminTopBar() {
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;
  return null;
}


export function AdminSidebar() {
  return <SidebarInner />;
}

function SidebarInner() {
  const pathname = usePathname();
  const isBookings = pathname?.startsWith("/admin/bookings");
  const isAgents = pathname?.startsWith("/admin/agents");
  return (
    <aside className="w-[260px] shrink-0 bg-[var(--forest-900)] text-white flex flex-col min-h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-white/10">
        <Link href="/admin/bookings" className="block">
          <span className="font-serif text-[22px] tracking-tight text-white">Belgrove <span className="text-[var(--gold-400)]">Homes</span></span>
          <span className="block text-[10px] tracking-[0.18em] uppercase text-white/60 -mt-1">Admin</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-6 space-y-1">
        <Link
          href="/admin/bookings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${isBookings ? "bg-white/10 text-white font-medium" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
        >
          <span className="h-7 w-7 rounded-md bg-white/10 grid place-items-center text-xs">▦</span>
          Bookings
        </Link>
        <Link
          href="/admin/agents"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${isAgents ? "bg-white/10 text-white font-medium" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
        >
          <span className="h-7 w-7 rounded-md bg-white/10 grid place-items-center text-xs">◈</span>
          Agents
        </Link>
      </nav>
      <div className="px-3 py-4 border-t border-white/10 flex items-center justify-between">
        <NotificationBell />
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="text-xs text-white/60 hover:text-white border border-white/20 rounded-full px-3 py-1.5"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
