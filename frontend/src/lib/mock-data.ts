import type { VaultStats, YieldSource, StrategyAllocation } from "../types";

export const MOCK_VAULT_STATS: VaultStats = {
  tvl: 2_450_000,
  totalShares: 2_450_000_000_000,
  sharePrice: 1000000,
  weightedApy: 8.74,
  activeStrategies: 5,
  supportedAssets: ["sBTC", "USDCx"],
  isPaused: false,
};

export const MOCK_YIELDS: YieldSource[] = [
  { id: "zest-sbtc", protocol: "Zest Protocol", asset: "sBTC", apy: 5.2, tvl: 45_000_000, risk: "low", type: "lending", description: "sBTC supply lending" },
  { id: "bitflow-lp", protocol: "Bitflow", asset: "sBTC/STX", apy: 12.4, tvl: 28_000_000, risk: "medium", type: "lp", description: "Concentrated liquidity pool" },
  { id: "stackingdao", protocol: "StackingDAO", asset: "stSTX", apy: 8.1, tvl: 120_000_000, risk: "low", type: "stacking", description: "Liquid stacking" },
  { id: "hermetica", protocol: "Hermetica", asset: "hBTC", apy: 15.3, tvl: 12_000_000, risk: "high", type: "vault", description: "Onchain BTC trading strategy" },
  { id: "sbtc-base", protocol: "Stacks Network", asset: "sBTC", apy: 5.0, tvl: 545_000_000, risk: "low", type: "stacking", description: "Base sBTC stacking rewards" },
  { id: "zest-usdcx", protocol: "Zest Protocol", asset: "USDCx", apy: 6.8, tvl: 15_000_000, risk: "low", type: "lending", description: "USDCx supply lending" },
  { id: "bitflow-usdcx", protocol: "Bitflow", asset: "USDCx/sBTC", apy: 18.7, tvl: 8_000_000, risk: "high", type: "lp", description: "USDCx/sBTC liquidity pool" },
];

export const MOCK_ALLOCATIONS: StrategyAllocation[] = [
  { sourceId: "zest-sbtc", protocol: "Zest Protocol", asset: "sBTC", allocationBps: 2500, currentApy: 5.2 },
  { sourceId: "bitflow-lp", protocol: "Bitflow", asset: "sBTC/STX", allocationBps: 2000, currentApy: 12.4 },
  { sourceId: "stackingdao", protocol: "StackingDAO", asset: "stSTX", allocationBps: 3000, currentApy: 8.1 },
  { sourceId: "hermetica", protocol: "Hermetica", asset: "hBTC", allocationBps: 1000, currentApy: 15.3 },
  { sourceId: "sbtc-base", protocol: "Stacks Network", asset: "sBTC", allocationBps: 1500, currentApy: 5.0 },
];
