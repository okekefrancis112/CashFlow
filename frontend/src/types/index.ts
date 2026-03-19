export interface YieldSource {
  id: string;
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
  type: string;
  description: string;
  apyAvailable?: boolean; // false when APY data couldn't be fetched
}

export interface StrategyAllocation {
  sourceId: string;
  protocol: string;
  asset: string;
  allocationBps: number;
  currentApy: number;
}

export interface VaultStats {
  tvl: number;
  totalShares: number;
  sharePrice: number;
  weightedApy: number;
  activeStrategies: number;
  supportedAssets: string[];
  isPaused: boolean;
}

export type RiskLevel = "low" | "medium" | "high";
export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type TransactionState = "idle" | "signing" | "pending" | "confirmed" | "failed";
