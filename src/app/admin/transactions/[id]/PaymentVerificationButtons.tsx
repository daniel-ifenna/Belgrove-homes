"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Confirm / void controls for a pending payment. Confirming runs the atomic
// unit: payment → receipt → totals → client email. Voiding is only possible
// while pending — confirmed payments are immutable.
export default function PaymentVerificationButtons({
  transactionId,
  paymentId,
  allowConfirm = true,
}: {
  transactionId: string;
  paymentId: string;
  allowConfirm?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "void" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptRef, setReceiptRef] = useState<string | null>(null);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  async function doConfirm() {
    setBusy("confirm");
    setError(null);
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Confirm failed");
      if (data.receipt?.ref) setReceiptRef(data.receipt.ref);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setBusy(null);
    }
  }

  async function doVoid() {
    setBusy("void");
    setError(null);
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/payments/${paymentId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Void failed");
      setShowVoid(false);
      setVoidReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Void failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2">
      {error && <div className="mb-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">{error}</div>}
      {receiptRef && (
        <div className="mb-2 text-[11px] text-[#1F6B3E] bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-2.5 py-1.5">
          Confirmed — receipt <Link href={`/admin/receipts`} className="font-mono underline underline-offset-2">{receiptRef}</Link> issued and emailed.
        </div>
      )}
      {!showVoid ? (
        <div className="flex flex-wrap gap-1.5">
          {allowConfirm && (
            <button
              onClick={doConfirm}
              disabled={busy !== null}
              className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-3.5 py-1.5 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50 transition-colors"
            >
              {busy === "confirm" ? "Confirming…" : "Confirm & issue receipt"}
            </button>
          )}
          <button
            onClick={() => {
              if (!allowConfirm && !confirm("Void this CONFIRMED payment? Its amount will be subtracted from the installment and totals. The receipt stays on file for audit.")) return;
              setShowVoid(true);
            }}
            disabled={busy !== null}
            className="mono text-[11px] bg-white border border-[var(--ops-border)] text-[var(--ops-muted)] rounded-full px-3.5 py-1.5 hover:text-[var(--ops-text)] disabled:opacity-50 transition-colors"
          >
            {allowConfirm ? "Void" : "Void & reverse totals"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 min-w-[140px] border border-[var(--ops-border)] rounded-full px-3 py-1.5 text-[12px] bg-white"
          />
          <button
            onClick={doVoid}
            disabled={busy !== null}
            className="mono text-[11px] bg-[#A6402F] text-white rounded-full px-3.5 py-1.5 font-medium disabled:opacity-50"
          >
            {busy === "void" ? "Voiding…" : "Confirm void"}
          </button>
          <button onClick={() => setShowVoid(false)} className="mono text-[11px] text-[var(--ops-muted)] underline underline-offset-4">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
