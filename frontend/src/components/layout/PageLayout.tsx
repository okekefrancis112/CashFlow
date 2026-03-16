import type { ReactNode } from "react";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#06060b] text-[#f0f0f8] noise-overlay">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Skip to content
      </a>

      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {/* Primary mesh gradient */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/[0.04] rounded-full blur-[150px]" />
        <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] bg-indigo-500/[0.03] rounded-full blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] bg-violet-500/[0.025] rounded-full blur-[120px]" />
        {/* Dot grid */}
        <div className="absolute inset-0 dot-grid opacity-40" />
      </div>

      <main id="main-content" className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}
