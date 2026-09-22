"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle,
  Factory,
  Play,
  Radio,
  Square,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
import { btnPrimary, btnSecondary } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import {
  fireRandomAlarm,
  resolveRandomAlarm,
  seedDemoData,
} from "@/lib/demo";
import type { Machine, Alarm, MaintenanceRecord } from "@/lib/supabase/types";

function StatCard({
  label,
  value,
  icon,
  gradient,
  glow,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  glow: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:shadow-black/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg ${glow} transition group-hover:scale-105`}
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

function statusDot(status: string) {
  switch (status) {
    case "Running":
      return "bg-emerald-500";
    case "Stop":
      return "bg-slate-400";
    case "Alarm":
      return "bg-red-500";
    case "Maintenance":
      return "bg-amber-500";
    default:
      return "bg-slate-400";
  }
}

function statusBar(status: string) {
  switch (status) {
    case "Running":
      return "bg-emerald-500";
    case "Stop":
      return "bg-slate-400";
    case "Alarm":
      return "bg-red-500";
    case "Maintenance":
      return "bg-amber-500";
    default:
      return "bg-slate-400";
  }
}

function useClock(intervalMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

type ActivityItem = {
  kind: "alarm" | "maintenance";
  ts: Date;
  machine: string;
  title: string;
  status: string;
};

const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "0.5rem",
  color: "#f1f5f9",
};

export default function DashboardPage() {
  const { loading: authLoading, isAdmin } = useAuth();
  const supabase = createClient();
  const { tick, live } = useRealtime([
    "machines",
    "alarms",
    "maintenance_records",
  ]);
  const liveClock = useClock(1000);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [openAlarms, setOpenAlarms] = useState<Alarm[]>([]);
  const [totalAlarms, setTotalAlarms] = useState(0);
  const [totalMaint, setTotalMaint] = useState(0);
  const [maintThisMonth, setMaintThisMonth] = useState(0);
  const [trend, setTrend] = useState<{ day: string; count: number }[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [simBusy, setSimBusy] = useState<string | null>(null);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [autoSim, setAutoSim] = useState(false);
  const autoRef = useRef(false);

  const load = useCallback(() => {
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

    return Promise.all([
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
        .limit(6),
      supabase
        .from("maintenance_records")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("maintenance_records")
        .select("id", { count: "exact", head: true })
        .gte("maintenance_date", firstOfMonth),
      supabase
        .from("alarms")
        .select("alarmed_at"),
      supabase
        .from("alarms")
        .select(
          "id, alarm_code, description, status, alarmed_at, machines(machine_id)"
        )
        .order("alarmed_at", { ascending: false })
        .limit(5),
      supabase
        .from("maintenance_records")
        .select(
          "id, maintenance_type, problem, status, maintenance_date, created_at, machines(machine_id)"
        )
        .order("created_at", { ascending: false })
        .limit(5),
    ]).then(([r1, r2, r3, r4, r5, r6, r7, r8]) => {
      setMachines((r1.data ?? []) as Machine[]);
      setTotalAlarms(r2.count ?? 0);
      setOpenAlarms((r3.data ?? []) as unknown as Alarm[]);
      setTotalMaint(r4.count ?? 0);
      setMaintThisMonth(r5.count ?? 0);

      const byDay = new Map<string, number>();
      for (const a of (r6.data ?? []) as unknown as { alarmed_at: string }[]) {
        const d = new Date(a.alarmed_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
      const trendArr: { day: string; count: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        trendArr.push({
          day: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
          count: byDay.get(key) ?? 0,
        });
      }
      setTrend(trendArr);

      const alarmsFeed = ((r7.data ?? []) as Alarm[]).map((x) => ({
        kind: "alarm" as const,
        ts: new Date(x.alarmed_at),
        machine: x.machines?.machine_id ?? "?",
        title: `${x.alarm_code} · ${x.description}`,
        status: x.status,
      }));
      const maintFeed = ((r8.data ?? []) as MaintenanceRecord[]).map((x) => ({
        kind: "maintenance" as const,
        ts: new Date(x.created_at ?? x.maintenance_date),
        machine: x.machines?.machine_id ?? "?",
        title: `${x.maintenance_type} · ${x.problem}`,
        status: x.status,
      }));
      setActivity(
        [...alarmsFeed, ...maintFeed]
          .sort((a, b) => b.ts.getTime() - a.ts.getTime())
          .slice(0, 8)
      );

      setLastUpdated(new Date());
      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  function pushLog(msg: string) {
    setSimLog((prev) => [msg, ...prev].slice(0, 4));
  }

  async function handleSeed() {
    setSimBusy("seed");
    pushLog("Seeding sample data…");
    try {
      const res = await seedDemoData();
      pushLog(
        `Done: +${res.machines} machines, +${res.alarms} alarms, +${res.maintenance} maintenance.`
      );
      void load();
    } catch (e) {
      pushLog(`Seed failed: ${(e as Error).message}`);
    } finally {
      setSimBusy(null);
    }
  }

  async function handleFire() {
    setSimBusy("fire");
    const res = await fireRandomAlarm();
    pushLog(res.ok ? res.message : `Failed: ${res.message}`);
    setSimBusy(null);
    void load();
  }

  async function handleResolve() {
    setSimBusy("resolve");
    const res = await resolveRandomAlarm();
    pushLog(res.ok ? res.message : `Failed: ${res.message}`);
    setSimBusy(null);
    void load();
  }

  async function simulateStep() {
    if (!autoRef.current) return;
    const { count } = await supabase
      .from("alarms")
      .select("id", { count: "exact", head: true })
      .eq("status", "Open");
    const doFire = (count ?? 0) < 12 && Math.random() < 0.6;
    const res = doFire ? await fireRandomAlarm() : await resolveRandomAlarm();
    pushLog(res.ok ? res.message : `Failed: ${res.message}`);
    void load();
  }

  useEffect(() => {
    autoRef.current = autoSim;
    if (!autoSim) return;
    const t = setInterval(() => {
      void simulateStep();
    }, 3500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSim]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Overview of machines, alarms and maintenance activities.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span
              className={`relative flex h-2.5 w-2.5 ${live ? "" : "opacity-60"}`}
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </span>
          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <span className="font-mono text-sm tabular-nums text-slate-700 dark:text-slate-200">
            {liveClock ? liveClock.toLocaleTimeString("en-GB") : "\u00A0"}
          </span>
          <span className="hidden font-mono text-xs text-slate-400 sm:inline">
            · updated{" "}
            {lastUpdated
              ? lastUpdated.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "—"}
          </span>
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-500/10 via-transparent to-violet-500/10 p-4 backdrop-blur-sm dark:border-sky-400/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-md shadow-sky-500/30">
                <Sparkles className="h-4 w-4" />
              </span>
              Simulation Lab
              <span className="hidden text-xs font-normal text-slate-500 dark:text-slate-400 sm:inline">
                · Generate demo data or stream live alarms for demonstration
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSeed}
                disabled={simBusy !== null}
                className={btnPrimary}
              >
                {simBusy === "seed" ? "Seeding…" : "Generate Sample Data"}
              </button>
              <button
                onClick={handleFire}
                disabled={simBusy !== null}
                className={btnSecondary}
              >
                <BellRing className="h-4 w-4" />
                Fire Alarm
              </button>
              <button
                onClick={handleResolve}
                disabled={simBusy !== null}
                className={btnSecondary}
              >
                <CheckCircle className="h-4 w-4" />
                Resolve One
              </button>
              <button
                onClick={() => setAutoSim((v) => !v)}
                className={
                  autoSim
                    ? "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
                    : btnSecondary
                }
              >
                {autoSim ? (
                  <>
                    <Square className="h-4 w-4" /> Stop Auto-Sim
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 text-emerald-500" /> Auto-Simulate
                  </>
                )}
              </button>
            </div>
          </div>
          {simLog.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-sky-500/15 pt-3">
              {simLog.map((line, i) => (
                <p
                  key={i}
                  className="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-slate-300"
                >
                  <Radio className="h-3 w-3 shrink-0 text-sky-400" />
                  {line}
                  {autoSim && i === 0 && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Machines"
          value={machines.length}
          icon={<Factory className="h-5 w-5" />}
          gradient="from-sky-500 to-blue-600"
          glow="shadow-sky-500/30"
        />
        <StatCard
          label="Alarms Today"
          value={totalAlarms}
          icon={<BellRing className="h-5 w-5" />}
          gradient="from-red-500 to-rose-600"
          glow="shadow-red-500/30"
        />
        <StatCard
          label="Maintenance Jobs"
          value={totalMaint}
          icon={<Wrench className="h-5 w-5" />}
          gradient="from-amber-500 to-orange-600"
          glow="shadow-amber-500/30"
        />
        <StatCard
          label="Maintenance This Month"
          value={maintThisMonth}
          icon={<Activity className="h-5 w-5" />}
          gradient="from-emerald-500 to-teal-600"
          glow="shadow-emerald-500/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className={`rounded-2xl border border-slate-200/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 ${machineStatusColor(status)}`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className={`h-2 w-2 rounded-full ${statusDot(status)}`} />
                {status}
              </span>
              <span className="text-xl font-bold">{count}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-950/10 dark:bg-white/10">
              <div
                className={`h-full rounded-full ${statusBar(status)}`}
                style={{
                  width: `${
                    machines.length ? (count / machines.length) * 100 : 0
                  }%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30">
              <Activity className="h-4 w-4" />
            </span>
            Alarm Activity · Last 14 Days
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Number of recorded alarms per day
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="alarmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
              <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="count"
                name="Alarms"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#alarmGrad)"
                dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Recent Activity
          </h2>
          {activity.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Nothing yet — try the Simulator.
            </p>
          ) : (
            <ul className="space-y-3">
              {activity.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      item.kind === "alarm"
                        ? "bg-red-500/15 text-red-500 dark:text-red-400"
                        : "bg-amber-500/15 text-amber-500 dark:text-amber-400"
                    }`}
                  >
                    {item.kind === "alarm" ? (
                      <BellRing className="h-3.5 w-3.5" />
                    ) : (
                      <Wrench className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-white">
                      [{item.machine}] {item.title}
                    </p>
                    <p className="flex items-center gap-2 text-[11px] text-slate-400">
                      {item.ts.toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      <Badge value={item.status} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30">
              <Activity className="h-4 w-4" />
            </span>
            Machine Status Overview
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={machineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30">
              <AlertTriangle className="h-4 w-4" />
            </span>
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
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
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