"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCcw, Search, Pencil, Trash2, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, inputClass, btnPrimary, btnSecondary, btnDanger } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { exportCsv } from "@/lib/csv";
import type { MaintenanceRecord, Machine } from "@/lib/supabase/types";
import { MAINTENANCE_STATUSES } from "@/lib/supabase/types";

type FormState = {
  machine_id: string;
  maintenance_type: string;
  problem: string;
  action_taken: string;
  technician: string;
  status: (typeof MAINTENANCE_STATUSES)[number];
  maintenance_date: string;
};

const EMPTY_FORM: FormState = {
  machine_id: "",
  maintenance_type: "",
  problem: "",
  action_taken: "",
  technician: "",
  status: "Pending",
  maintenance_date: new Date().toISOString().slice(0, 10),
};

export default function MaintenancePage() {
  const { isAdmin, profile } = useAuth();
  const supabase = createClient();
  const { tick } = useRealtime(["maintenance_records", "machines"]);

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<MaintenanceRecord | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      supabase
        .from("maintenance_records")
        .select("*, machines(machine_id, machine_name)")
        .order("maintenance_date", { ascending: false }),
      supabase.from("machines").select("id, machine_id, machine_name").order("machine_id"),
    ]).then(([recordsRes, machinesRes]) => {
      setRecords((recordsRes.data ?? []) as MaintenanceRecord[]);
      setMachines((machinesRes.data ?? []) as Machine[]);
      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const filtered = records.filter((r) => {
    const machine = r.machines as unknown as { machine_id?: string; machine_name?: string } | null;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (machine?.machine_id ?? "").toLowerCase().includes(q) ||
      r.problem.toLowerCase().includes(q) ||
      (r.technician ?? "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    const matchesFrom = !dateFrom || r.maintenance_date >= dateFrom;
    const matchesTo = !dateTo || r.maintenance_date <= dateTo;
    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      machine_id: machines[0]?.id ?? "",
      technician: profile?.full_name || profile?.email || "",
    });
    setErrors({});
    setActionError(null);
    setModalOpen(true);
  }

  function openEdit(record: MaintenanceRecord) {
    setEditing(record);
    setForm({
      machine_id: record.machine_id,
      maintenance_type: record.maintenance_type,
      problem: record.problem,
      action_taken: record.action_taken ?? "",
      technician: record.technician ?? "",
      status: record.status,
      maintenance_date: record.maintenance_date.slice(0, 10),
    });
    setErrors({});
    setActionError(null);
    setModalOpen(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.machine_id) next.machine_id = "Please select a machine.";
    if (!form.maintenance_type.trim()) next.maintenance_type = "Maintenance Type is required.";
    if (!form.problem.trim()) next.problem = "Problem is required.";
    if (!form.technician.trim()) next.technician = "Technician is required.";
    if (!form.maintenance_date) next.maintenance_date = "Date is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setActionError(null);

    const payload = {
      machine_id: form.machine_id,
      maintenance_type: form.maintenance_type.trim(),
      problem: form.problem.trim(),
      action_taken: form.action_taken.trim() || null,
      technician: form.technician.trim(),
      status: form.status,
      maintenance_date: form.maintenance_date,
    };

    const { error } = editing
      ? await supabase.from("maintenance_records").update(payload).eq("id", editing.id)
      : await supabase.from("maintenance_records").insert(payload);

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    const { error } = await supabase.from("maintenance_records").delete().eq("id", deleting.id);
    setSaving(false);
    if (!error) {
      setDeleting(null);
      load();
    } else {
      setActionError(error.message);
    }
  }

  function handleExport() {
    exportCsv(
      `maintenance-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Machine ID", "Type", "Problem", "Action Taken", "Technician", "Date", "Status"],
      filtered.map((r) => {
        const machine = r.machines as unknown as { machine_id?: string } | null;
        return [
          machine?.machine_id ?? "?",
          r.maintenance_type,
          r.problem,
          r.action_taken ?? "",
          r.technician ?? "",
          r.maintenance_date,
          r.status,
        ];
      })
    );
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Loading maintenance records…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Maintenance</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Maintenance records · {records.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className={btnSecondary} title="Refresh">
            <RefreshCcw className="h-4 w-4" />
          </button>
          <button onClick={handleExport} className={btnSecondary} title="Export CSV">
            <Download className="h-4 w-4" />
            CSV
          </button>
          {isAdmin && (
            <button onClick={openCreate} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Add Record
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by machine, problem or technician…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="All">All Status</option>
          {MAINTENANCE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} w-auto`} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} w-auto`} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-4 py-3">Machine</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3">Action Taken</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-14 text-center text-slate-400">
                    No maintenance records found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const machine = r.machines as unknown as { machine_id?: string; machine_name?: string } | null;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{machine?.machine_id ?? "?"}</p>
                        <p className="text-xs text-slate-400">{machine?.machine_name}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{r.maintenance_type}</td>
                      <td className="max-w-xs px-4 py-3.5 text-slate-600 dark:text-slate-300">{r.problem}</td>
                      <td className="max-w-xs px-4 py-3.5 text-slate-500 dark:text-slate-400">{r.action_taken ?? "—"}</td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{r.technician ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(r.maintenance_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3.5"><Badge value={r.status} /></td>
                      {isAdmin && (
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(r)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setDeleting(r); setActionError(null); }}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Maintenance Record" : "Add Maintenance Record"} wide>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Machine" required error={errors.machine_id}>
            <select className={inputClass} value={form.machine_id} onChange={(e) => set("machine_id", e.target.value)}>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.machine_id} — {m.machine_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Maintenance Type" required error={errors.maintenance_type}>
            <input className={inputClass} value={form.maintenance_type} onChange={(e) => set("maintenance_type", e.target.value)} placeholder="e.g. Preventive, Corrective, Lubrication" />
          </Field>
          <Field label="Problem" required error={errors.problem}>
            <input className={inputClass} value={form.problem} onChange={(e) => set("problem", e.target.value)} placeholder="Describe the problem" />
          </Field>
          <Field label="Action Taken">
            <input className={inputClass} value={form.action_taken} onChange={(e) => set("action_taken", e.target.value)} placeholder="What was done (optional)" />
          </Field>
          <Field label="Technician" required error={errors.technician}>
            <input className={inputClass} value={form.technician} onChange={(e) => set("technician", e.target.value)} placeholder="Technician name" />
          </Field>
          <Field label="Date" required error={errors.maintenance_date}>
            <input type="date" className={inputClass} value={form.maintenance_date} onChange={(e) => set("maintenance_date", e.target.value)} />
          </Field>
          <Field label="Status" required>
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              {MAINTENANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          {actionError && (
            <p className="col-span-full rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{actionError}</p>
          )}

          <div className="col-span-full flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Record"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Maintenance Record">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete this maintenance record for{" "}
          <span className="font-semibold text-slate-900 dark:text-white">
            {(() => {
              const m = deleting?.machines as unknown as { machine_id?: string } | null;
              return m?.machine_id ?? deleting?.machine_id ?? "?";
            })()}
          </span>
          ?
        </p>
        {actionError && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{actionError}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setDeleting(null)} className={btnSecondary}>Cancel</button>
          <button onClick={handleDelete} disabled={saving} className={btnDanger}>
            {saving ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}