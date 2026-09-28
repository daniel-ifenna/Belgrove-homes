import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { formatNaira } from "@/lib/currency";
import { formatDisplayName } from "@/lib/formatName";

export const dynamic = "force-dynamic";

// Admin-only receipt view by ref. The client-facing URL is /r/{accessToken};
// this page requires an internal session and never serves anonymous traffic.
export default async function AdminReceiptRefPage({ params }: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");

  const { ref } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { ref },
    include: { payment: { select: { id: true, status: true, amount: true } } },
  });

  if (!receipt) {
    return (
      <div className="min-h-screen bg-[#F7F2E7] flex items-center justify-center px-6 py-12">
        <div className="bg-white border border-[#E4DCC7] rounded-xl p-8 max-w-[560px] w-full text-center">
          <h1 className="fraunces text-[22px] text-[#16281F]">Receipt not found</h1>
          <p className="public text-[13px] text-[#6B6656] mt-2">No receipt with reference <span className="font-mono font-medium text-[#16281F]">{ref}</span>.</p>
          <Link href="/admin/receipts" className="mt-6 inline-flex mono text-[12px] bg-[#16281F] text-[#F5EFE2] px-6 py-2.5 rounded-full">All receipts</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F2E7] py-8 px-6">
      <div className="max-w-[800px] mx-auto bg-white border border-[#E4DCC7] rounded-xl overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b border-[#E4DCC7]">
          <div className="mono text-[11px] tracking-wide uppercase text-[#6B6656]">Admin view · receipt</div>
          <h1 className="fraunces text-[28px] font-bold text-[#16281F] mt-1">{receipt.ref}</h1>
          <div className="public text-[14px] font-semibold text-[#16281F] mt-2">{formatDisplayName(receipt.customerName)}</div>
          <div className="mono text-[12px] text-[#6B6656]">{receipt.customerEmail}</div>
          <div className="mono text-[12px] text-[#6B6656] mt-1">{receipt.property}</div>
          <div className="fraunces text-[20px] font-bold text-[#16281F] mt-3">{formatNaira(receipt.finalAmount)}</div>
          <div className="mono text-[11px] text-[#6B6656] mt-1">Status: {receipt.status} · Payment: {receipt.payment?.status ?? "—"}</div>
        </div>
        <div className="px-8 py-6 flex flex-wrap gap-3">
          <a href={`/api/admin/receipts/${receipt.ref}/pdf`} className="mono text-[11px] bg-[#16281F] text-[#F5EFE2] px-4 py-2 rounded-full">Download PDF</a>
          <Link href={`/admin/receipts/${receipt.id}`} className="mono text-[11px] bg-white border border-[#E4DCC7] px-4 py-2 rounded-full">Open in admin</Link>
        </div>
      </div>
    </div>
  );
}
