"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("@/components/AppShell").then(m => ({ default: m.AppShell })), { ssr: false });
const YieldsPage = dynamic(() => import("@/views/Yields").then(m => ({ default: m.YieldsPage })), { ssr: false });

export default function YieldsRoute() {
  return (
    <AppShell
      renderPage={(ctx) => (
        <YieldsPage yields={ctx.yields} loading={ctx.loading} />
      )}
    />
  );
}
