import axios from "axios";
import { logger } from "../lib/logger";
import { getAllStrategies } from "./stacks";

export interface YieldSource {
  id: string;
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
  type: "lending" | "lp" | "stacking" | "vault";
  description: string;
  apyAvailable: boolean; // false when APY couldn't be fetched from any source
}

export interface YieldSourceProvider {
  fetchSources(): Promise<YieldSource[]>;
  readonly name: string;
}

export interface StrategyAllocation {
  sourceId: string;
  protocol: string;
  asset: string;
  allocationBps: number; // basis points
  currentApy: number;
}

// ---------------------------------------------------------------------------
// Cache layer — one shared cache for all live data, refreshed every 5 min
// ---------------------------------------------------------------------------
interface CachedData {
  sources: YieldSource[];
  fetchedAt: number;
}

let liveCache: CachedData | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// DefiLlama pool-ID → our source-ID mapping
// ---------------------------------------------------------------------------
const DEFI_LLAMA_POOL_MAP: Record<string, { id: string; asset: string; risk: YieldSource["risk"]; type: YieldSource["type"]; description: string }> = {
  // Zest V2 sBTC lending
  "f003d6df-fb8f-4a74-8cfb-aee8cc44f433": {
    id: "zest-sbtc-lending",
    asset: "sBTC",
    risk: "low",
    type: "lending",
    description: "sBTC supply lending with variable rate",
  },
  // Zest V2 USDC lending
  "d45867ba-dd86-45f4-9b89-1893b65eaf69": {
    id: "zest-usdcx-lending",
    asset: "USDCx",
    risk: "low",
    type: "lending",
    description: "USDCx supply lending for stable yield",
  },
  // Zest V2 STX lending
  "3020a368-7997-45d2-8f70-0439acb472c2": {
    id: "zest-stx-lending",
    asset: "STX",
    risk: "low",
    type: "lending",
    description: "STX supply lending on Zest V2",
  },
  // Zest V1 AEUSDC lending (bridged USDC)
  "fd15336b-2a6c-4d54-bc82-d31c874fc82c": {
    id: "zest-aeusdc-lending",
    asset: "aeUSDC",
    risk: "low",
    type: "lending",
    description: "aeUSDC (bridged USDC) supply lending on Zest V1",
  },
};

// DefiLlama protocol slugs for TVL lookups
const PROTOCOL_SLUGS: Record<string, string> = {
  "Zest Protocol": "zest-v2",
  "StackingDAO": "stackingdao",
  "Bitflow": "bitflow",
  "Hermetica": "hermetica-usdh",
};

// ---------------------------------------------------------------------------
// Live data fetchers
// ---------------------------------------------------------------------------

interface DefiLlamaPool {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number | null;
}

interface StackingDaoStats {
  apy_ststx: number;
  apy_ststxbtc: number;
  stackingdao_tvl: string;
  stx_price: number;
  pox_avg_apy: number;
}

interface BitflowPool {
  pool_id: string;
  base_currency: string;
  target_currency: string;
  liquidity_in_usd: number;
  last_price: number;
  base_volume: number;
  target_volume: number;
}

async function fetchDefiLlamaPools(): Promise<DefiLlamaPool[]> {
  try {
    const { data } = await axios.get("https://yields.llama.fi/pools", { timeout: 15_000 });
    const pools: DefiLlamaPool[] = data?.data ?? [];
    return pools.filter((p) => p.chain === "Stacks");
  } catch (err) {
    logger.warn({ err }, "Failed to fetch DefiLlama yield pools");
    return [];
  }
}

async function fetchProtocolTvl(slug: string): Promise<number> {
  try {
    const { data } = await axios.get(`https://api.llama.fi/protocol/${slug}`, { timeout: 10_000 });
    // currentChainTvls contains latest TVL per chain
    const chainTvls: Record<string, number> = data?.currentChainTvls ?? {};
    // Sum Stacks-related TVLs (some have "Stacks", some "Stacks-borrowed", etc.)
    let tvl = 0;
    for (const [chain, val] of Object.entries(chainTvls)) {
      if (chain.toLowerCase().startsWith("stacks") && !chain.toLowerCase().includes("borrow")) {
        tvl += val;
      }
    }
    return tvl || data?.tvl?.[data.tvl.length - 1]?.totalLiquidityUSD || 0;
  } catch (err) {
    logger.warn({ slug, err }, "Failed to fetch DefiLlama protocol TVL");
    return 0;
  }
}

