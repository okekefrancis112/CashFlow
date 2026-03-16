"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("@/components/AppShell").then(m => ({ default: m.AppShell })), { ssr: false });
const AnalyticsPage = dynamic(() => import("@/views/Analytics").then(m => ({ default: m.AnalyticsPage })), { ssr: false });

export default function AnalyticsRoute() {
  return (
    <AppShell renderPage={() => <AnalyticsPage />} />
  );
}
