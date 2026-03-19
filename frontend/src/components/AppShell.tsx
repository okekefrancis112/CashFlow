"use client";

import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
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
      {isLanding ? (
        renderPage ? renderPage(ctx) : children
      ) : !isConnected ? (
        <div className="max-w-7xl mx-auto px-6 py-8 flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-fade-in-up">
          <div className="glass-card p-10 text-center max-w-md space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
              <Wallet className="w-8 h-8 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Connect Your Wallet</h2>
            <p className="text-sm text-[#8b8fa3] leading-relaxed">
              Connect your Leather or Xverse wallet to deposit sBTC/USDCx, view vault performance, and manage your AI-optimized yield strategies.
            </p>
            <button onClick={connect} className="btn-primary inline-flex items-center gap-2 mx-auto">
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {renderPage ? renderPage(ctx) : children}
        </div>
      )}
      <Footer />
    </PageLayout>
  );
}
