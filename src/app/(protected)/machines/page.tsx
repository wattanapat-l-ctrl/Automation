"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCcw, Search, Pencil, Trash2, Download, History, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Field, inputClass, btnPrimary, btnSecondary, btnDanger } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { exportCsv } from "@/lib/csv";
import type { Machine } from "@/lib/supabase/types";
import { MACHINE_STATUSES } from "@/lib/supabase/types";

type FormState = {
  machine_id: string;
  machine_name: string;
  machine_type: string;
  location: string;
  status: (typeof MACHINE_STATUSES)[number];
};

const EMPTY_FORM: FormState = {
  machine_id: "",
  machine_name: "",
  machine_type: "",
  location: "",
  status: "Stop",
};

export default function MachinesPage() {
  const { isAdmin } = useAuth();
  const supabase = createClient();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Machine | null>(null);

  const load = useCallback(() => {
    return supabase
      .from("machines")
      .select("*")
      .order("machine_id")
      .then(({ data }) => {
        setMachines((data ?? []) as unknown as Machine[]);
        setLoading(false);
      });
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = machines.filter((m) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.machine_id.toLowerCase().includes(q) ||
      m.machine_name.toLowerCase().includes(q) ||
      m.location.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setActionError(null);
    setModalOpen(true);
  }

  function openEdit(machine: Machine) {
    setEditing(machine);
    setForm({
      machine_id: machine.machine_id,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type ?? "",
      location: machine.location ?? "",
      status: machine.status,
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
    if (!form.machine_id.trim()) next.machine_id = "Machine ID is required.";
    else if (!/^[A-Za-z0-9\-_]+$/.test(form.machine_id.trim()))
      next.machine_id = "Machine ID may only contain letters, numbers, dashes and underscores.";
    if (!form.machine_name.trim()) next.machine_name = "Machine Name is required.";
    if (!form.machine_type.trim()) next.machine_type = "Machine Type is required.";
    if (!form.location.trim()) next.location = "Location is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setActionError(null);

    // Duplicate check (Machine ID must be unique)
    const exists = await supabase
      .from("machines")
      .select("id")
      .eq("machine_id", form.machine_id.trim())
      .neq("id", editing?.id ?? "")
      .maybeSingle();

    if (exists.data) {
      setErrors((e) => ({ ...e, machine_id: "This Machine ID is already in use." }));
      setSaving(false);
      return;
    }

    const payload = {
      machine_id: form.machine_id.trim(),
      machine_name: form.machine_name.trim(),
      machine_type: form.machine_type.trim(),
      location: form.location.trim(),
      status: form.status,
    };

    const { error } = editing
      ? await supabase.from("machines").update(payload).eq("id", editing.id)
      : await supabase.from("machines").insert(payload);

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
    const { error } = await supabase.from("machines").delete().eq("id", deleting.id);
    setSaving(false);
    if (!error) {
      setDeleting(null);
      load();
    } else {
      setActionError(error.message);
    }
  }

  async function handleQuickStatus(m: Machine, status: (typeof MACHINE_STATUSES)[number]) {
    const { error } = await supabase.from("machines").update({ status }).eq("id", m.id);
    if (error) {
      window.alert(`Failed to update status: ${error.message}`);
    } else {
      load();
    }
  }

  function handleExport() {
    exportCsv(
      `machines-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Machine ID", "Name", "Type", "Location", "Status", "Created"],
      filtered.map((m) => [
        m.machine_id,
        m.machine_name,
        m.machine_type ?? "",
        m.location ?? "",
        m.status,
        new Date(m.created_at).toLocaleString("en-GB"),
      ])
    );
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Loading machines…</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Settings className="h-5 w-5" />}
        iconClass="from-sky-500 to-blue-600"
        title="Machines"
        subtitle={`Manage machine master data · ${machines.length} machines`}
        actions={
          <>
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
                Add Machine
              </button>
            )}
          </>
        }
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-3 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, name or location…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`${inputClass} w-auto`}
        >
          <option value="All">All Status</option>
          {MACHINE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-4 py-3">Machine ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">History</th>
                {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-14 text-center text-slate-400">
                    No machines found.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                      {m.machine_id}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white">
                      {m.machine_name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{m.machine_type}</td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{m.location}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge value={m.status} />
                        {isAdmin &&
                          MACHINE_STATUSES.filter((s) => s !== m.status).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleQuickStatus(m, s)}
                              title={`Set status to ${s}`}
                              className="rounded-md border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-sky-400 dark:hover:text-sky-400"
                            >
                              {s}
                            </button>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/machines/${m.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
                        title="View machine history"
                      >
                        <History className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(m)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleting(m);
                              setActionError(null);
                            }}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Machine" : "Add Machine"}
        wide
      >
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Machine ID" required error={errors.machine_id}>
            <input
              className={inputClass}
              value={form.machine_id}
              onChange={(e) => set("machine_id", e.target.value)}
              placeholder="e.g. MC-010"
            />
          </Field>
          <Field label="Machine Name" required error={errors.machine_name}>
            <input
              className={inputClass}
              value={form.machine_name}
              onChange={(e) => set("machine_name", e.target.value)}
              placeholder="e.g. CNC Milling Machine"
            />
          </Field>
          <Field label="Machine Type" required error={errors.machine_type}>
            <input
              className={inputClass}
              value={form.machine_type}
              onChange={(e) => set("machine_type", e.target.value)}
              placeholder="e.g. CNC, Injection, Robot"
            />
          </Field>
          <Field label="Location" required error={errors.location}>
            <input
              className={inputClass}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="e.g. Plant 1 - Building A"
            />
          </Field>
          <Field label="Status">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as FormState["status"])}
            >
              {MACHINE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          {actionError && (
            <p className="col-span-full rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {actionError}
            </p>
          )}

          <div className="col-span-full flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Machine"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete Machine"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-900 dark:text-white">
            {deleting?.machine_id} — {deleting?.machine_name}
          </span>
          ? This will also remove its alarms and maintenance records (cascade).
        </p>
        {actionError && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
            {actionError}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setDeleting(null)} className={btnSecondary}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={saving} className={btnDanger}>
            {saving ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}