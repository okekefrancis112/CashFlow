import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface AdapterBalance {
  name: string;
  contractName: string;
  balance: number;
  targetBps: number;
  currentPct: string;
  targetPct: string;
}

interface HarvestLog {
  timestamp: string;
  adapter: string;
  yieldAmount: number;
  txId?: string;
}

interface RebalanceLog {
  timestamp: string;
  adapter: string;
  direction: string;
  amount: number;
  txId?: string;
}

export interface InvestmentData {
  adapters: AdapterBalance[];
  totalAssets: number;
  recentHarvests: HarvestLog[];
  recentRebalances: RebalanceLog[];
  loading: boolean;
  harvesting: boolean;
  rebalancing: boolean;
  triggerHarvest: () => Promise<void>;
  triggerRebalance: () => Promise<void>;
  refetch: () => void;
}

export function useInvestmentData(pollInterval = 30000): InvestmentData {
  const [adapters, setAdapters] = useState<AdapterBalance[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [recentHarvests, setRecentHarvests] = useState<HarvestLog[]>([]);
  const [recentRebalances, setRecentRebalances] = useState<RebalanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [harvesting, setHarvesting] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [balancesRes, harvestRes, rebalanceRes] = await Promise.all([
        api.get("/automation/rebalancer/status"),
        api.get("/automation/harvester/history?limit=10"),
        api.get("/automation/rebalancer/history?limit=10"),
      ]);

      const balData = balancesRes.data?.data ?? balancesRes.data;
      const harvData = harvestRes.data?.data ?? harvestRes.data;
      const rebData = rebalanceRes.data?.data ?? rebalanceRes.data;

      setAdapters(balData.balances ?? []);
      setTotalAssets(balData.totalAssets ?? 0);
      setRecentHarvests(harvData.harvests ?? []);
      setRecentRebalances(rebData.rebalances ?? []);
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  const triggerHarvest = useCallback(async () => {
    setHarvesting(true);
    try {
      await api.post("/automation/harvester/run");
      await fetchData();
    } finally {
      setHarvesting(false);
    }
  }, [fetchData]);

  const triggerRebalance = useCallback(async () => {
    setRebalancing(true);
    try {
      await api.post("/automation/rebalancer/run");
      await fetchData();
    } finally {
      setRebalancing(false);
    }
  }, [fetchData]);

  return {
    adapters,
    totalAssets,
    recentHarvests,
    recentRebalances,
    loading,
    harvesting,
    rebalancing,
    triggerHarvest,
    triggerRebalance,
    refetch: fetchData,
  };
}
