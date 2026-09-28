"use client";

import { useRouter } from "next/navigation";

// Table row that opens its destination on click, while leaving inner links
// (receipt, transaction) to navigate normally.
export default function ClickableRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function onClick(e: React.MouseEvent) {
    // Inner links keep their own destination (e.g. the receipt page).
    if ((e.target as HTMLElement).closest("a,button")) return;
    router.push(href);
  }

  return (
    <tr onClick={onClick} className="hover:bg-[var(--ops-bg)]/50 cursor-pointer">
      {children}
    </tr>
  );
}
