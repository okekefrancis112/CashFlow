import { Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

const API_ENDPOINTS = [
  {
    endpoint: "GET /api/premium/yield-forecast",
    description: "AI-generated 7-day yield projections with confidence scores",
  },
  {
    endpoint: "GET /api/premium/strategy-signals",
    description: "Real-time optimal allocation weights with AI reasoning",
  },
  {
    endpoint: "GET /api/premium/portfolio-analytics",
    description: "30-day historical performance, Sharpe ratio, risk metrics",
  },
];

export function PremiumSection() {
  return (
    <div id="api" className="glass-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-base font-semibold text-white">AI Intelligence API</h2>
        <span className="badge badge-violet text-[10px]">
          <Sparkles className="w-3 h-3" />
          Open Access
        </span>
      </div>
      <p className="text-sm text-[#8b8fa3] mb-6">
        Access AI-powered yield intelligence endpoints. No API keys needed.
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
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
        <p className="text-[11px] text-[#565a6e] uppercase tracking-wider font-medium mb-2">Example request</p>
        <code className="text-xs text-[#8b8fa3] font-mono block whitespace-pre leading-relaxed">
{`curl -X GET http://localhost:4000/api/premium/yield-forecast
# Returns AI-generated yield forecast data`}
        </code>
      </div>
    </div>
  );
}
