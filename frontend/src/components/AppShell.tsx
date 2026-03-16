"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageLayout } from "@/components/layout/PageLayout";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useVaultData } from "@/hooks/useVaultData";
import { useWallet } from "@/hooks/useWallet";
import type { VaultStats, YieldSource, StrategyAllocation } from "@/types";

export interface AppContext {
  vaultStats: VaultStats | null;
  yields: YieldSource[];
  allocations: StrategyAllocation[];
  weightedApy: number;
  loading: boolean;
  isConnected: boolean;
  address: string | null;
  onConnect: () => void;
}

export function AppShell({
  children,
  renderPage,
}: {
  children?: React.ReactNode;
  renderPage?: (ctx: AppContext) => React.ReactNode;
}) {
  const { vaultStats, yields, allocations, weightedApy, loading } =
    useVaultData();
  const { address, isConnected, connect, disconnect } = useWallet();
  const pathname = usePathname();

  const isLanding = pathname === "/";

  if (loading && !isLanding && !renderPage) return <LoadingSpinner />;

  const ctx: AppContext = {
    vaultStats,
    yields,
    allocations,
    weightedApy,
    loading,
    isConnected,
    address,
    onConnect: connect,
  };

  return (
    <PageLayout>
      <Navbar
        walletAddress={address}
        isConnected={isConnected}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      {renderPage ? renderPage(ctx) : children}
      <Footer />
    </PageLayout>
  );
}
