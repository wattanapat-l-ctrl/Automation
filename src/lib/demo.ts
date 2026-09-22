import { createClient } from "@/lib/supabase/client";

export const DEMO_MACHINES = [
  { machine_id: "MC-001", machine_name: "CNC Milling Machine", machine_type: "CNC", location: "Plant 1 - Building A" },
  { machine_id: "MC-002", machine_name: "Injection Molding Machine", machine_type: "Injection", location: "Plant 1 - Building B" },
  { machine_id: "MC-003", machine_name: "Robotic Assembly Line", machine_type: "Robot", location: "Plant 2 - Building A" },
  { machine_id: "MC-004", machine_name: "Conveyor Belt System", machine_type: "Conveyor", location: "Plant 2 - Building B" },
  { machine_id: "MC-005", machine_name: "Air Compressor", machine_type: "Utility", location: "Power Room" },
  { machine_id: "MC-006", machine_name: "Laser Cutting Machine", machine_type: "Laser", location: "Plant 1 - Building A" },
  { machine_id: "MC-007", machine_name: "Packaging Line", machine_type: "Packaging", location: "Plant 2 - Building B" },
  { machine_id: "MC-008", machine_name: "Industrial Oven", machine_type: "Thermal", location: "Plant 3 - Building A" },
  { machine_id: "MC-009", machine_name: "Palletizer Robot", machine_type: "Robot", location: "Plant 3 - Building B" },
  { machine_id: "MC-010", machine_name: "PLC Test Bench", machine_type: "Testing", location: "Lab 2" },
] as const;

const ALARM_CATALOG = [
  { description: "Motor current exceeded threshold", cause: "Worn bearings or phase imbalance" },
  { description: "Motor temperature above 90°C", cause: "Cooling fan blocked" },
  { description: "Servo drive fault detected", cause: "Encoder signal loss" },
  { description: "Hydraulic pressure below setpoint", cause: "Leak in hydraulic line" },
  { description: "Vibration level above limit", cause: "Unbalanced rotating part" },
  { description: "Emergency stop activated", cause: "Operator intervention" },
  { description: "Object jam detected at sensor", cause: "Misaligned product on line" },
  { description: "Lubricant level below minimum", cause: "Refill overdue" },
  { description: "PLC link lost with HMI", cause: "Network cable faulty" },
  { description: "Safety door interlock open", cause: "Door not closed properly" },
  { description: "Air intake filter dirty", cause: "Filter replacement needed" },
  { description: "Clamp torque below specification", cause: "Worn clutch or parts" },
] as const;

const MAINT_TYPES = ["Preventive", "Corrective", "Lubrication", "Inspection", "Calibration"] as const;

const MAINT_DATA = [
  { problem: "Scheduled preventive maintenance", action_taken: "Replaced filters, checked belts and alignment" },
  { problem: "Replace worn bearing set", action_taken: "Replaced bearings and re-ran alignment check" },
  { problem: "Gearbox lubrication overdue", action_taken: "Topped up oil and re-greased all points" },
  { problem: "Annual production-line inspection", action_taken: "Completed inspection checklist, all passes" },
  { problem: "Servo axis drifted out of position", action_taken: "Recalibrated position sensor and test-ran cycle" },
] as const;

const SEED_ALARM_COUNT = 14;
const SEED_MAINT_COUNT = 5;
const SEED_DAYS = 14;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTimeWithinLastDays(days: number): string {
  const now = Date.now();
  const daysAgo = now - Math.floor(Math.random() * days * 86400000);
  const d = new Date(daysAgo);
  d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  if (d.getTime() > now) d.setTime(now - Math.floor(Math.random() * 600000));
  return d.toISOString();
}

function randomAlarmCode(): string {
  return `AL-${100 + Math.floor(Math.random() * 900)}`;
}

export type SeedResult = { machines: number; alarms: number; maintenance: number };

