import { StatsGrid } from "../components/vault/StatsGrid";
import { DepositWithdrawPanel } from "../components/vault/DepositWithdrawPanel";
import { HowItWorks } from "../components/vault/HowItWorks";
import { StrategyPanel } from "../components/strategy/StrategyPanel";
import { YieldTable } from "../components/yields/YieldTable";
import { PremiumSection } from "../components/premium/PremiumSection";
import { CardSkeleton } from "../components/common/LoadingSkeleton";
import type { VaultStats, YieldSource, StrategyAllocation } from "../types";

interface DashboardProps {
  vaultStats: VaultStats | null;
  yields: YieldSource[];
  allocations: StrategyAllocation[];
  weightedApy: number;
  loading: boolean;
  isConnected: boolean;
  address: string | null;
  onConnect: () => void;
}

export function Dashboard({
  vaultStats,
  yields,
  allocations,
  weightedApy,
  loading,
  isConnected,
  address,
  onConnect,
}: DashboardProps) {
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-[#565a6e] mt-1">Overview of your vault performance and strategies</p>
      </div>

      <StatsGrid vaultStats={vaultStats} weightedApy={weightedApy} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in-up delay-200">
        <div className="lg:col-span-1 space-y-5">
          <div className="animate-fade-in-left delay-300">
            <DepositWithdrawPanel isConnected={isConnected} address={address} onConnect={onConnect} />
          </div>
          <div className="animate-fade-in-left delay-500">
            <HowItWorks />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="animate-fade-in-right delay-300">
            <StrategyPanel allocations={allocations} />
          </div>
          <div className="animate-fade-in-right delay-500">
            <YieldTable yields={yields} />
          </div>
        </div>
      </div>

      <div className="animate-fade-in-up delay-600">
        <PremiumSection />
      </div>
    </div>
  );
}
