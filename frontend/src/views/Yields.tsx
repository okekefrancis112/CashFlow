import { useState } from "react";
import { Search } from "lucide-react";
import { YieldTable } from "../components/yields/YieldTable";
import { TableSkeleton } from "../components/common/LoadingSkeleton";
import { cn } from "../lib/utils";
import type { YieldSource, RiskLevel } from "../types";

const RISK_FILTERS: Array<{ label: string; value: RiskLevel | "all" }> = [
  { label: "All", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

interface YieldsPageProps {
  yields: YieldSource[];
  loading: boolean;
}

export function YieldsPage({ yields, loading }: YieldsPageProps) {
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = yields.filter((y) => {
    if (riskFilter !== "all" && y.risk !== riskFilter) return false;
    if (search && !y.protocol.toLowerCase().includes(search.toLowerCase()) && !y.asset.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold"><span className="hero-gradient-warm text-glow-warm">Yield Sources</span></h1>
        <p className="text-sm text-[#565a6e] mt-1">Live APY and TVL across all integrated Stacks DeFi protocols</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up delay-100">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#565a6e]" />
          <input
            type="text"
            placeholder="Search protocols..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full input-glass !pl-10"
          />
        </div>
        <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/[0.04] rounded-xl">
          {RISK_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRiskFilter(value)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                riskFilter === value
                  ? "bg-white/[0.06] text-white"
                  : "text-[#565a6e] hover:text-[#8b8fa3]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-in-up delay-200">
        {loading ? (
          <TableSkeleton rows={7} />
        ) : (
          <YieldTable yields={filtered} compact />
        )}
      </div>
    </div>
  );
}
