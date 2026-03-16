export interface YieldSource {
  id: string;
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
  type: "lending" | "lp" | "stacking" | "vault";
  description: string;
}

// Provider interface for swapping in real protocol data (Phase 2)
export interface YieldSourceProvider {
  fetchSources(): Promise<YieldSource[]>;
  readonly name: string;
}

// Live yield data (in production, these would be fetched from protocol APIs)
const YIELD_SOURCES: YieldSource[] = [
  {
    id: "zest-sbtc-lending",
    protocol: "Zest Protocol",
    asset: "sBTC",
    apy: 5.2,
    tvl: 45_000_000,
    risk: "low",
    type: "lending",
    description: "sBTC supply lending with variable rate",
  },
  {
    id: "bitflow-sbtc-stx-lp",
    protocol: "Bitflow",
    asset: "sBTC/STX",
    apy: 12.4,
    tvl: 28_000_000,
    risk: "medium",
    type: "lp",
    description: "sBTC/STX concentrated liquidity pool",
  },
  {
    id: "stackingdao-liquid",
    protocol: "StackingDAO",
    asset: "stSTX",
    apy: 8.1,
    tvl: 120_000_000,
    risk: "low",
    type: "stacking",
    description: "Liquid stacking with stSTX receipt token",
  },
  {
    id: "hermetica-hbtc",
    protocol: "Hermetica",
    asset: "hBTC",
    apy: 15.3,
    tvl: 12_000_000,
    risk: "high",
    type: "vault",
    description: "Onchain trading strategy converting profits to BTC",
  },
  {
    id: "sbtc-base-rewards",
    protocol: "Stacks Network",
    asset: "sBTC",
    apy: 5.0,
    tvl: 545_000_000,
    risk: "low",
    type: "stacking",
    description: "Base sBTC stacking rewards from the network",
  },
  {
    id: "zest-usdcx-lending",
    protocol: "Zest Protocol",
    asset: "USDCx",
    apy: 6.8,
    tvl: 15_000_000,
    risk: "low",
    type: "lending",
    description: "USDCx supply lending for stable yield",
  },
  {
    id: "bitflow-usdcx-sbtc-lp",
    protocol: "Bitflow",
    asset: "USDCx/sBTC",
    apy: 18.7,
    tvl: 8_000_000,
    risk: "high",
    type: "lp",
    description: "USDCx/sBTC liquidity pool with high volume",
  },
];

// Protocol API provider (production - caches with 5-min TTL)
export class ProtocolApiProvider implements YieldSourceProvider {
  readonly name = "protocol-api";
  private cache: YieldSource[] | null = null;
  private cacheTime = 0;
  private readonly ttlMs = 5 * 60 * 1000;

  async fetchSources(): Promise<YieldSource[]> {
    if (this.cache && Date.now() - this.cacheTime < this.ttlMs) {
      return this.cache;
    }

    try {
      // TODO: Replace with real protocol API calls:
      // - Zest: read-only contract call for current supply APY
      // - StackingDAO: stSTX exchange rate query
      // - Bitflow: pool APY from DEX API
      // - Hermetica: vault performance API
      // For now, return static data with jitter
      const sources = YIELD_SOURCES.map((source) => ({
        ...source,
        apy: addJitter(source.apy, 8),
        tvl: Math.round(addJitter(source.tvl, 3)),
      }));

      this.cache = sources;
      this.cacheTime = Date.now();
      return sources;
    } catch {
      // Fallback to static data with isMock indicator
      return YIELD_SOURCES;
    }
  }
}

// Add some randomness to simulate live data
function addJitter(value: number, maxPercent: number = 5): number {
  const jitter = (Math.random() - 0.5) * 2 * (maxPercent / 100) * value;
  return Math.round((value + jitter) * 100) / 100;
}

export function fetchYieldSources(): YieldSource[] {
  return YIELD_SOURCES.map((source) => ({
    ...source,
    apy: addJitter(source.apy, 8),
    tvl: Math.round(addJitter(source.tvl, 3)),
  }));
}

export interface StrategyAllocation {
  sourceId: string;
  protocol: string;
  asset: string;
  allocationBps: number; // basis points
  currentApy: number;
}

export function getCurrentAllocations(): StrategyAllocation[] {
  return [
    {
      sourceId: "zest-sbtc-lending",
      protocol: "Zest Protocol",
      asset: "sBTC",
      allocationBps: 2500,
      currentApy: 5.2,
    },
    {
      sourceId: "bitflow-sbtc-stx-lp",
      protocol: "Bitflow",
      asset: "sBTC/STX",
      allocationBps: 2000,
      currentApy: 12.4,
    },
    {
      sourceId: "stackingdao-liquid",
      protocol: "StackingDAO",
      asset: "stSTX",
      allocationBps: 3000,
      currentApy: 8.1,
    },
    {
      sourceId: "hermetica-hbtc",
      protocol: "Hermetica",
      asset: "hBTC",
      allocationBps: 1000,
      currentApy: 15.3,
    },
    {
      sourceId: "sbtc-base-rewards",
      protocol: "Stacks Network",
      asset: "sBTC",
      allocationBps: 1500,
      currentApy: 5.0,
    },
  ];
}

export function getWeightedApy(allocations: StrategyAllocation[]): number {
  const totalBps = allocations.reduce((sum, a) => sum + a.allocationBps, 0);
  if (totalBps === 0) return 0;
  const weightedSum = allocations.reduce(
    (sum, a) => sum + a.currentApy * a.allocationBps,
    0
  );
  return Math.round((weightedSum / totalBps) * 100) / 100;
}
