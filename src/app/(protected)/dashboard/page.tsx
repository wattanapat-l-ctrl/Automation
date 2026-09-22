"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Factory,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import type { Machine, Alarm } from "@/lib/supabase/types";

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${accent}`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function machineStatusColor(status: string) {
  switch (status) {
    case "Running":
      return "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30";
    case "Stop":
      return "bg-slate-500/15 text-slate-600 ring-slate-500/30";
    case "Alarm":
      return "bg-red-500/15 text-red-600 ring-red-500/30";
    case "Maintenance":
      return "bg-amber-500/15 text-amber-600 ring-amber-500/30";
    default:
      return "bg-slate-500/15 text-slate-600 ring-slate-500/30";
  }
}

export default function DashboardPage() {
  const { loading: authLoading } = useAuth();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [openAlarms, setOpenAlarms] = useState<Alarm[]>([]);
  const [totalAlarms, setTotalAlarms] = useState(0);
  const [totalMaint, setTotalMaint] = useState(0);
  const [maintThisMonth, setMaintThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const today = new Date();
      const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toISOString();

      const firstOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      ).toISOString();

      const [machinesRes, alarmsRes, openRes, maintRes, maintMonthRes] =
        await Promise.all([
          supabase
            .from("machines")
            .select("id, machine_id, machine_name, status")
            .order("machine_id"),
          supabase
            .from("alarms")
            .select("id", { count: "exact", head: true })
            .gte("alarmed_at", startOfToday),
          supabase
            .from("alarms")
            .select(
              "id, machine_id, alarm_code, description, status, alarmed_at, machines(machine_id, machine_name)"
            )
            .in("status", ["Open", "In Progress"])
            .order("alarmed_at", { ascending: false })
            .limit(8),
          supabase
            .from("maintenance_records")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("maintenance_records")
            .select("id", { count: "exact", head: true })
            .gte("maintenance_date", firstOfMonth),
        ]);

      setMachines((machinesRes.data ?? []) as Machine[]);
      setTotalAlarms(alarmsRes.count ?? 0);
      setOpenAlarms((openRes.data ?? []) as unknown as Alarm[]);
      setTotalMaint(maintRes.count ?? 0);
      setMaintThisMonth(maintMonthRes.count ?? 0);
      setLoading(false);
    }

    load();
  }, []);

  const statusCounts = {
    Running: machines.filter((m) => m.status === "Running").length,
    Stop: machines.filter((m) => m.status === "Stop").length,
    Alarm: machines.filter((m) => m.status === "Alarm").length,
    Maintenance: machines.filter((m) => m.status === "Maintenance").length,
  };

  const machineChartData = [
    { name: "Running", count: statusCounts.Running },
    { name: "Stop", count: statusCounts.Stop },
    { name: "Alarm", count: statusCounts.Alarm },
    { name: "Maintenance", count: statusCounts.Maintenance },
  ];

  const busy = loading || authLoading;

  if (busy) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Overview of machines, alarms and maintenance activities.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Machines"
          value={machines.length}
          icon={<Factory className="h-5 w-5 text-sky-500" />}
          accent="bg-sky-500/15 text-sky-500 ring-sky-500/30"
        />
        <StatCard
          label="Alarms Today"
          value={totalAlarms}
          icon={<BellRing className="h-5 w-5 text-red-500" />}
          accent="bg-red-500/15 text-red-500 ring-red-500/30"
        />
        <StatCard
          label="Maintenance Jobs"
          value={totalMaint}
          icon={<Wrench className="h-5 w-5 text-amber-500" />}
          accent="bg-amber-500/15 text-amber-500 ring-amber-500/30"
        />
        <StatCard
          label="Maintenance This Month"
          value={maintThisMonth}
          icon={<Activity className="h-5 w-5 text-emerald-500" />}
          accent="bg-emerald-500/15 text-emerald-500 ring-emerald-500/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className={`rounded-2xl border border-slate-200 p-4 dark:border-slate-800 ${machineStatusColor(status)}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{status}</span>
              <span className="text-xl font-bold">{count}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Machine Status Overview
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={machineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "0.5rem",
                  color: "#f1f5f9",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Open Alarms
          </h2>
          {openAlarms.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No open alarms. All clear! 🎉
            </p>
          ) : (
            <ul className="space-y-3">
              {openAlarms.map((alarm) => {
                const machine = alarm.machines as unknown as {
                  machine_id?: string;
                  machine_name?: string;
                } | null;
                return (
                  <li
                    key={alarm.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        [{machine?.machine_id ?? "?"}]{" "}
                        {machine?.machine_name ?? "Unknown"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {alarm.alarm_code} · {alarm.description}
                      </p>
                    </div>
                    <Badge value={alarm.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}