import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { StrategyAllocation } from "../../types";

const COLORS = ["#2563eb", "#10b981", "#0ea5e9", "#8b5cf6", "#60a5fa"];

interface AllocationPieChartProps {
  allocations: StrategyAllocation[];
}

export function AllocationPieChart({ allocations = [] }: AllocationPieChartProps) {
  const data = allocations.map((a) => ({
    name: a.protocol,
    value: a.allocationBps / 100,
    apy: a.currentApy,
  }));

  const totalPct = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="relative w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
            cornerRadius={4}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="glass-card glass-card-elevated rounded-lg px-3 py-2 text-xs shadow-xl">
                  <p className="font-medium text-white">{d.name}</p>
                  <p className="text-[#8b8fa3] mt-0.5">{d.value}% allocated</p>
                  <p className="text-emerald-400">{d.apy}% APY</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{totalPct}%</p>
          <p className="text-[10px] text-[#565a6e] uppercase tracking-wider font-medium">Allocated</p>
        </div>
      </div>
    </div>
  );
}
