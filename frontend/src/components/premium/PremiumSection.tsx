import { Sparkles, Zap } from "lucide-react";
import { cn } from "../../lib/utils";

const API_ENDPOINTS = [
  {
    endpoint: "GET /api/ai/yield-forecast",
    description: "GPT-4o-mini generated 7-day APY projections with per-protocol confidence scores",
    price: "0.001 STX",
  },
  {
    endpoint: "GET /api/ai/strategy-signals",
    description: "Risk-adjusted allocation weights for conservative, balanced, and aggressive profiles",
    price: "0.001 STX",
  },
  {
    endpoint: "GET /api/ai/portfolio-analytics",
    description: "30-day Sharpe ratio, max drawdown, volatility, and top-performing strategy breakdown",
    price: "0.001 STX",
  },
];

export function PremiumSection() {
  return (
    <div id="api" className="glass-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-base font-semibold text-white">AI Intelligence API</h2>
        <span className="badge badge-violet text-[10px]">
          <Zap className="w-3 h-3" />
          x402 Powered
        </span>
      </div>
      <p className="text-sm text-[#8b8fa3] mb-6">
        AI-powered yield intelligence with Bitcoin-native micropayments via{" "}
        <span className="text-violet-400 font-medium">x402 protocol</span>.
        Pay per query with STX, sBTC, or USDCx — no API keys, no subscriptions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {API_ENDPOINTS.map((api, i) => (
          <div
            key={api.endpoint}
            className={cn(
              "bg-white/[0.02] rounded-xl p-4 border border-white/[0.04] hover:border-violet-500/20 hover:bg-white/[0.04] transition-all duration-200 animate-fade-in-up group",
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <code className="text-[11px] text-violet-400/80 font-mono">{api.endpoint}</code>
            <p className="text-[13px] text-[#8b8fa3] mt-2 leading-relaxed">{api.description}</p>
            <div className="mt-3 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400/60" />
              <span className="text-[10px] text-amber-400/80 font-medium">{api.price} per query</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
        <p className="text-[11px] text-[#565a6e] uppercase tracking-wider font-medium mb-2">x402 Payment Flow</p>
        <div className="flex items-center gap-3 text-xs text-[#8b8fa3] flex-wrap">
          <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 font-mono">1. Request</span>
          <span className="text-[#3a3e52]">&rarr;</span>
          <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 font-mono">2. HTTP 402</span>
          <span className="text-[#3a3e52]">&rarr;</span>
          <span className="px-2 py-1 rounded-md bg-violet-500/10 text-violet-400 font-mono">3. Sign &amp; Pay</span>
          <span className="text-[#3a3e52]">&rarr;</span>
          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-mono">4. AI Response</span>
        </div>
      </div>
    </div>
  );
}
