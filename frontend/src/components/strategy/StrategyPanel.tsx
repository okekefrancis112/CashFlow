import { cn } from "../../lib/utils";
import { formatApy } from "../../lib/format";
import { AllocationPieChart } from "../charts/AllocationPieChart";
import type { StrategyAllocation } from "../../types";

const COLORS = [
  "bg-blue-600",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-blue-400",
];

interface StrategyPanelProps {
  allocations: StrategyAllocation[];
}

export function StrategyPanel({ allocations = [] }: StrategyPanelProps) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-white">AI Strategy Allocation</h2>
        <span className="badge badge-emerald text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="animate-scale-in delay-200">
          <AllocationPieChart allocations={allocations} />
        </div>

        {/* Protocol cards */}
        <div className="space-y-2.5">
          {allocations.map((a, i) => (
            <div
              key={a.sourceId}
              className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.04] transition-all duration-200 animate-fade-in-right group"
              style={{ animationDelay: `${(i + 1) * 80}ms` }}
            >
              <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", COLORS[i % COLORS.length])} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white">{a.protocol}</p>
                <p className="text-[11px] text-[#565a6e]">{a.asset}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-semibold text-emerald-400">{formatApy(a.currentApy)}</p>
                <p className="text-[11px] text-[#565a6e]">{a.allocationBps / 100}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