export async function seedDemoData(): Promise<SeedResult> {
  const supabase = createClient();

  const { count: machineCount } = await supabase
    .from("machines")
    .select("id", { count: "exact", head: true });

  let insertedMachines = 0;
  if ((machineCount ?? 0) === 0) {
    const { data, error } = await supabase
      .from("machines")
      .insert(
        DEMO_MACHINES.map((m, i) => ({
          ...m,
          status: (["Running", "Running", "Stop", "Alarm", "Maintenance",
            "Running", "Running", "Stop", "Alarm", "Running"] as const)[i],
        }))
      )
      .select("id");
    if (error) throw error;
    insertedMachines = data?.length ?? 0;
    await sleep(300);
  }

  const { data: allMachines } = await supabase
    .from("machines")
    .select("id, machine_id, status")
    .limit(1000);

  if (!allMachines || allMachines.length === 0) {
    throw new Error("No machines available — please add machines first.");
  }

  const { count: alarmCount } = await supabase
    .from("alarms")
    .select("id", { count: "exact", head: true });

  let insertedAlarms = 0;
  if ((alarmCount ?? 0) === 0) {
    const rows = Array.from({ length: SEED_ALARM_COUNT }, () => {
      const machine = pick(allMachines);
      const alarm = pick(ALARM_CATALOG);
      const roll = Math.random();
      const status = (roll < 0.45 ? "Closed" : roll < 0.7 ? "In Progress" : "Open") as
        | "Closed"
        | "In Progress"
        | "Open";
      return {
        machine_id: machine.id,
        alarm_code: randomAlarmCode(),
        description: alarm.description,
        cause: alarm.cause,
        status,
        alarmed_at: randomTimeWithinLastDays(SEED_DAYS),
      };
    });
    const { data, error } = await supabase.from("alarms").insert(rows).select("id");
    if (error) throw error;
    insertedAlarms = data?.length ?? 0;
    await sleep(300);
  }

  const { count: maintCount } = await supabase
    .from("maintenance_records")
    .select("id", { count: "exact", head: true });

  let insertedMaint = 0;
  if ((maintCount ?? 0) === 0) {
    const rows = Array.from({ length: SEED_MAINT_COUNT }, () => {
      const machine = pick(allMachines);
      const item = pick(MAINT_DATA);
      const date = new Date(randomTimeWithinLastDays(SEED_DAYS));
      const roll = Math.random();
      return {
        machine_id: machine.id,
        maintenance_type: pick(MAINT_TYPES),
        problem: item.problem,
        action_taken: item.action_taken,
        technician: pick(["Somchai", "Nattapong", "Anuchit", "Katrin", "Pranee"]),
        status: (roll < 0.5 ? "Completed" : roll < 0.75 ? "In Progress" : "Pending") as
          | "Completed"
          | "In Progress"
          | "Pending",
        maintenance_date: date.toISOString().slice(0, 10),
      };
    });
    const { data, error } = await supabase.from("maintenance_records").insert(rows).select("id");
    if (error) throw error;
    insertedMaint = data?.length ?? 0;
  }

  return { machines: insertedMachines, alarms: insertedAlarms, maintenance: insertedMaint };
}

export async function fireRandomAlarm(): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient();

  const machines = await fetchMachines();
  if (machines.length === 0) return { ok: false, message: "No machines to alarm." };

  const target = machines.find((m) => m.status !== "Alarm") ?? machines[0];
  const alarm = pick(ALARM_CATALOG);

  const { error } = await supabase.from("alarms").insert({
    machine_id: target.id,
    alarm_code: randomAlarmCode(),
    description: alarm.description,
    cause: alarm.cause,
    status: "Open",
    alarmed_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: error.message };

  if (target.status !== "Alarm") {
    await supabase.from("machines").update({ status: "Alarm" }).eq("id", target.id);
  }

  return { ok: true, message: `Alarm raised on ${target.machine_id}: ${alarm.description}` };
}

export async function resolveRandomAlarm(): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient();

  const { data: openAlarms } = await supabase
    .from("alarms")
    .select("id, machine_id, alarm_code, machines(machine_id)")
    .eq("status", "Open")
    .order("alarmed_at", { ascending: true })
    .limit(8);

  const alarms = (openAlarms ?? []) as unknown as Array<{
    id: string;
    machine_id: string;
    alarm_code: string;
    machines?: { machine_id?: string } | null;
  }>;

  if (alarms.length === 0) return { ok: false, message: "No open alarms to resolve." };

  const target = pick(alarms);
  const { error } = await supabase
    .from("alarms")
    .update({ status: "Closed" })
    .eq("id", target.id);
  if (error) return { ok: false, message: error.message };

  await restoreMachineIfClear(target.machine_id);

  return {
    ok: true,
    message: `Resolved ${target.alarm_code} on ${target.machines?.machine_id ?? "machine"}.`,
  };
}

export async function statusSummary() {
  const supabase = createClient();
  const [machinesRes, alarmsRes, maintRes] = await Promise.all([
    supabase.from("machines").select("status"),
    supabase.from("alarms").select("status"),
    supabase.from("maintenance_records").select("status"),
  ]);
  return {
    machines: machinesRes.data ?? [],
    alarms: alarmsRes.data ?? [],
    maintenance: maintRes.data ?? [],
  };
}

async function fetchMachines(): Promise<
  { id: string; machine_id: string; status: string }[]
> {
  const supabase = createClient();
  const { data } = await supabase.from("machines").select("id, machine_id, status").limit(1000);
  return (data ?? []) as unknown as { id: string; machine_id: string; status: string }[];
}

async function restoreMachineIfClear(machineId: string) {
  const supabase = createClient();
  const { count } = await supabase
    .from("alarms")
    .select("id", { count: "exact", head: true })
    .eq("machine_id", machineId)
    .eq("status", "Open");
  if ((count ?? 0) === 0) {
    await supabase.from("machines").update({ status: "Running" }).eq("id", machineId);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}