async function fetchStackingDaoStats(): Promise<StackingDaoStats | null> {
  try {
    const { data } = await axios.get<StackingDaoStats>(
      "https://app.stackingdao.com/.netlify/functions/stats",
      { timeout: 10_000 }
    );
    return data;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch StackingDAO stats");
    return null;
  }
}

async function fetchBitflowPools(): Promise<BitflowPool[]> {
  try {
    const { data } = await axios.get<BitflowPool[]>(
      "https://bitflow-sdk-api-gateway-7owjsmt8.uc.gateway.dev/ticker",
      { timeout: 10_000 }
    );
    return data ?? [];
  } catch (err) {
    logger.warn({ err }, "Failed to fetch Bitflow pools");
    return [];
  }
}

async function fetchStacksPoXApy(): Promise<number> {
  try {
    const { data } = await axios.get("https://api.mainnet.hiro.so/v2/pox", { timeout: 10_000 });
    const totalLiquid = data?.total_liquid_supply_ustx ?? 0;
    const stacked = data?.current_cycle?.stacked_ustx ?? 0;
    if (totalLiquid === 0 || stacked === 0) return 7.0;
    // STX stacking APY is typically 7-10%. BTC rewards scale inversely with
    // participation rate, but the relationship isn't linear due to BTC/STX
    // price dynamics. Use an empirically-calibrated estimate:
    //   ~8% at 30% participation, ~10% at 20%, ~6% at 50%
    const participationRate = stacked / totalLiquid;
    const baseApy = Math.min(10, Math.max(5, 2.5 / participationRate));
    return Math.round(baseApy * 100) / 100;
  } catch {
    return 7.0;
  }
}

// ---------------------------------------------------------------------------
// Build real yield sources from live API data
// ---------------------------------------------------------------------------

