"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("@/components/AppShell").then(m => ({ default: m.AppShell })), { ssr: false });
const PremiumPage = dynamic(() => import("@/views/Premium").then(m => ({ default: m.PremiumPage })), { ssr: false });

export default function AIRoute() {
  return (
    <AppShell
      renderPage={() => <PremiumPage />}
    />
  );
}
