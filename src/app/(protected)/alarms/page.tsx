"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  RefreshCcw,
  Search,
  Pencil,
  Trash2,
  CheckCircle,
  RotateCcw,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, inputClass, btnPrimary, btnSecondary, btnDanger } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { exportCsv } from "@/lib/csv";
import type { Alarm, Machine } from "@/lib/supabase/types";
import { ALARM_STATUSES } from "@/lib/supabase/types";

type FormState = {
  machine_id: string;
  alarm_code: string;
  description: string;
  cause: string;
  status: (typeof ALARM_STATUSES)[number];
  alarmed_at: string;
};

const EMPTY_FORM: FormState = {
  machine_id: "",
  alarm_code: "",
  description: "",
  cause: "",
  status: "Open",
  alarmed_at: "",
};

function LiveChip({ live }: { live: boolean }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 ${live ? "animate-ping opacity-60" : "opacity-20"}`}
        />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-400"}`}
        />
      </span>
      {live ? "LIVE" : "Live"}
    </span>
  );
}

export default function AlarmsPage() {
  const { isAdmin, role } = useAuth();
  const supabase = createClient();
  const { tick, live } = useRealtime(["alarms", "machines"]);

  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [machineFilter, setMachineFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Alarm | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Alarm | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      supabase
        .from("alarms")
        .select("*, machines(machine_id, machine_name)")
        .order("alarmed_at", { ascending: false }),
      supabase.from("machines").select("id, machine_id, machine_name").order("machine_id"),
    ]).then(([alarmsRes, machinesRes]) => {
      setAlarms((alarmsRes.data ?? []) as Alarm[]);
      setMachines((machinesRes.data ?? []) as Machine[]);
      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const filtered = alarms.filter((a) => {
    const machine = a.machines as unknown as { machine_id?: string; machine_name?: string } | null;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (machine?.machine_id ?? "").toLowerCase().includes(q) ||
      a.alarm_code.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || a.status === statusFilter;
    const matchesMachine = machineFilter === "All" || a.machine_id === machineFilter;
    const matchesFrom = !dateFrom || a.alarmed_at >= dateFrom + "T00:00:00";
    const matchesTo = !dateTo || a.alarmed_at <= dateTo + "T23:59:59";
    return matchesSearch && matchesStatus && matchesMachine && matchesFrom && matchesTo;
  });

  const summary = {
    Open: alarms.filter((a) => a.status === "Open").length,
    "In Progress": alarms.filter((a) => a.status === "In Progress").length,
    Closed: alarms.filter((a) => a.status === "Closed").length,
  };
  const totalSummary = Math.max(alarms.length, 1);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      machine_id: machines[0]?.id ?? "",
      alarmed_at: toLocalDateTime(new Date()),
    });
    setErrors({});
    setActionError(null);
    setModalOpen(true);
  }

  function openEdit(alarm: Alarm) {
    setEditing(alarm);
    setForm({
      machine_id: alarm.machine_id,
      alarm_code: alarm.alarm_code,
      description: alarm.description,
      cause: alarm.cause ?? "",
      status: alarm.status,
      alarmed_at: toLocalDateTime(new Date(alarm.alarmed_at)),
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
    if (!form.alarm_code.trim()) next.alarm_code = "Alarm Code is required.";
    else if (!/^[A-Za-z0-9\-_.]+$/.test(form.alarm_code.trim()))
      next.alarm_code = "Alarm Code may only contain letters, numbers, dashes, dots and underscores.";
    if (!form.description.trim()) next.description = "Description is required.";
    if (!form.alarmed_at) next.alarmed_at = "Date/Time is required.";
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
      alarm_code: form.alarm_code.trim(),
      description: form.description.trim(),
      cause: form.cause.trim() || null,
      status: form.status,
      alarmed_at: new Date(form.alarmed_at).toISOString(),
    };

    const { error } = editing
      ? await supabase.from("alarms").update(payload).eq("id", editing.id)
      : await supabase.from("alarms").insert(payload);

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleStatusChange(alarm: Alarm, status: (typeof ALARM_STATUSES)[number]) {
    const { error } = await supabase.from("alarms").update({ status }).eq("id", alarm.id);
    if (error) window.alert(`Failed to update status: ${error.message}`);
    else load();
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    const { error } = await supabase.from("alarms").delete().eq("id", deleting.id);
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
      `alarms-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Machine ID", "Alarm Code", "Description", "Cause", "Date / Time", "Status"],
      filtered.map((a) => {
        const machine = a.machines as unknown as { machine_id?: string } | null;
        return [
          machine?.machine_id ?? "?",
          a.alarm_code,
          a.description,
          a.cause ?? "",
          new Date(a.alarmed_at).toLocaleString("en-GB"),
          a.status,
        ];
      })
    );
  }

  const canUpdateStatus = isAdmin || role === "technician";

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Loading alarms…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Alarms</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Alarm records · {alarms.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LiveChip live={live} />
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
              Add Alarm
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["Open", "In Progress", "Closed"] as const).map((s) => (
          <div
            key={s}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <Badge value={s} />
              <span className="text-xl font-bold text-slate-900 dark:text-white">{summary[s]}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${
                  s === "Open"
                    ? "bg-red-500"
                    : s === "In Progress"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${(summary[s] / totalSummary) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {Math.round((summary[s] / totalSummary) * 100)}%
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by machine, code or description…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="All">All Status</option>
          {ALARM_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="All">All Machines</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>{m.machine_id}</option>
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
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Cause</th>
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-14 text-center text-slate-400">
                    No alarms found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const machine = a.machines as unknown as { machine_id?: string; machine_name?: string } | null;
                  return (
                    <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                          {machine?.machine_id ?? "?"}
                        </p>
                        <p className="text-xs text-slate-400">{machine?.machine_name}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-300">{a.alarm_code}</td>
                      <td className="max-w-xs px-4 py-3.5 text-slate-600 dark:text-slate-300">{a.description}</td>
                      <td className="max-w-xs px-4 py-3.5 text-slate-500 dark:text-slate-400">{a.cause ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(a.alarmed_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3.5">
                        {canUpdateStatus ? (
                          <div className="flex items-center gap-2">
                            {a.status === "Closed" ? (
                              <button
                                onClick={() => handleStatusChange(a, "Open")}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
                                title="Reopen"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(a, "Closed")}
                                className={`rounded-lg p-1.5 transition ${
                                  a.status === "In Progress"
                                    ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950"
                                    : "text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                                }`}
                                title="Mark as resolved (Closed)"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            <Badge value={a.status} />
                          </div>
                        ) : (
                          <Badge value={a.status} />
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(a)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setDeleting(a); setActionError(null); }}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Alarm" : "Add Alarm"} wide>
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
          <Field label="Alarm Code" required error={errors.alarm_code}>
            <input className={inputClass} value={form.alarm_code} onChange={(e) => set("alarm_code", e.target.value)} placeholder="e.g. AL-101" />
          </Field>
          <Field label="Description" required error={errors.description}>
            <input className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the alarm" />
          </Field>
          <Field label="Cause">
            <input className={inputClass} value={form.cause} onChange={(e) => set("cause", e.target.value)} placeholder="Possible cause (optional)" />
          </Field>
          <Field label="Date / Time" required error={errors.alarmed_at}>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.alarmed_at}
              onChange={(e) => set("alarmed_at", e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              {ALARM_STATUSES.map((s) => (
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
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Alarm"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Alarm">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete alarm{" "}
          <span className="font-semibold text-slate-900 dark:text-white">{deleting?.alarm_code}</span>?
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

function toLocalDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}