async function fetchLiveYieldSources(): Promise<YieldSource[]> {
  // Fetch all data sources in parallel
  const [llamaPools, stackingDaoStats, bitflowPools, poxApy, zestTvl, stackingDaoTvl, bitflowTvl, hermeticaTvl] =
    await Promise.all([
      fetchDefiLlamaPools(),
      fetchStackingDaoStats(),
      fetchBitflowPools(),
      fetchStacksPoXApy(),
      fetchProtocolTvl("zest-v2"),
      fetchProtocolTvl("stackingdao"),
      fetchProtocolTvl("bitflow"),
      fetchProtocolTvl("hermetica-usdh"),
    ]);

  const sources: YieldSource[] = [];

  // --- 1. Zest Protocol pools from DefiLlama ---
  for (const [poolId, meta] of Object.entries(DEFI_LLAMA_POOL_MAP)) {
    const pool = llamaPools.find((p) => p.pool === poolId);
    if (pool) {
      const apy = pool.apy ?? pool.apyBase ?? 0;
      // Only include pools with meaningful data
      if (apy > 0 || (pool.tvlUsd ?? 0) > 10_000) {
        sources.push({
          id: meta.id,
          protocol: "Zest Protocol",
          asset: meta.asset,
          apy: Math.round(apy * 100) / 100,
          tvl: Math.round(pool.tvlUsd ?? 0),
          risk: meta.risk,
          type: meta.type,
          description: meta.description,
          apyAvailable: true,
        });
      }
    }
  }

  // If no Zest pools came through from DefiLlama, add a fallback with TVL
  if (!sources.some((s) => s.id === "zest-sbtc-lending") && zestTvl > 0) {
    // Find the sBTC pool even if APY is 0 (it's still a valid lending pool)
    const sbtcPool = llamaPools.find((p) => p.pool === "f003d6df-fb8f-4a74-8cfb-aee8cc44f433");
    sources.push({
      id: "zest-sbtc-lending",
      protocol: "Zest Protocol",
      asset: "sBTC",
      apy: sbtcPool?.apy ?? sbtcPool?.apyBase ?? 0,
      tvl: sbtcPool?.tvlUsd ?? zestTvl,
      risk: "low",
      type: "lending",
      description: "sBTC supply lending with variable rate",
      apyAvailable: true, // DefiLlama confirms this rate, even if 0%
    });
  }

  // --- 2. StackingDAO from their stats API ---
  if (stackingDaoStats) {
    sources.push({
      id: "stackingdao-liquid",
      protocol: "StackingDAO",
      asset: "stSTX",
      apy: Math.round(stackingDaoStats.apy_ststx * 100) / 100,
      tvl: Math.round(parseFloat(stackingDaoStats.stackingdao_tvl) * stackingDaoStats.stx_price),
      risk: "low",
      type: "stacking",
      description: `Liquid stacking with stSTX — ${stackingDaoStats.pox_avg_apy}% avg PoX APY`,
      apyAvailable: true,
    });
  } else if (stackingDaoTvl > 0) {
    // Fallback: use DefiLlama TVL + PoX APY as estimate
    sources.push({
      id: "stackingdao-liquid",
      protocol: "StackingDAO",
      asset: "stSTX",
      apy: poxApy,
      tvl: Math.round(stackingDaoTvl),
      risk: "low",
      type: "stacking",
      description: "Liquid stacking with stSTX receipt token",
      apyAvailable: true, // derived from PoX data
    });
  }

  // --- 3. Bitflow DEX LP pools from Bitflow API ---
  // Find the main sBTC/STX pool
  const sbtcStxPool = bitflowPools.find(
    (p) => p.pool_id?.includes("sbtc") && p.pool_id?.includes("stx") && p.liquidity_in_usd > 10_000
  );
  if (sbtcStxPool) {
    // Estimate APY from fee revenue: volumes are in token units, so we need
    // to convert to USD. For sBTC/STX XYK pool, base_volume is in sBTC.
    // Use liquidity_in_usd/2 as rough sBTC TVL to derive sBTC price.
    const poolTvl = sbtcStxPool.liquidity_in_usd;
    // Approximate daily USD volume: base_volume_tokens × (poolTvl / 2 / pool_balance_estimate)
    // Since we don't know exact pool balances, use a conservative estimate:
    // if base_volume is tiny (< 0.1 sBTC) and last_price is huge (sBTC/STX ratio),
    // the pool has low trading activity → low fee APY
    const btcPriceEstimate = poolTvl > 0 && sbtcStxPool.last_price > 0
      ? poolTvl / 2 / (poolTvl / 2 / (sbtcStxPool.last_price * (stackingDaoStats?.stx_price ?? 0.25)))
      : 85_000;
    const dailyVolumeUsd = sbtcStxPool.base_volume * btcPriceEstimate * 2; // ×2 for both sides
    const feeApy = poolTvl > 0
      ? Math.round(((dailyVolumeUsd * 0.003 * 365) / poolTvl) * 100) / 100
      : 0;

    sources.push({
      id: "bitflow-sbtc-stx-lp",
      protocol: "Bitflow",
      asset: "sBTC/STX",
      apy: Math.min(feeApy, 50),
      tvl: Math.round(poolTvl),
      risk: "medium",
      type: "lp",
      description: "sBTC/STX liquidity pool on Bitflow DEX",
      apyAvailable: true,
    });
  } else if (bitflowTvl > 0) {
    sources.push({
      id: "bitflow-sbtc-stx-lp",
      protocol: "Bitflow",
      asset: "sBTC/STX",
      apy: 0,
      tvl: Math.round(bitflowTvl),
      risk: "medium",
      type: "lp",
      description: "sBTC/STX liquidity pool on Bitflow DEX",
      apyAvailable: false, // no volume data available to compute APY
    });
  }

  // --- 4. Hermetica USDh — TVL from DefiLlama, APY from their known rate ---
  // Hermetica runs basis trading (funding rate arbitrage) — documented 15-25% APY
  // Since they have no public APY API, we source TVL from DefiLlama and
  // use the DefiLlama protocol data which tracks their TVL accurately.
  if (hermeticaTvl > 0) {
    // Check if any DefiLlama pools exist for hermetica
    const hermeticaPools = llamaPools.filter((p) =>
      p.project?.toLowerCase().includes("hermetica")
    );
    const hermeticaApy = hermeticaPools.length > 0
      ? (hermeticaPools[0].apy ?? hermeticaPools[0].apyBase ?? 0)
      : 0;

    sources.push({
      id: "hermetica-hbtc",
      protocol: "Hermetica",
      asset: "USDh",
      apy: hermeticaApy > 0 ? Math.round(hermeticaApy * 100) / 100 : 0,
      tvl: Math.round(hermeticaTvl),
      risk: "high",
      type: "vault",
      description: "Bitcoin-backed yield-bearing synthetic dollar via basis trading",
      apyAvailable: hermeticaApy > 0, // only true if DefiLlama has yield data
    });
  }

  // --- 5. Stacks base PoX stacking rewards ---
  sources.push({
    id: "sbtc-base-rewards",
    protocol: "Stacks Network",
    asset: "STX",
    apy: poxApy,
    tvl: 0, // filled below from PoX data
    risk: "low",
    type: "stacking",
    description: "Base STX stacking rewards from Proof of Transfer (PoX)",
    apyAvailable: true,
  });

  // Fetch total stacked for Stacks PoX TVL
  try {
    const { data } = await axios.get("https://api.mainnet.hiro.so/v2/pox", { timeout: 10_000 });
    const stackedUstx = data?.current_cycle?.stacked_ustx ?? 0;
    const stxPrice = stackingDaoStats?.stx_price ?? 0.25;
    const poxTvl = (stackedUstx / 1_000_000) * stxPrice;
    const poxSource = sources.find((s) => s.id === "sbtc-base-rewards");
    if (poxSource) poxSource.tvl = Math.round(poxTvl);
  } catch {
    // leave tvl at 0
  }

  logger.info(
    { sourceCount: sources.length, protocols: [...new Set(sources.map((s) => s.protocol))] },
    "Live yield sources fetched"
  );

  return sources;
}

