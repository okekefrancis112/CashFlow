import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatUsd } from "../../lib/format";

interface DataPoint {
  date: string;
  tvl: number;
}

interface TvlChartProps {
  data: DataPoint[];
}

export function TvlChart({ data }: TvlChartProps) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#565a6e", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.04)" }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fill: "#565a6e", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatUsd(v)}
            width={55}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.[0]) return null;
              return (
                <div className="glass-card glass-card-elevated rounded-lg px-3 py-2 text-xs shadow-xl">
                  <p className="text-[#565a6e]">{label}</p>
                  <p className="font-semibold text-indigo-400 mt-0.5">{formatUsd(Number(payload[0].value))}</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="tvl"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#tvlGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
