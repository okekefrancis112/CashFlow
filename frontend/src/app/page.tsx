"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("@/components/AppShell").then(m => ({ default: m.AppShell })), { ssr: false });
const Landing = dynamic(() => import("@/views/Landing").then(m => ({ default: m.Landing })), { ssr: false });

export default function HomePage() {
  return (
    <AppShell
      renderPage={(ctx) => (
        <Landing
          onConnect={ctx.onConnect}
          isConnected={ctx.isConnected}
          weightedApy={ctx.weightedApy}
        />
      )}
    />
  );
}
