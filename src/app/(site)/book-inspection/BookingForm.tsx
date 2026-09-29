"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { timeSlots } from "@/lib/content";
import { lagosTodayInput } from "@/lib/time";
import { BELGROVE_PLOTS } from "@/lib/belgroveData";

type FormState = {
  name: string;
  email: string;
  phone: string;
  preferredDate: string;
  preferredTime: string;
  location: string;
  agentName: string;
  estate: string;
  plotId: string;
  sqmNeeded: string;
  selectionType: "unit" | "sqm_needed";
};

const initialState: FormState = {
  name: "",
  email: "",
  phone: "",
  preferredDate: "",
  preferredTime: "",
  location: "",
  agentName: "",
  estate: "",
  plotId: "",
  sqmNeeded: "",
  selectionType: "unit",
};

export default function BookingForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  const estates = useMemo(() => [...new Set(BELGROVE_PLOTS.map((p) => p.estate))], []);
  const plotsForEstate = useMemo(
    // Sold plots can never be booked — the API rejects them too.
    () => (form.estate ? BELGROVE_PLOTS.filter((p) => p.estate === form.estate && p.status === "available") : []),
    [form.estate]
  );
  const selectedPlot = useMemo(() => plotsForEstate.find((p) => p.id === form.plotId) ?? null, [plotsForEstate, form.plotId]);
  const estateSoldOut = useMemo(
    () =>
      form.estate !== "" &&
      BELGROVE_PLOTS.some((p) => p.estate === form.estate) &&
      !BELGROVE_PLOTS.some((p) => p.estate === form.estate && p.status === "available"),
    [form.estate]
  );

  // Prefill from estate/plot detail or gallery: /book-inspection?estate=...&size=...&code=...&unit=...&price=...&phase=...
  // Homepage inspection form also passes name, phone and date.
  useEffect(() => {
    const estate = searchParams.get("estate");
    const size = searchParams.get("size");
    const code = searchParams.get("code");
    const unit = searchParams.get("unit");
    const phase = searchParams.get("phase");
    const name = searchParams.get("name");
    const phone = searchParams.get("phone");
    const date = searchParams.get("date");
    setForm((f) => ({
      ...f,
      ...(name && !f.name ? { name } : {}),
      ...(phone && !f.phone ? { phone } : {}),
      ...(date && !f.preferredDate ? { preferredDate: date } : {}),
    }));
    // Only prefill estate/plot selector when params present
    if (estate) {
      // find estate name exactly or fallback
      const matchedEstate = estates.find((e) => e === estate) ?? estate;
      let plotId = "";
      if (code) {
        const byCode = BELGROVE_PLOTS.find((p) => p.code === code || String(p.size) === size);
        if (byCode && byCode.estate === matchedEstate) plotId = byCode.id;
      } else if (size) {
        const bySize = BELGROVE_PLOTS.find((p) => p.estate === matchedEstate && String(p.size) === size && (!phase || p.phase === phase));
        if (bySize) plotId = bySize.id;
      }
      const parts: string[] = [];
      if (estate) parts.push(estate);
      if (unit) parts.push(unit);
      if (size) parts.push(`${size}sqm`);
      if (code) parts.push(code);
      const locationValue = parts.join(" · ");
      setForm((f) => ({
        ...f,
        estate: matchedEstate,
        plotId: plotId || f.plotId,
        location: locationValue || f.location,
        selectionType: plotId ? "unit" : f.selectionType,
      }));
    } else if (size || code) {
      // fallback to location only
      const parts: string[] = [];
      if (estate) parts.push(estate);
      if (unit) parts.push(unit);
      if (size) parts.push(`${size}sqm`);
      if (code) parts.push(code);
      if (parts.length) setForm((f) => ({ ...f, location: parts.join(" · ") }));
    }
  }, [searchParams, estates]);

  // Sync location derived from estate/plot/sqmNeeded so backend location stays human-readable
  useEffect(() => {
    if (!form.estate) return;
    if (form.selectionType === "unit" && selectedPlot) {
      const loc = `${selectedPlot.estate}${selectedPlot.phase ? `, ${selectedPlot.phase}` : ""} · ${selectedPlot.unitType ?? ""} · ${selectedPlot.code}`.replace(/ ·  ·/g, " · ").replace(/^ · | · $/g, "");
      setForm((f) => (f.location !== loc ? { ...f, location: loc } : f));
    } else if (form.selectionType === "sqm_needed" && form.sqmNeeded) {
      const loc = `${form.estate} · ${form.sqmNeeded}sqm requested`;
      setForm((f) => (f.location !== loc ? { ...f, location: loc } : f));
    }
  }, [form.estate, form.selectionType, form.sqmNeeded, selectedPlot]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Build payload matching server schema: location + estate/plot fields
    let estate = form.estate.trim();

    // Rule: no booking for a sold-out property (the API enforces this too).
    if (estateSoldOut) {
      setError(`${form.estate} is fully sold out. Please choose an available estate.`);
      setSubmitting(false);
      return;
    }
    let plotCode: string | undefined;
    let unitType: string | undefined;
    let sqm: number | undefined;
    let sqmNeeded: number | undefined;
    let selectionType: "unit" | "sqm_needed" | undefined;
    let location = form.location.trim();

    if (form.estate) {
      if (form.selectionType === "unit" && selectedPlot) {
        plotCode = selectedPlot.code;
        unitType = selectedPlot.unitType;
        sqm = selectedPlot.size;
        selectionType = "unit";
        location = `${selectedPlot.estate}${selectedPlot.phase ? `, ${selectedPlot.phase}` : ""} · ${selectedPlot.unitType ?? ""} · ${selectedPlot.code}`.replace(/ ·  ·/g, " · ");
      } else if (form.selectionType === "sqm_needed" && form.sqmNeeded) {
        const n = parseInt(form.sqmNeeded, 10);
        if (Number.isNaN(n) || n < 10) {
          setError("Enter a valid SQM size (e.g. 200)");
          setSubmitting(false);
          return;
        }
        sqmNeeded = n;
        selectionType = "sqm_needed";
        location = `${estate} · ${n}sqm requested`;
      } else {
        // estate selected but no specific unit and no sqmNeeded yet — fallback to estate name as location
        if (!location) location = estate;
      }
    }

    if (!location) {
      setError("Property / Estate is required: pick an estate or enter a location.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          preferredDate: form.preferredDate,
          preferredTime: form.preferredTime,
          location,
          agentName: form.agentName,
          estate,
          plotCode,
          unitType,
          sqm,
          sqmNeeded,
          selectionType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (data.issues) {
          const first = Object.values(data.issues as Record<string, string[]>)[0]?.[0];
          if (first) setError(first);
        }
        return;
      }

      setRef(data.ref);
      setForm(initialState);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (ref) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
        <p className="text-sm uppercase tracking-widest text-stone-400 mb-2">Booking Confirmed</p>
        <h2 className="font-serif text-2xl text-stone-800 mb-4">Thank you!</h2>
        <p className="text-stone-600 mb-4">Your inspection request has been received. Check your email for confirmation.</p>
        <p className="text-stone-500 text-sm">Your reference code:</p>
        <p className="font-mono text-lg text-stone-800 font-semibold mb-6">{ref}</p>
        <button onClick={() => setRef(null)} className="text-sm text-stone-600 underline">
          Book another inspection
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-8 space-y-5">
      {form.estate && (
        <div className="bg-[#F7F2E7] border border-[#E0D5BB] rounded px-3 py-2.5 mono text-[11px] leading-[1.5] text-[#1F3328]">
          <span className="font-semibold">Selected:</span> {form.estate}
          {selectedPlot ? ` · ${selectedPlot.unitType ?? ""} · ${selectedPlot.code} · ${selectedPlot.size}sqm` : form.sqmNeeded ? ` · ${form.sqmNeeded}sqm requested` : ""}
          <span className="block text-[#8B5E3C] mt-1">You can change the estate / plot below before submitting.</span>
        </div>
      )}
      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="name">
          Name *
        </label>
        <input
          id="name"
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="email">
          Email *
        </label>
        <input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="phone">
          Phone number *
        </label>
        <input
          id="phone"
          type="tel"
          required
          placeholder="+234 801 234 5678"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1" htmlFor="date">
            Date *
          </label>
          <input
            id="date"
            type="date"
            required
            min={lagosTodayInput()}
            value={form.preferredDate}
            onChange={(e) => update("preferredDate", e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1" htmlFor="time">
            Time *
          </label>
          <select
            id="time"
            required
            value={form.preferredTime}
            onChange={(e) => update("preferredTime", e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <option value="" disabled>
              Select a time
            </option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Property / Estate — required, searchable */}
      <div className="border border-[#E0D5BB] rounded-lg p-4 bg-[#FFFEFB]">
        <label className="block text-sm font-medium text-[#1F3328] mb-1" htmlFor="estate">
          Property / Estate name *
        </label>
        <select
          id="estate"
          required
          value={form.estate}
          onChange={(e) => {
            const v = e.target.value;
            setForm((f) => ({ ...f, estate: v, plotId: "", sqmNeeded: "" }));
          }}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        >
          <option value="" disabled>
            Select an estate…
          </option>
          {estates.map((est) => (
            <option key={est} value={est}>
              {est}
            </option>
          ))}
        </select>
        <p className="mono text-[11px] text-[#8B5E3C] mt-1">Choose a plot, or tell us the size you need.</p>

        {form.estate && estateSoldOut && (
          <div className="mt-4 rounded-lg border border-[#A6402F]/30 bg-[#A6402F]/5 px-4 py-3">
            <p className="public text-[13px] font-semibold text-[#A6402F]">This estate is fully sold out.</p>
            <p className="public text-[13px] leading-[1.6] text-stone-600 mt-1">
              Inspections can&apos;t be booked here. Please choose an available estate above.
            </p>
          </div>
        )}

        {form.estate && !estateSoldOut && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center gap-2 border rounded-full px-3 py-2 text-xs cursor-pointer ${form.selectionType === "unit" ? "bg-[#1F3328] text-white border-[#1F3328]" : "bg-white border-stone-300 text-stone-700"}`}>
                <input type="radio" name="selectionType" checked={form.selectionType === "unit"} onChange={() => update("selectionType", "unit")} className="accent-[#1F3328]" />
                Specific plot / unit
              </label>
              <label className={`flex-1 flex items-center gap-2 border rounded-full px-3 py-2 text-xs cursor-pointer ${form.selectionType === "sqm_needed" ? "bg-[#1F3328] text-white border-[#1F3328]" : "bg-white border-stone-300 text-stone-700"}`}>
                <input type="radio" name="selectionType" checked={form.selectionType === "sqm_needed"} onChange={() => update("selectionType", "sqm_needed")} className="accent-[#1F3328]" />
                SQM Needed (no exact unit)
              </label>
            </div>

            {form.selectionType === "unit" ? (
              <div>
                <label className="block text-sm text-stone-600 mb-1" htmlFor="plotId">
                  Plot / Unit *
                </label>
                <select
                  id="plotId"
                  value={form.plotId}
                  onChange={(e) => update("plotId", e.target.value)}
                  className="w-full border border-stone-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                >
                  <option value="" disabled>
                    Select a unit…
                  </option>
                  {plotsForEstate.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.unitType ? `${p.unitType} · ` : ""}
                      {p.size}sqm{p.phase ? ` · ${p.phase}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mono text-[11px] text-stone-500 mt-1">Pick a specific plot if you already have one in mind.</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm text-stone-600 mb-1" htmlFor="sqmNeeded">
                  SQM Needed *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="sqmNeeded"
                    type="number"
                    min={10}
                    max={10000}
                    placeholder="e.g. 200"
                    value={form.sqmNeeded}
                    onChange={(e) => update("sqmNeeded", e.target.value)}
                    className="flex-1 border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <span className="mono text-xs text-stone-500">sqm</span>
                </div>
                <p className="mono text-[11px] text-stone-500 mt-1">Tell us the size you need and an adviser will match it to the nearest available unit. No exact plot required.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="agentName">
          Agent name <span className="text-stone-400">(optional)</span>
        </label>
        <input
          id="agentName"
          value={form.agentName}
          onChange={(e) => update("agentName", e.target.value)}
          placeholder="Optional e.g. Ada Okafor"
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          autoComplete="off"
        />
      </div>

      {/* location hidden but shown for transparency when manually entered */}
      {!form.estate && (
        <div>
          <label className="block text-sm text-stone-600 mb-1" htmlFor="location">
            Location of interest *
          </label>
          <input
            id="location"
            placeholder="Address, neighborhood, or listing"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <p className="mono text-[11px] text-stone-500 mt-1">Or pick an estate above and we&apos;ll fill this in for you.</p>
        </div>
      )}
      {form.estate && (
        <div className="mono text-[11px] text-stone-500 bg-[#F7F2E7] border border-[#E0D5BB] rounded px-3 py-2">
          Booking will be saved as: <span className="font-medium text-[#1F3328]">{form.location || form.estate}</span>
          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] border bg-white">{form.selectionType === "unit" && selectedPlot ? "Unit selected" : form.selectionType === "sqm_needed" && form.sqmNeeded ? `Sizing: ${form.sqmNeeded}sqm requested` : "Estate selected"}</span>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-stone-800 text-white rounded py-3 text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Book Inspection"}
      </button>
    </form>
  );
}
