"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { timeSlots } from "@/lib/content";

type FormState = {
  name: string;
  email: string;
  phone: string;
  preferredDate: string;
  preferredTime: string;
  location: string;
  agentName: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  phone: "",
  preferredDate: "",
  preferredTime: "",
  location: "",
  agentName: "",
};

type CompanyAgentSuggestion = { name: string; category: "staff" | "hire_purchase" };

export default function BookingForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [agentSuggestions, setAgentSuggestions] = useState<CompanyAgentSuggestion[]>([]);
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((d) => setAgentSuggestions(d.agents ?? []))
      .catch(() => {});
  }, []);

  // Prefill from gallery click: /book-inspection?estate=...&size=...&code=...&unit=...&price=...
  useEffect(() => {
    const estate = searchParams.get("estate");
    const size = searchParams.get("size");
    const code = searchParams.get("code");
    const unit = searchParams.get("unit");
    const price = searchParams.get("price");
    // Support legacy booking.html URLs via redirect handling is done in page href fix
    if (estate || size || code) {
      const parts: string[] = [];
      if (estate) parts.push(estate);
      if (unit) parts.push(unit);
      if (size) parts.push(`${size}sqm`);
      if (code) parts.push(code);
      const locationValue = parts.join(" · ");
      setForm((f) => ({ ...f, location: locationValue }));
      const priceLine = price ? ` — ₦${Number(price).toLocaleString("en-NG")}` : "";
      setPrefillBanner(`${estate ?? ""}${size ? ` · ${size}sqm` : ""}${code ? ` · ${code}` : ""}${priceLine}`);
    }
  }, [searchParams]);

  // Search by first name + surname: matches any token or substring, case-insensitive.
  function isAgentMatch(input: string, agentName: string): boolean {
    const q = input.trim().toLowerCase();
    if (q.length < 2) return false;
    const name = agentName.toLowerCase();
    if (name.includes(q)) return true;
    const qTokens = q.split(/\s+/).filter(Boolean);
    const nameTokens = name.split(/\s+/).filter(Boolean);
    return qTokens.some((qt) => nameTokens.some((nt) => nt === qt || (qt.length >= 3 && nt.includes(qt)) || (nt.length >= 3 && qt.includes(nt))));
  }

  const filteredAgents = form.agentName.trim()
    ? agentSuggestions.filter((a) => isAgentMatch(form.agentName, a.name))
    : agentSuggestions;

  const matchedAgent = form.agentName.trim() ? agentSuggestions.find((a) => isAgentMatch(form.agentName, a.name)) ?? null : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
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
        <p className="text-stone-600 mb-4">
          Your inspection request has been received. Check your email for confirmation.
        </p>
        <p className="text-stone-500 text-sm">Your reference code:</p>
        <p className="font-mono text-lg text-stone-800 font-semibold mb-6">{ref}</p>
        <button
          onClick={() => setRef(null)}
          className="text-sm text-stone-600 underline"
        >
          Book another inspection
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-8 space-y-5">
      {prefillBanner && (
        <div className="bg-[#F7F2E7] border border-[#E0D5BB] rounded px-3 py-2.5 mono text-[11px] leading-[1.5] text-[#1F3328]">
          <span className="font-semibold">Selected plot:</span> {prefillBanner}
          <span className="block text-[#8B5E3C] mt-1">Location pre-filled from gallery — you can edit it.</span>
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
            min={new Date().toISOString().split("T")[0]}
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

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="location">
          Location of interest *
        </label>
        <input
          id="location"
          required
          placeholder="Address, neighborhood, or listing"
          value={form.location}
          onChange={(e) => update("location", e.target.value)}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="agentName">
          Agent name <span className="text-stone-400">(optional)</span>
        </label>
        <input
          id="agentName"
          list="company-agents"
          value={form.agentName}
          onChange={(e) => update("agentName", e.target.value)}
          placeholder={agentSuggestions.length ? "Start typing company agents appear" : "Optional e.g. Ada Okafor"}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <datalist id="company-agents">
          {filteredAgents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.category === "hire_purchase" ? "Hire Purchase" : "Staff"}
            </option>
          ))}
        </datalist>
        {form.agentName.trim() ? (
          matchedAgent ? (
            <p className="mono text-[11px] mt-1 text-emerald-700">✓ Agent name matches that of DB: <span className="font-medium">{matchedAgent.name}</span> {matchedAgent.category === "hire_purchase" ? "Hire Purchase" : "Staff"} admin will see tally</p>
          ) : null
        ) : agentSuggestions.length > 0 ? (
          <p className="mono text-[11px] mt-1 text-stone-400">{agentSuggestions.length} company agents available pick one (search by first name or surname) or leave blank for admin to assign</p>
        ) : null}
      </div>

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
