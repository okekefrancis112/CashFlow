import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { MOCK_VAULT_STATS, MOCK_YIELDS, MOCK_ALLOCATIONS } from "../lib/mock-data";
import type { VaultStats, YieldSource, StrategyAllocation } from "../types";

interface VaultData {
  vaultStats: VaultStats | null;
  yields: YieldSource[];
  allocations: StrategyAllocation[];
  weightedApy: number;
  loading: boolean;
  error: string | null;
  isMockData: boolean;
  refetch: () => void;
}

export function useVaultData(pollInterval = 30000): VaultData {
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [yields, setYields] = useState<YieldSource[]>([]);
  const [allocations, setAllocations] = useState<StrategyAllocation[]>([]);
  const [weightedApy, setWeightedApy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [yieldRes, statsRes, strategyRes] = await Promise.all([
        api.get("/yields"),
        api.get("/vault/stats"),
        api.get("/strategy/current"),
      ]);
      // Backend wraps responses in { success, data: { ... }, timestamp }
      const yieldData = yieldRes.data?.data ?? yieldRes.data;
      const statsData = statsRes.data?.data ?? statsRes.data;
      const strategyData = strategyRes.data?.data ?? strategyRes.data;

      setYields(yieldData.sources ?? []);
      setVaultStats(statsData);
      setAllocations(strategyData.allocations ?? []);
      setWeightedApy(strategyData.weightedApy ?? 0);
      setIsMockData(!!statsData.isMock);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch vault data";
      setError(message);
      setIsMockData(true);
      // Fallback to mock data so UI isn't empty
      setVaultStats(MOCK_VAULT_STATS);
      setYields(MOCK_YIELDS);
      setAllocations(MOCK_ALLOCATIONS);
      setWeightedApy(8.74);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  return { vaultStats, yields, allocations, weightedApy, loading, error, isMockData, refetch: fetchData };
}
