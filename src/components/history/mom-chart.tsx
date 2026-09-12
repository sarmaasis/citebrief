"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MomChart({
  data,
}: {
  data: Array<{ period: string; mentioned: number }>;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-cb-muted">No history yet. Run a report to start MoM tracking.</p>;
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#737373" }} axisLine={{ stroke: "#E8E6E1" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{
              border: "1px solid #E8E6E1",
              borderRadius: 8,
              background: "#FFFFFF",
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="mentioned" stroke="#0B3D2E" strokeWidth={2} dot={false} name="Mentioned" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
