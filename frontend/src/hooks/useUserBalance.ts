import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface UserBalance {
  deposits: { sBTC: number; USDCx: number };
  shares: number;
  sharePrice: number;  // PRECISION units (1000000 = 1.0)
  shareValue: number;  // shares * price in micro-tokens
}

interface UseUserBalanceResult {
  balance: UserBalance | null;
  loading: boolean;
  refetch: () => void;
}

export function useUserBalance(address: string | null): UseUserBalanceResult {
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }

    setLoading(true);
    try {
      const [depositsRes, sharesRes] = await Promise.all([
        api.get(`/user/${address}/deposits`),
        api.get(`/user/${address}/shares`),
      ]);

      const sharesData = sharesRes.data?.data;
      setBalance({
        deposits: depositsRes.data?.data?.deposits ?? { sBTC: 0, USDCx: 0 },
        shares: sharesData?.shares ?? 0,
        sharePrice: sharesData?.sharePrice ?? 1000000,
        shareValue: sharesData?.value ?? sharesData?.shares ?? 0,
      });
    } catch {
      // Keep previous balance on error
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
    if (!address) return;
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [fetchBalance, address]);

  return { balance, loading, refetch: fetchBalance };
}
