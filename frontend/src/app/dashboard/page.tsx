"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("@/components/AppShell").then(m => ({ default: m.AppShell })), { ssr: false });
const Dashboard = dynamic(() => import("@/views/Dashboard").then(m => ({ default: m.Dashboard })), { ssr: false });

export default function DashboardPage() {
  return (
    <AppShell
      renderPage={(ctx) => (
        <Dashboard
          vaultStats={ctx.vaultStats}
          yields={ctx.yields}
          allocations={ctx.allocations}
          weightedApy={ctx.weightedApy}
          loading={ctx.loading}
          isConnected={ctx.isConnected}
          address={ctx.address}
          onConnect={ctx.onConnect}
        />
      )}
    />
  );
}
