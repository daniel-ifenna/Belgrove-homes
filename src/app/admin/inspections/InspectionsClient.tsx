"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BELGROVE_PLOTS } from "@/lib/belgroveData";
import { formatNaira } from "@/lib/currency";

type Row = {
  id: string;
  ref: string;
  name: string;
  email: string;
  location: string;
  estate: string | null;
  plotCode: string | null;
  unitType: string | null;
  sqm: number | null;
  sqmNeeded: number | null;
  selectionType: string | null;
  plotQuantity: number | null;
  unitPrice: number | null;
  agent: { name: string; category: string } | null;
  agentName: string | null;
  status: string;
  preferredDate: string;
};

function getPlotPrice(estate: string | null, plotCode: string | null, sqm: number | null): number | null {
  if (!estate) return null;
  const found = BELGROVE_PLOTS.find((p) => p.estate === estate && (p.code === plotCode || p.size === sqm));
  return found?.price ?? null;
}

export default function InspectionsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soldModal, setSoldModal] = useState<Row | null>(null);
  const [unitPrice, setUnitPrice] = useState("");
  const [plotQuantity, setPlotQuantity] = useState("1");
  const [discount, setDiscount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sqmInput, setSqmInput] = useState<string>("");
  const [savingSqm, setSavingSqm] = useState<string | null>(null);

  const totalPrice = useMemo(() => {
    const up = parseInt(unitPrice.replace(/[^0-9]/g, ""), 10) || 0;
    const qty = parseInt(plotQuantity.replace(/[^0-9]/g, ""), 10) || 0;
    return up * qty;
  }, [unitPrice, plotQuantity]);

  async function handleNotSold(row: Row) {
    if (!confirm(`Mark inspection ${row.ref} as Not Sold? This will move it to Closed.`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_outcome", outcome: "not_sold" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to mark Not Sold");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSoldOpen(row: Row) {
    // prefill unitPrice from existing or plot price lookup
    const existingUnitPrice = row.unitPrice ?? getPlotPrice(row.estate, row.plotCode, row.sqm ?? row.sqmNeeded) ?? null;
    setUnitPrice(existingUnitPrice ? String(existingUnitPrice) : "");
    setPlotQuantity(row.plotQuantity ? String(row.plotQuantity) : "1");
    setDiscount("");
    setSoldModal(row);
  }

  async function handleSaveSqm(row: Row) {
    const sqmVal = parseInt(sqmInput.replace(/[^0-9]/g, ""), 10);
    if (!sqmVal || sqmVal < 10) {
      setError("Enter a valid SQM (min 10)");
      return;
    }
    setSavingSqm(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_property",
          sqm: sqmVal,
          sqmNeeded: null,
          selectionType: "unit",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save SQM");
      setSqmInput("");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    } finally {
      setSavingSqm(null);
    }
  }

  async function handleSoldConfirm() {
    if (!soldModal) return;
    const up = parseInt(unitPrice.replace(/[^0-9]/g, ""), 10);
    const qty = parseInt(plotQuantity.replace(/[^0-9]/g, ""), 10) || 1;
    if (!up || up <= 0) {
      setError("Enter a valid Unit Price");
      return;
    }
    if (!qty || qty < 1) {
      setError("Enter a valid Plot Quantity (min 1)");
      return;
    }
    const computedTotal = up * qty;
    const disc = discount ? parseInt(discount.replace(/[^0-9]/g, ""), 10) : 0;
    const totalPaid = computedTotal - (disc || 0);
    if (totalPaid <= 0) {
      setError("Total after discount must be > 0");
      return;
    }
    // ensure sqm is present before sold — block if missing and not yet saved
    if (!soldModal.sqm && !soldModal.sqmNeeded) {
      setError("Complete SQM first — expand the row and save the property size before marking Sold.");
      return;
    }
    setGenerating(true);
    setError(null);
    setBusyId(soldModal.id);
    try {
      // persist unitPrice/qty first for audit
      await fetch(`/api/admin/bookings/${soldModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_property", unitPrice: up, plotQuantity: qty }),
      });
      // Close the booking as sold. Receipts are only ever issued from a
      // confirmed payment, so the next step is the transaction form
      // (prefilled from this booking) — not a direct receipt.
      const res = await fetch(`/api/admin/bookings/${soldModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_outcome", outcome: "sold" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to mark sold");
      const bookingId = soldModal.id;
      setSuccessMsg(`Marked sold — create the transaction to record payments and issue receipts.`);
      setSoldModal(null);
      router.push(`/admin/transactions/new?bookingId=${bookingId}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to mark sold");
    } finally {
      setGenerating(false);
      setBusyId(null);
    }
  }

  return (
    <>
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      {successMsg && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3">{successMsg}</div>}

      <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm admin-table">
            <thead>
              <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left">
                <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Property</th>
                <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Agent</th>
                <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">SQM</th>
                <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Status</th>
                <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ops-border)]/60">
              {rows.map((r) => {
                const hasSqm = !!(r.sqm || r.sqmNeeded);
                const sqmDisplay = r.selectionType === "sqm_needed" && r.sqmNeeded ? `${r.sqmNeeded}sqm requested` : r.sqm ? `${r.sqm}sqm` : r.sqmNeeded ? `${r.sqmNeeded}sqm requested` : "—";
                const sqmTag = r.selectionType === "sqm_needed" ? "Sizing — " + r.sqmNeeded + "sqm requested" : r.plotCode ? "Unit selected" : null;
                const isExpanded = expandedId === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className={`hover:bg-[var(--ops-bg)]/50 cursor-pointer ${isExpanded ? "bg-[var(--ops-bg)]/50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-[var(--ops-text)] leading-tight flex items-center gap-2">
                          {r.estate ?? r.location}
                          <span className={`mono text-[10px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                        </div>
                        <div className="mono text-[11px] text-[var(--ops-muted)]">{r.plotCode ? `${r.plotCode}${r.unitType ? ` · ${r.unitType}` : ""}` : r.location}</div>
                        {sqmTag && <span className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] border font-medium ${sqmTag.startsWith("Sizing") ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"}`}>{sqmTag}</span>}
                        {!hasSqm && <span className="mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] border font-medium bg-amber-50 text-amber-800 border-amber-200">Missing SQM — click to add</span>}
                        <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">{r.ref} · {r.name}</div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {r.agent ? (
                          <div className="flex items-center gap-2">
                            <span className="h-7 w-7 rounded-full bg-[var(--ops-primary)] text-white grid place-items-center text-[10px]">{r.agent.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}</span>
                            <div>
                              <div className="text-[13px] font-medium text-[var(--ops-text)] leading-none">{r.agent.name}</div>
                              <div className="mono text-[10px] text-[var(--ops-muted)]">{r.agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="mono text-[11px] text-[var(--ops-muted)]">{r.agentName ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 mono text-[12px] text-[var(--ops-text)] font-medium">{sqmDisplay}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border bg-[#16281D] text-white border-[#16281D]">Active — awaiting outcome</span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSoldOpen(r)}
                            disabled={!!busyId}
                            className="text-xs bg-[#0D3328] text-white rounded-full px-4 py-1.5 font-medium hover:bg-[#08261E] disabled:opacity-50"
                          >
                            Sold
                          </button>
                          <button
                            onClick={() => handleNotSold(r)}
                            disabled={!!busyId}
                            className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-1.5 font-medium hover:bg-[var(--ops-bg)] disabled:opacity-50"
                          >
                            {busyId === r.id ? "Saving…" : "Not Sold"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.id}-expanded`} className="bg-[#FFFEFB]">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-white border border-[var(--ops-border)] rounded-xl p-4">
                              <div className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Property details</div>
                              <div className="mt-2 space-y-1.5 text-[13px]">
                                <div><span className="mono text-[11px] text-[var(--ops-muted)]">Estate:</span> <span className="font-medium text-[var(--ops-text)]">{r.estate ?? "—"}</span></div>
                                <div><span className="mono text-[11px] text-[var(--ops-muted)]">Plot / Code:</span> <span className="font-medium text-[var(--ops-text)]">{r.plotCode ?? "—"}</span></div>
                                <div><span className="mono text-[11px] text-[var(--ops-muted)]">Unit type:</span> <span className="font-medium text-[var(--ops-text)]">{r.unitType ?? "—"}</span></div>
                                <div><span className="mono text-[11px] text-[var(--ops-muted)]">Location raw:</span> <span className="text-[var(--ops-text)]">{r.location}</span></div>
                                <div><span className="mono text-[11px] text-[var(--ops-muted)]">Ref:</span> <span className="font-mono text-[var(--ops-text)]">{r.ref}</span></div>
                              </div>
                            </div>
                            <div className="bg-white border border-[var(--ops-border)] rounded-xl p-4">
                              <div className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">SQM</div>
                              {hasSqm ? (
                                <div className="mt-2">
                                  <div className="text-[14px] font-medium text-[var(--ops-text)]">{sqmDisplay}</div>
                                  <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">Saved as {r.sqm ? `sqm=${r.sqm}` : `sqmNeeded=${r.sqmNeeded}`} · {r.selectionType ?? "—"}</div>
                                  <div className="mt-3">
                                    <label className="mono text-[11px] text-[var(--ops-muted)]">Update SQM</label>
                                    <div className="flex gap-2 mt-1">
                                      <input
                                        type="number"
                                        min={10}
                                        placeholder={String(r.sqm ?? r.sqmNeeded ?? "")}
                                        value={sqmInput}
                                        onChange={(e) => setSqmInput(e.target.value)}
                                        className="flex-1 border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm"
                                      />
                                      <button
                                        onClick={() => handleSaveSqm(r)}
                                        disabled={!!savingSqm || !sqmInput}
                                        className="text-xs bg-[#0D3328] text-white rounded-full px-4 py-2 font-medium disabled:opacity-50"
                                      >
                                        {savingSqm === r.id ? "Saving…" : "Save"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2">
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mono text-[11px] text-amber-900">No SQM on file — add it so the receipt has complete data.</div>
                                  <div className="mt-3 flex gap-2">
                                    <input
                                      type="number"
                                      min={10}
                                      placeholder="e.g. 200"
                                      value={sqmInput}
                                      onChange={(e) => setSqmInput(e.target.value)}
                                      className="flex-1 border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm"
                                      autoFocus
                                    />
                                    <span className="self-center mono text-[12px] text-[var(--ops-muted)]">sqm</span>
                                    <button
                                      onClick={() => handleSaveSqm(r)}
                                      disabled={!!savingSqm || !sqmInput}
                                      className="text-xs bg-[#0D3328] text-white rounded-full px-4 py-2 font-medium disabled:opacity-50"
                                    >
                                      {savingSqm === r.id ? "Saving…" : "Save SQM"}
                                    </button>
                                  </div>
                                  <p className="mono text-[10px] text-[var(--ops-muted)] mt-2">This will set <span className="font-medium">sqm</span> and mark the booking as <span className="font-medium">Unit selected</span>.</p>
                                </div>
                              )}
                            </div>
                            <div className="bg-white border border-[var(--ops-border)] rounded-xl p-4">
                              <div className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Client</div>
                              <div className="mt-2 space-y-1 text-[13px]">
                                <div className="font-medium text-[var(--ops-text)]">{r.name}</div>
                                <div className="mono text-[12px] text-[var(--ops-muted)]">{r.email}</div>
                                <div className="mono text-[11px] text-[var(--ops-muted)]">Click Sold to calculate total: Unit Price × Plot Qty</div>
                              </div>
                              <button
                                onClick={() => handleSoldOpen(r)}
                                className="mt-3 w-full text-xs bg-[#C79A46] text-[#16281F] rounded-full px-4 py-2 font-medium hover:bg-[#D4B368]"
                              >
                                Go to Sold markup →
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <p className="public text-[14px] font-medium text-[var(--ops-text)]">No completed inspections awaiting outcome</p>
                    <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Inspections appear here once marked as held (Active) — the inspection has taken place and is awaiting Sold / Not Sold. Use “Mark inspection as held” on the booking to move it here.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sold markup modal — unit price × quantity */}
      {soldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[16px] border border-[var(--ops-border)] shadow-xl max-w-[520px] w-full p-6">
            <h3 className="fraunces text-[18px] text-[#16281F]">Mark as Sold — {soldModal.ref}</h3>
            <p className="public text-[13px] text-[#6B6656] mt-1">{soldModal.name} · {soldModal.estate ?? soldModal.location} · {soldModal.email}</p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)]">Unit Price (₦) *</label>
                  <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="e.g. 8300000" inputMode="numeric" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
                  {soldModal.estate && (
                    <div className="mono text-[10px] text-[var(--ops-muted)] mt-1 price">Plot price hint: {(() => { const p = getPlotPrice(soldModal.estate, soldModal.plotCode, soldModal.sqm ?? soldModal.sqmNeeded); return p ? formatNaira(p) : "—"; })()}</div>
                  )}
                </div>
                <div>
                  <label className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)]">Plot Quantity *</label>
                  <input value={plotQuantity} onChange={(e) => setPlotQuantity(e.target.value)} placeholder="1" inputMode="numeric" min={1} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="bg-[#16281F] rounded-xl p-4 text-white">
                <div className="mono text-[10px] tracking-[0.12em] uppercase text-[#D4B368]">Total Price</div>
                <div className="fraunces text-[20px] font-bold mt-1 price">{Number.isFinite(totalPrice) ? formatNaira(totalPrice) : formatNaira(0)}</div>
                <div className="mono text-[11px] text-white/70 mt-1">= Unit Price × Plot Qty — this is the Sold Price before discounts.</div>
              </div>
              <div>
                <label className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)]">Discounts (₦) — omit if none</label>
                <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" inputMode="numeric" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
                {discount && (
                  <div className="mono text-[11px] text-amber-700 mt-1 price">Payable: {formatNaira(totalPrice - (parseInt(discount.replace(/[^0-9]/g, ""), 10) || 0))} (Total − Discount)</div>
                )}
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-2">Payment method is recorded with each payment on the transaction — receipts are issued when payments are confirmed.</p>
              </div>

            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setSoldModal(null)} disabled={generating} className="text-sm bg-white border border-[var(--ops-border)] rounded-full px-5 py-2 font-medium disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSoldConfirm} disabled={generating || !unitPrice || !plotQuantity} className="text-sm bg-[#0D3328] text-white rounded-full px-6 py-2 font-medium disabled:opacity-50">
                {generating ? "Saving…" : "Confirm Sold & Create Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {generating && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
          <div className="h-12 w-12 rounded-full border-4 border-[#E4DCC7] border-t-[#0D3328] animate-spin" />
          <p className="fraunces text-[18px] text-[#16281F] mt-6">Marking sold and opening the transaction form…</p>
          <p className="mono text-[12px] text-[#6B6656] mt-2">This takes a moment — please don’t close this window.</p>
        </div>
      )}
    </>
  );
}