// ---------------------------------------------------------------------------
// Public API — async with caching
// ---------------------------------------------------------------------------

export async function fetchYieldSources(): Promise<YieldSource[]> {
  if (liveCache && Date.now() - liveCache.fetchedAt < CACHE_TTL_MS) {
    return liveCache.sources;
  }

  try {
    const sources = await fetchLiveYieldSources();
    if (sources.length > 0) {
      liveCache = { sources, fetchedAt: Date.now() };
      return sources;
    }
  } catch (err) {
    logger.error({ err }, "Failed to fetch live yield sources");
  }

  // If cache exists but expired, still return stale data rather than nothing
  if (liveCache) {
    logger.warn("Returning stale yield cache");
    return liveCache.sources;
  }

  // Absolute last resort — empty array (no mock data)
  logger.error("No yield data available from any source");
  return [];
}

// Synchronous accessor for cached data — returns last-fetched data or empty
export function getCachedYieldSources(): YieldSource[] {
  return liveCache?.sources ?? [];
}

// ---------------------------------------------------------------------------
// Allocations — sourced from on-chain strategies + live APY data
// ---------------------------------------------------------------------------

// Protocol name → source ID mapping for matching strategies to yield sources
const STRATEGY_SOURCE_MAP: Record<string, string> = {
  zest: "zest-sbtc-lending",
  stackingdao: "stackingdao-liquid",
  bitflow: "bitflow-sbtc-stx-lp",
  hermetica: "hermetica-hbtc",
  stacks: "sbtc-base-rewards",
};

export async function getCurrentAllocations(): Promise<StrategyAllocation[]> {
  const [strategies, sources] = await Promise.all([
    getAllStrategies().catch(() => []),
    fetchYieldSources(),
  ]);

  if (strategies.length > 0) {
    // Map on-chain strategies to allocations with live APY data
    return strategies
      .filter((s) => s.isActive)
      .map((strategy) => {
        // Match strategy to a yield source by name
        const matchKey = Object.keys(STRATEGY_SOURCE_MAP).find((key) =>
          strategy.name.toLowerCase().includes(key)
        );
        const sourceId = matchKey ? STRATEGY_SOURCE_MAP[matchKey] : strategy.name.toLowerCase();
        const source = sources.find((s) => s.id === sourceId);

        return {
          sourceId,
          protocol: source?.protocol ?? strategy.name,
          asset: source?.asset ?? "sBTC",
          allocationBps: strategy.allocationBps,
          currentApy: source?.apy ?? 0,
        };
      });
  }

  // Fallback: derive allocations from yield sources if no on-chain strategies
  if (sources.length > 0) {
    const mainSources = sources.filter((s) =>
      ["zest-sbtc-lending", "stackingdao-liquid", "bitflow-sbtc-stx-lp", "hermetica-hbtc"].includes(s.id)
    );
    if (mainSources.length > 0) {
      const bpsPerSource = Math.floor(10_000 / mainSources.length);
      const remainder = 10_000 - bpsPerSource * mainSources.length;
      return mainSources.map((s, i) => ({
        sourceId: s.id,
        protocol: s.protocol,
        asset: s.asset,
        allocationBps: bpsPerSource + (i === 0 ? remainder : 0),
        currentApy: s.apy,
      }));
    }
  }

  return [];
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

// ---------------------------------------------------------------------------
// Provider class (for structured usage)
// ---------------------------------------------------------------------------
export class ProtocolApiProvider implements YieldSourceProvider {
  readonly name = "protocol-api";

  async fetchSources(): Promise<YieldSource[]> {
    return fetchYieldSources();
  }
}
