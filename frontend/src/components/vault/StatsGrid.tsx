import { DollarSign, TrendingUp, Layers, Coins } from "lucide-react";
import { StatCard } from "../common/StatCard";
import { formatUsd } from "../../lib/format";
import type { VaultStats } from "../../types";

interface StatsGridProps {
  vaultStats: VaultStats | null;
  weightedApy: number;
}

export function StatsGrid({ vaultStats, weightedApy }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Value Locked"
        value={formatUsd(vaultStats?.tvl || 0)}
        sub="Across all strategies"
        icon={<DollarSign className="w-4 h-4" />}
        className="animate-fade-in-up"
      />
      <StatCard
        label="Weighted APY"
        value={`${(Number(weightedApy) || 0).toFixed(1)}%`}
        sub="AI-optimized allocation"
        icon={<TrendingUp className="w-4 h-4" />}
        className="animate-fade-in-up delay-100"
        highlight
      />
      <StatCard
        label="Active Strategies"
        value={`${vaultStats?.activeStrategies || 0}`}
        sub="DeFi protocols"
        icon={<Layers className="w-4 h-4" />}
        className="animate-fade-in-up delay-200"
      />
      <StatCard
        label="Share Price"
        value={`${((Number(vaultStats?.sharePrice) || 1000000) / 1000000).toFixed(4)}`}
        sub="cfYIELD per token"
        icon={<Coins className="w-4 h-4" />}
        className="animate-fade-in-up delay-300"
      />
    </div>
  );
}
