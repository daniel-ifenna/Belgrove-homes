"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Agent = {
  id: string;
  name: string;
  phone: string;
  email: string;
  category: "staff" | "hire_purchase";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { bookings: number };
};

export default function AgentManager({ initialAgents }: { initialAgents: Agent[] }) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [form, setForm] = useState<{ name: string; phone: string; email: string; category: Agent["category"]; isActive: boolean }>({ name: "", phone: "", email: "", category: "staff", isActive: true });
  const [editing, setEditing] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; phone: string; email: string; category: Agent["category"]; isActive: boolean }>({ name: "", phone: "", email: "", category: "staff", isActive: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/agents");
    if (res.ok) {
      const data = await res.json();
      setAgents(data.agents);
    }
    router.refresh();
  }

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create agent");
      setForm({ name: "", phone: "", email: "", category: "staff", isActive: true });
      setSuccess(`Agent ${data.agent.name} created`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(agent: Agent) {
    setEditing(agent);
    setEditForm({ name: agent.name, phone: agent.phone, email: agent.email, category: agent.category, isActive: agent.isActive });
    setError(null);
    setSuccess(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy("edit");
    setError(null);
    try {
      const res = await fetch(`/api/admin/agents/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setEditing(null);
      setSuccess(`Agent ${data.agent.name} updated`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(agent: Agent) {
    setBusy(agent.id);
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      await refresh();
    } catch {
      setError("Failed to toggle status");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAgent(agent: Agent) {
    if (!confirm(`Delete ${agent.name}? ${agent._count?.bookings ? "Has bookings will be deactivated instead." : ""}`)) return;
    setBusy(agent.id);
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSuccess(data.deactivated ? `${agent.name} deactivated (had bookings)` : `${agent.name} deleted`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-serif text-2xl text-stone-800">Company Agents</h1>
      <p className="text-sm text-stone-500 mt-1">Staff and hire-purchase partners. Unassigned bookings can be assigned here the agent is emailed client details to follow up.</p>

      {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3">{error}</div>}
      {success && <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded px-4 py-3">{success}</div>}

      <div className="mt-8 bg-white border border-stone-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-4">Add agent</h2>
        <form onSubmit={createAgent} className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" placeholder="e.g. Ada Okafor" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" placeholder="ada@belgrovehomes.com" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Phone *</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" placeholder="+234 801 234 5678" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Category *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Agent["category"] })} className="w-full border border-stone-300 rounded px-3 py-2 text-sm bg-white">
              <option value="staff">Staff</option>
              <option value="hire_purchase">Hire Purchase</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
            <button type="submit" disabled={busy !== null} className="ml-auto text-sm bg-stone-800 text-white rounded px-5 py-2 disabled:opacity-50">
              {busy === "create" ? "Adding…" : "Add agent"}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 bg-white border border-stone-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-800">{a.name}</div>
                  <div className="text-xs text-stone-400">{a.email}</div>
                </td>
                <td className="px-4 py-3 text-stone-600">
                  <div>{a.phone}</div>
                  <div className="text-xs text-stone-400">{a.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${a.category === "staff" ? "bg-stone-800 text-white" : "bg-amber-100 text-amber-800"}`}>
                    {a.category === "hire_purchase" ? "Hire Purchase" : "Staff"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(a)} disabled={busy !== null} className={`px-2 py-1 rounded-full text-xs ${a.isActive ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>
                    {a.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">{a._count?.bookings ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(a)} className="text-xs text-stone-600 hover:underline">Edit</button>
                    <button onClick={() => deleteAgent(a)} disabled={busy === a.id} className="text-xs text-red-600 hover:underline disabled:opacity-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-400">No agents yet. Add your first staff or hire-purchase partner above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium text-stone-800 mb-4">Edit {editing.name}</h3>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Phone</label>
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value as Agent["category"] })} className="w-full border border-stone-300 rounded px-3 py-2 text-sm bg-white">
                  <option value="staff">Staff</option>
                  <option value="hire_purchase">Hire Purchase</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                Active
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="text-sm border border-stone-300 rounded px-4 py-2">Cancel</button>
                <button type="submit" disabled={busy !== null} className="text-sm bg-stone-800 text-white rounded px-4 py-2 disabled:opacity-50">{busy === "edit" ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
