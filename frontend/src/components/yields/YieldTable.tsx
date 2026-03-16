import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { RiskBadge } from "../common/RiskBadge";
import { formatUsd, formatApy } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { YieldSource } from "../../types";

type SortKey = "protocol" | "apy" | "tvl" | "risk";
type SortDir = "asc" | "desc";

interface YieldTableProps {
  yields: YieldSource[];
  compact?: boolean;
}

export function YieldTable({ yields, compact = false }: YieldTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("apy");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const sorted = [...yields].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "protocol") cmp = a.protocol.localeCompare(b.protocol);
    else if (sortKey === "apy") cmp = a.apy - b.apy;
    else if (sortKey === "tvl") cmp = a.tvl - b.tvl;
    else if (sortKey === "risk") cmp = (riskOrder[a.risk] ?? 0) - (riskOrder[b.risk] ?? 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const renderSortHeader = (label: string, key: SortKey, align?: "right") => (
    <th
      key={key}
      onClick={() => handleSort(key)}
      className={cn(
        "pb-3 font-medium cursor-pointer transition-colors select-none text-[11px] uppercase tracking-wider",
        "text-[#565a6e] hover:text-[#8b8fa3]",
        align === "right" && "text-right"
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("w-3 h-3", sortKey === key ? "text-blue-400" : "text-[#2a2a42]")} />
      </span>
    </th>
  );

  return (
    <div className={cn(!compact && "glass-card p-6")}>
      {!compact && (
        <h2 className="text-base font-semibold text-white mb-5">Live Yield Sources</h2>
      )}
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {renderSortHeader("Protocol", "protocol")}
              <th className="text-left pb-3 font-medium text-[11px] uppercase tracking-wider text-[#565a6e]">Asset</th>
              {renderSortHeader("APY", "apy", "right")}
              {renderSortHeader("TVL", "tvl", "right")}
              {renderSortHeader("Risk", "risk", "right")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((y, i) => (
              <tr
                key={y.id}
                className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors duration-150 animate-row"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <td className="py-3.5 font-medium text-white text-[13px]">{y.protocol}</td>
                <td className="py-3.5 text-[#8b8fa3] text-[13px]">{y.asset}</td>
                <td className="py-3.5 text-right font-semibold text-emerald-400 text-[13px]">{formatApy(y.apy)}</td>
                <td className="py-3.5 text-right text-[#8b8fa3] text-[13px]">{formatUsd(y.tvl)}</td>
                <td className="py-3.5 text-right"><RiskBadge risk={y.risk} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
