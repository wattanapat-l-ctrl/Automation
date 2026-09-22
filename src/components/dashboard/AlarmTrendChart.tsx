"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "0.5rem",
  color: "#f1f5f9",
};

export function AlarmTrendChart({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
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
  );
}