import { cn } from "../../lib/utils";
import { useInvestmentData } from "../../hooks/useInvestmentData";

const ADAPTER_COLORS: Record<string, string> = {
  Zest: "bg-blue-500",
  StackingDAO: "bg-emerald-500",
  Bitflow: "bg-sky-500",
  Hermetica: "bg-violet-500",
};

function formatAmount(micro: number | null | undefined): string {
  const val = micro ?? 0;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function InvestmentPanel() {
  const {
    adapters,
    totalAssets,
    recentHarvests,
    recentRebalances,
    loading,
    harvesting,
    rebalancing,
    triggerHarvest,
    triggerRebalance,
  } = useInvestmentData();

  if (loading) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-white mb-4">Investment Status</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-white">Investment Status</h2>
          <p className="text-[11px] text-[#565a6e] mt-0.5">
            Live capital allocation across Zest, StackingDAO, Bitflow &amp; Hermetica
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-medium text-emerald-400">Active</span>
        </div>
      </div>

      {/* Total Assets */}
      <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <p className="text-[11px] font-medium text-[#565a6e] uppercase tracking-wider">Total Invested</p>
        <p className="text-xl font-bold text-white mt-1">{formatAmount(totalAssets)}</p>
      </div>

      {/* Allocation bars */}
      <div className="space-y-2.5 mb-5">
        {adapters.map((adapter) => {
          const pct = parseFloat(adapter.currentPct) || 0;
          const targetPct = parseFloat(adapter.targetPct) || 0;
          const drift = Math.abs(pct - targetPct);

          return (
            <div
              key={adapter.name}
              className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", ADAPTER_COLORS[adapter.name] || "bg-gray-500")} />
                  <span className="text-[13px] font-medium text-white">{adapter.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[#8b8fa3]">
                    {pct.toFixed(1)}% / {targetPct.toFixed(1)}%
                  </span>
                  {drift > 5 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                      drift
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", ADAPTER_COLORS[adapter.name] || "bg-gray-500")}
                  style={{ width: `${Math.min(pct, 100)}%`, opacity: 0.7 }}
                />
              </div>
              <p className="text-[10px] text-[#565a6e] mt-1">{formatAmount(adapter.balance)} allocated</p>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={triggerHarvest}
          disabled={harvesting}
          className="flex-1 py-2.5 rounded-xl text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all duration-200 disabled:opacity-40"
        >
          {harvesting ? "Harvesting..." : "Harvest Yield"}
        </button>
        <button
          onClick={triggerRebalance}
          disabled={rebalancing}
          className="flex-1 py-2.5 rounded-xl text-[11px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all duration-200 disabled:opacity-40"
        >
          {rebalancing ? "Rebalancing..." : "Rebalance"}
        </button>
      </div>

      {/* Recent Activity */}
      <div>
        <p className="text-[11px] font-medium text-[#565a6e] uppercase tracking-wider mb-2">Recent Activity</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {[
            ...recentHarvests.map((h) => ({
              time: h.timestamp,
              text: `Harvested ${formatAmount(h.yieldAmount)} from ${h.adapter}`,
              type: "harvest" as const,
            })),
            ...recentRebalances.map((r) => ({
              time: r.timestamp,
              text: `${r.direction === "deposit" ? "Deposited" : "Withdrew"} ${formatAmount(r.amount)} ${r.direction === "deposit" ? "to" : "from"} ${r.adapter}`,
              type: "rebalance" as const,
            })),
          ]
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 8)
            .map((item, i) => (
              <div
                key={`${item.time}-${i}`}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-1 h-1 rounded-full",
                      item.type === "harvest" ? "bg-emerald-400" : "bg-blue-400"
                    )}
                  />
                  <span className="text-[11px] text-[#8b8fa3]">{item.text}</span>
                </div>
                <span className="text-[10px] text-[#565a6e] shrink-0 ml-2">{timeAgo(item.time)}</span>
              </div>
            ))}

          {recentHarvests.length === 0 && recentRebalances.length === 0 && (
            <p className="text-[11px] text-[#565a6e] text-center py-4">
              No activity yet. Click Harvest or Rebalance to start.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
