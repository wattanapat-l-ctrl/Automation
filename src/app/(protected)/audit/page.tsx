"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, ShieldAlert, ShieldCheck, Trash2, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inputClass, btnSecondary } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { exportCsv } from "@/lib/csv";

type AuditEntry = {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_by: string | null;
  changed_by_name: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

function actionBadge(action: string) {
  const map: Record<string, string> = {
    INSERT: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
    UPDATE: "bg-amber-500/15 text-amber-600 ring-amber-500/30",
    DELETE: "bg-red-500/15 text-red-600 ring-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${map[action] ?? "bg-slate-500/15 text-slate-600 ring-slate-500/30"}`}
    >
      {action}
    </span>
  );
}

export default function AuditPage() {
  const { loading: authLoading, isAdmin } = useAuth();
  const supabase = createClient();
  const { tick } = useRealtime(["audit_logs"]);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [tableFilter, setTableFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");

  const load = useCallback(() => {
    return supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) {
          if (/audit_logs/i.test(error.message)) setSetupNeeded(true);
          return;
        }
        setEntries((data ?? []) as unknown as AuditEntry[]);
        setSetupNeeded(false);
      });
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load, tick]);

  function handleExport() {
    exportCsv(
      `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date / Time", "Table", "Action", "Changed By", "Record ID", "Old Data", "New Data"],
      entries.map((e) => [
        new Date(e.created_at).toLocaleString("en-GB"),
        e.table_name,
        e.action,
        e.changed_by_name ?? "system",
        e.record_id,
        e.old_data ? JSON.stringify(e.old_data) : "",
        e.new_data ? JSON.stringify(e.new_data) : "",
      ])
    );
  }

  if (authLoading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Audit log is restricted to administrators only.
        </p>
      </div>
    );
  }

  const filtered = entries.filter((e) => {
    const matchesTable = tableFilter === "All" || e.table_name === tableFilter;
    const matchesAction = actionFilter === "All" || e.action === actionFilter;
    return matchesTable && matchesAction;
  });

  const tables = Array.from(new Set(entries.map((e) => e.table_name)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-6 w-6 text-violet-500" />
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every insert, update and delete across the system · {entries.length} entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className={btnSecondary} title="Refresh">
            <RefreshCcw className="h-4 w-4" />
          </button>
          <button
            onClick={handleExport}
            className={`${btnSecondary} inline-flex items-center gap-2`}
          >
            <DownloadIcon className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {setupNeeded ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-amber-700 dark:text-amber-300">
            <ShieldAlert className="h-5 w-5" /> Audit Log is not set up yet
          </h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              Open the{" "}
              <span className="font-mono text-xs">supabase/audit_log.sql</span> file in this
              project.
            </li>
            <li>
              Run it in the Supabase Dashboard → <b>SQL Editor</b> (calls{" "}
              <span className="font-mono text-xs">log_audit_action()</span> + creates the{" "}
              <span className="font-mono text-xs">audit_logs</span> table).
            </li>
            <li>Refresh this page — new changes to machines, alarms and maintenance will be tracked automatically.</li>
          </ol>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className={`${inputClass} w-auto`}
            >
              <option value="All">All Tables</option>
              {tables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className={`${inputClass} w-auto`}
            >
              <option value="All">All Actions</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-4 py-3">Date / Time</th>
                    <th className="px-4 py-3">Table</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Changed By</th>
                    <th className="px-4 py-3 text-right">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center text-slate-400">
                        No audit entries yet — actions will appear here as you add, edit or delete records.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {new Date(e.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                          {e.table_name}
                        </td>
                        <td className="px-4 py-3">{actionBadge(e.action)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {e.changed_by_name ?? "system"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                            <Eye className="h-3.5 w-3.5" />
                            {Object.keys(e.new_data ?? e.old_data ?? {}).length} field(s)
                            <Trash2 className="ml-1 h-3 w-3 text-red-400/60" aria-hidden />
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}