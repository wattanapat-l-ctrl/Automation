"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertTriangle, Wrench, Factory } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { btnSecondary } from "@/components/ui/Field";
import { useRealtime } from "@/hooks/useRealtime";
import type { Alarm, Machine, MaintenanceRecord } from "@/lib/supabase/types";

export default function MachineHistoryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supabase = createClient();
  const { tick } = useRealtime(["machines", "alarms", "maintenance_records"]);

  const [machine, setMachine] = useState<Machine | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      supabase.from("machines").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("alarms")
        .select("*")
        .eq("machine_id", id)
        .order("alarmed_at", { ascending: false }),
      supabase
        .from("maintenance_records")
        .select("*")
        .eq("machine_id", id)
        .order("maintenance_date", { ascending: false }),
    ]).then(([mRes, aRes, rRes]) => {
      if (!mRes.data) setNotFound(true);
      else setMachine(mRes.data as Machine);
      setAlarms((aRes.data ?? []) as Alarm[]);
      setRecords((rRes.data ?? []) as MaintenanceRecord[]);
      setLoading(false);
    });
  }, [supabase, id]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Loading machine history…</div>;
  }

  if (notFound || !machine) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-slate-400">Machine not found.</p>
        <Link href="/machines" className={btnSecondary}>
          <ArrowLeft className="h-4 w-4" /> Back to machines
        </Link>
      </div>
    );
  }

  const openAlarms = alarms.filter((a) => a.status !== "Closed").length;
  const lastAlarm = alarms[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/machines"
            className="mt-1 rounded-lg border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            title="Back to machines"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {machine.machine_name}
              </h1>
              <Badge value={machine.status} />
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
              {machine.machine_id} · {machine.machine_type} · {machine.location}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Alarms</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{alarms.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Open Alarms</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{openAlarms}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Maintenance Jobs</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30">
              <Wrench className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{records.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Last Alarm</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/30">
              <Factory className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {lastAlarm
              ? new Date(lastAlarm.alarmed_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30">
            <AlertTriangle className="h-4 w-4" />
          </span>
          Alarm History
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Cause</th>
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {alarms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No alarms recorded for this machine.
                  </td>
                </tr>
              ) : (
                alarms.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                      {a.alarm_code}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.description}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.cause ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(a.alarmed_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={a.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30">
            <Wrench className="h-4 w-4" />
          </span>
          Maintenance History
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3">Action Taken</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No maintenance records for this machine.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.maintenance_type}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.problem}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.action_taken ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.technician ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(r.maintenance_date + "T00:00:00").toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}