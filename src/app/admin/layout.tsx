"use client";

import { usePathname } from "next/navigation";
import AdminTopBar, { AdminSidebar } from "@/components/admin/AdminTopBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-[var(--ops-bg)]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopBar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
