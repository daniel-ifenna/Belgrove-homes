"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BELGROVE_PLOTS } from "@/lib/belgroveData";
import { formatNaira } from "@/lib/currency";

type Plan = { id: string; code: string; name: string; durationMonths: number; interestRate: any; interestMethod: string; initialPaymentPercentage: number; remainingInstallments: number };
type Agent = { id: string; name: string; category: string };
type BookingOpt = { id: string; ref: string; name: string; email: string; phone: string | null; location: string; estate: string | null; plotCode: string | null; unitPrice: number | null; plotQuantity: number | null; sqm: number | null };

export default function NewTransactionForm({ plans, agents, bookings, initialBookingId }: { plans: Plan[]; agents: Agent[]; bookings: BookingOpt[]; initialBookingId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bookingId, setBookingId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [estate, setEstate] = useState("");
  const [plotId, setPlotId] = useState("");
  const [unitType, setUnitType] = useState("");
  const [sqm, setSqm] = useState("");
  const [plotCode, setPlotCode] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [plotQuantity, setPlotQuantity] = useState("1");

  const [paymentPlanCode, setPaymentPlanCode] = useState(plans[0]?.code ?? "OUTRIGHT");
  const [agentId, setAgentId] = useState("");

  const [initialAmount, setInitialAmount] = useState("");
  const [initialDate, setInitialDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialMethod, setInitialMethod] = useState("Bank Transfer");
  const [withInitialPayment, setWithInitialPayment] = useState(true);

  // Confirm-Form-Completed handoff: ?bookingId= preselects and locks
  // booking-known fields (read-only unless explicitly unlinked).
  const bookingLinked = bookingId !== "";
  const linkedBooking = bookingLinked ? bookings.find((x) => x.id === bookingId) : undefined;
  useEffect(() => {
    if (initialBookingId && bookings.some((x) => x.id === initialBookingId)) {
      onBookingSelect(initialBookingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBookingId]);

  const estates = useMemo(() => [...new Set(BELGROVE_PLOTS.map((p) => p.estate))], []);
  const plotsForEstate = useMemo(() => (estate ? BELGROVE_PLOTS.filter((p) => p.estate === estate) : []), [estate]);
  const selectedPlan = useMemo(() => plans.find((p) => p.code === paymentPlanCode) ?? plans[0], [paymentPlanCode, plans]);

  const unitPriceNum = parseInt(unitPrice.replace(/[^0-9]/g, ""), 10) || 0;
  const qtyNum = parseInt(plotQuantity, 10) || 1;
  const baseAmount = unitPriceNum * qtyNum;
  const interestRate = Number(selectedPlan?.interestRate ?? 0);
  const interestAmount = selectedPlan?.interestMethod === "ONE_TIME_PERCENTAGE" ? Math.round((baseAmount * interestRate) / 100) : 0;
  const totalPayable = baseAmount + interestAmount;
  const initialSuggested = Math.round((totalPayable * (selectedPlan?.initialPaymentPercentage ?? 100)) / 100);
  const initAmtNum = parseInt(initialAmount.replace(/[^0-9]/g, ""), 10) || 0;

  function onBookingSelect(id: string) {
    setBookingId(id);
    const b = bookings.find((x) => x.id === id);
    if (b) {
      setCustomerName(b.name);
      setCustomerEmail(b.email);
      setCustomerPhone(b.phone ?? "");
      if (b.unitPrice) setUnitPrice(String(b.unitPrice));
      if (b.plotQuantity) setPlotQuantity(String(b.plotQuantity));
      if (b.sqm) setSqm(String(b.sqm));
      if (b.estate) {
        setEstate(b.estate);
        const plot = BELGROVE_PLOTS.find((p) => p.code === b.plotCode);
        if (plot) {
          setPlotId(plot.id);
          setUnitType(plot.unitType ?? "");
          setSqm(String(plot.size));
          setPlotCode(plot.code);
          if (!b.unitPrice && plot.price) setUnitPrice(String(plot.price));
        }
      }
    } else {
      setCustomerName("");
      setCustomerEmail("");
    }
  }
  function onUnlinkBooking() {
    // Keep values, unlock for manual edit
    setBookingId("");
  }
  function onEstateChange(v: string) {
    setEstate(v);
    setPlotId("");
    setUnitType("");
    setSqm("");
    setPlotCode("");
  }
  function onPlotChange(id: string) {
    setPlotId(id);
    const p = BELGROVE_PLOTS.find((x) => x.id === id);
    if (p) {
      setUnitType(p.unitType ?? "");
      setSqm(String(p.size));
      setPlotCode(p.code);
      setUnitPrice(String(p.price ?? ""));
    }
  }

  const canSubmit = customerName.trim() && customerEmail.trim() && estate.trim() && unitPriceNum > 0 && qtyNum > 0 && selectedPlan;

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || null,
          estate: estate.trim(),
          plotCode: plotCode.trim() || null,
          unitType: unitType.trim() || null,
          sqm: sqm ? Number(sqm) : null,
          plotQuantity: qtyNum,
          unitPrice: unitPriceNum,
          paymentPlanCode,
          bookingId: bookingId || undefined,
          agentId: agentId || undefined,
          initialPayment: withInitialPayment && initAmtNum > 0 ? { amount: initAmtNum, paymentDate: initialDate, paymentMethod: initialMethod } : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create transaction");
      router.push(`/admin/transactions/${data.transaction.id}`);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>}

      <div className="bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
        <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Link existing booking (optional)</h2>
        {bookingLinked && linkedBooking ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--ops-bg)] border border-[var(--ops-border)] px-3 py-2.5">
            <span className="text-[13px] text-[var(--ops-text)]">
              <span className="font-mono font-medium text-[var(--ops-primary)]">{linkedBooking.ref}</span>
              <span className="text-[var(--ops-muted)]"> · {linkedBooking.name} — client & property locked from booking</span>
            </span>
            <button type="button" onClick={onUnlinkBooking} className="mono text-[11px] text-[var(--ops-muted)] underline underline-offset-4 hover:text-[var(--ops-text)]">
              Unlink — manual entry
            </button>
          </div>
        ) : (
          <>
            <select value={bookingId} onChange={(e) => onBookingSelect(e.target.value)} className="mt-2 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">— Manual — no booking —</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.ref} · {b.name} · {b.email} {b.estate ? `· ${b.estate}` : ""}
                </option>
              ))}
            </select>
            <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">If selected, client/property auto-fills and transaction will be linked to that booking.</p>
          </>
        )}
      </div>

      <div className="bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
        <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Client{bookingLinked ? " — from booking (read-only)" : ""}</h2>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Full name *</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} readOnly={bookingLinked} placeholder="Daniel Ifenna Daniel" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm read-only:bg-[var(--ops-bg)] read-only:text-[var(--ops-muted)]" /></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Email *</label><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} readOnly={bookingLinked} placeholder="daniel@example.com" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm read-only:bg-[var(--ops-bg)] read-only:text-[var(--ops-muted)]" /></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Phone</label><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} readOnly={bookingLinked} placeholder="+234 ..." className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm read-only:bg-[var(--ops-bg)] read-only:text-[var(--ops-muted)]" /></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Agent</label><select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white"><option value="">— None —</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.category}</option>)}</select></div>
        </div>
      </div>

      <div className="bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
        <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Property{bookingLinked ? " — from booking (read-only)" : ""}</h2>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Estate *</label><select value={estate} onChange={(e) => onEstateChange(e.target.value)} disabled={bookingLinked} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white disabled:bg-[var(--ops-bg)] disabled:text-[var(--ops-muted)]"><option value="">Select estate…</option>{estates.map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Plot / Unit</label><select value={plotId} onChange={(e) => onPlotChange(e.target.value)} disabled={!estate || bookingLinked} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white disabled:opacity-50"><option value="">— Select plot —</option>{plotsForEstate.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.unitType} · {p.size}sqm · {formatNaira(p.price ?? 0)}</option>)}</select></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Property name</label><input value={estate} onChange={(e) => setEstate(e.target.value)} readOnly={bookingLinked} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm read-only:bg-[var(--ops-bg)] read-only:text-[var(--ops-muted)]" /></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Unit type</label><input value={unitType} onChange={(e) => setUnitType(e.target.value)} readOnly={bookingLinked} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm read-only:bg-[var(--ops-bg)] read-only:text-[var(--ops-muted)]" /></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Size sqm</label><input type="number" value={sqm} onChange={(e) => setSqm(e.target.value)} readOnly={bookingLinked} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm read-only:bg-[var(--ops-bg)] read-only:text-[var(--ops-muted)]" /></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">SKU</label><input value={plotCode} onChange={(e) => setPlotCode(e.target.value)} readOnly={bookingLinked} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm read-only:bg-[var(--ops-bg)] read-only:text-[var(--ops-muted)]" /></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Unit Price (₦) *</label><input inputMode="numeric" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" placeholder="33200000" /></div>
          <div><label className="mono text-[11px] text-[var(--ops-muted)]">Plot Qty *</label><input type="number" min={1} value={plotQuantity} onChange={(e) => setPlotQuantity(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" /></div>
        </div>
        <div className="mt-4 bg-[#16281F] rounded-xl p-4 text-white flex flex-wrap gap-4">
          <div><div className="mono text-[10px] uppercase text-[#D4B368]">Base Amount</div><div className="price fraunces text-[14px] font-bold">{formatNaira(baseAmount)}</div><div className="mono text-[10px] text-white/60">= {formatNaira(unitPriceNum)} × {qtyNum}</div></div>
          <div><div className="mono text-[10px] uppercase text-[#D4B368]">Interest ({interestRate}%)</div><div className="price fraunces text-[14px] font-bold">{formatNaira(interestAmount)}</div></div>
          <div><div className="mono text-[10px] uppercase text-white">Total Payable</div><div className="price fraunces text-[16px] font-bold">{formatNaira(totalPayable)}</div></div>
        </div>
      </div>

      <div className="bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
        <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Payment Plan</h2>
        <div className="mt-3 grid md:grid-cols-3 gap-3">
          {plans.map((p) => {
            const active = paymentPlanCode === p.code;
            return (
              <button key={p.code} type="button" onClick={() => setPaymentPlanCode(p.code)} className={`text-left border rounded-xl p-4 ${active ? "bg-[#16281F] text-white border-[#16281F]" : "bg-white border-[var(--ops-border)] hover:bg-[var(--ops-bg)]"}`}>
                <div className="font-medium text-[13px]">{p.name}</div>
                <div className={`mono text-[11px] mt-1 ${active ? "text-[#D4B368]" : "text-[var(--ops-muted)]"}`}>{p.durationMonths === 0 ? "One-time" : `${p.durationMonths} months`} · {Number(p.interestRate) > 0 ? `${Number(p.interestRate)}%` : "0%"} · {p.initialPaymentPercentage}% initial · {p.remainingInstallments} × monthly</div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-xl p-3 mono text-[11px] text-[var(--ops-muted)]">
          Selected: <span className="font-medium text-[var(--ops-text)]">{selectedPlan?.name}</span> — Initial {selectedPlan?.initialPaymentPercentage}% ({formatNaira(Math.round((totalPayable * (selectedPlan?.initialPaymentPercentage ?? 0)) / 100))}) + {selectedPlan?.remainingInstallments} monthly of ~{selectedPlan?.remainingInstallments ? formatNaira(Math.floor((totalPayable - Math.round((totalPayable * (selectedPlan?.initialPaymentPercentage ?? 0)) / 100)) / selectedPlan.remainingInstallments)) : "—"}
        </div>
      </div>

      <div className="bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={withInitialPayment} onChange={(e) => setWithInitialPayment(e.target.checked)} className="rounded" />
          <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Record initial payment now (optional)</h2>
        </div>
        {withInitialPayment && (
          <div className="mt-4 grid md:grid-cols-3 gap-4">
            <div><label className="mono text-[11px] text-[var(--ops-muted)]">Amount received (₦) *</label><input inputMode="numeric" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} placeholder={String(Math.round((totalPayable * (selectedPlan?.initialPaymentPercentage ?? 0)) / 100) || totalPayable)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" /></div>
            <div><label className="mono text-[11px] text-[var(--ops-muted)]">Payment date *</label><input type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" /></div>
            <div><label className="mono text-[11px] text-[var(--ops-muted)]">Method</label><select value={initialMethod} onChange={(e) => setInitialMethod(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white"><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>POS</option></select></div>
          </div>
        )}
        {withInitialPayment && <p className="mono text-[11px] text-[var(--ops-muted)] mt-2">If provided, transaction, schedule, first payment and first receipt will be created together. Otherwise transaction is created as ACTIVE with pending schedule.</p>}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={!canSubmit || busy} className="text-sm bg-[var(--ops-primary)] text-white rounded-full px-8 py-3 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50">{busy ? "Creating…" : withInitialPayment && initialAmount ? "Create Transaction & Record Payment" : "Create Transaction"}</button>
      </div>
    </div>
  );
}
