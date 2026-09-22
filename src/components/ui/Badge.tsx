const COLORS: Record<string, string> = {
  Running: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
  Stop: "bg-slate-500/15 text-slate-600 ring-slate-500/30",
  Alarm: "bg-red-500/15 text-red-600 ring-red-500/30",
  Maintenance: "bg-amber-500/15 text-amber-600 ring-amber-500/30",
  Open: "bg-red-500/15 text-red-600 ring-red-500/30",
  "In Progress": "bg-amber-500/15 text-amber-600 ring-amber-500/30",
  Closed: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
  Pending: "bg-slate-500/15 text-slate-600 ring-slate-500/30",
  Completed: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
  "Waiting Part": "bg-orange-500/15 text-orange-600 ring-orange-500/30",
  admin: "bg-violet-500/15 text-violet-600 ring-violet-500/30",
  technician: "bg-sky-500/15 text-sky-600 ring-sky-500/30",
  viewer: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
};

const DEFAULT_COLOR = "bg-slate-500/15 text-slate-600 ring-slate-500/30";

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        COLORS[value] ?? DEFAULT_COLOR
      }`}
    >
      {value}
    </span>
  );
}