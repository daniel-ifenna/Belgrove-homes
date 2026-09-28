"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatNaira } from "@/lib/currency";

// Confirm / void controls for a payment. Confirming runs the atomic
// unit: payment → receipt → totals → client email (queued). Voiding a pending
// payment cancels it; voiding a confirmed one reverses totals (receipt stays
// on file for audit). Both actions confirm through a dialog stating amount,
// installment and effect on totals.
export default function PaymentVerificationButtons({
  transactionId,
  paymentId,
  allowConfirm = true,
  payment,
  totals,
}: {
  transactionId: string;
  paymentId: string;
  allowConfirm?: boolean;
  payment?: { amount: number; installmentLabel: string };
  totals?: { totalPaid: number; totalPayable: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "void" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptRef, setReceiptRef] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const afterConfirm = totals && payment ? totals.totalPaid + payment.amount : null;
  const afterOutstanding =
    totals && payment ? totals.totalPayable - totals.totalPaid - payment.amount : null;

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
      setShowConfirm(false);
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
      {!showConfirm && !showVoid ? (
        <div className="flex flex-wrap gap-1.5">
          {allowConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={busy !== null}
              className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-3.5 py-1.5 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50 transition-colors"
            >
              Confirm & issue receipt
            </button>
          )}
          <button
            onClick={() => setShowVoid(true)}
            disabled={busy !== null}
            className="mono text-[11px] bg-white border border-[var(--ops-border)] text-[var(--ops-muted)] rounded-full px-3.5 py-1.5 hover:text-[var(--ops-text)] disabled:opacity-50 transition-colors"
          >
            {allowConfirm ? "Void" : "Void & reverse totals"}
          </button>
        </div>
      ) : null}
      {showConfirm && (
        <div className="rounded-xl border border-[var(--ops-border)] bg-white p-3 text-[12px]">
          <div className="font-medium text-[var(--ops-text)]">Confirm this payment?</div>
          {payment && (
            <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">
              {formatNaira(payment.amount)} · {payment.installmentLabel}
              {afterConfirm !== null && afterOutstanding !== null && totals && (
                <> · Total paid {formatNaira(totals.totalPaid)} → {formatNaira(afterConfirm)}, outstanding {formatNaira(totals.totalPayable - totals.totalPaid)} → {formatNaira(afterOutstanding)}</>
              )}
            </div>
          )}
          <div className="mt-1 mono text-[11px] text-[var(--ops-muted)]">A receipt is issued and emailed on confirm.</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={doConfirm}
              disabled={busy !== null}
              className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-3.5 py-1.5 font-medium disabled:opacity-50"
            >
              {busy === "confirm" ? "Confirming…" : "Yes, confirm"}
            </button>
            <button onClick={() => setShowConfirm(false)} className="mono text-[11px] text-[var(--ops-muted)] underline underline-offset-4">
              Cancel
            </button>
          </div>
        </div>
      )}
      {showVoid && (
        <div className="rounded-xl border border-[var(--ops-border)] bg-white p-3 text-[12px]">
          <div className="font-medium text-[var(--ops-text)]">
            {allowConfirm ? "Void this pending payment?" : "Void this CONFIRMED payment?"}
          </div>
          {payment && (
            <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">
              {formatNaira(payment.amount)} · {payment.installmentLabel}
              {!allowConfirm && " · Its amount will be subtracted from the installment and totals. The receipt stays on file for audit."}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
        </div>
      )}
    </div>
  );
}
