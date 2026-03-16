import { useMemo } from "react";
import { TrendingUp, BarChart3, Activity, Lock } from "lucide-react";
import { ApyHistoryChart } from "../components/charts/ApyHistoryChart";
import { TvlChart } from "../components/charts/TvlChart";
import { StatCard } from "../components/common/StatCard";

function generateMockHistory(days: number, baseApy: number, baseTvl: number) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000)
      .toISOString()
      .split("T")[0];
    return {
      date,
      apy: Math.round((baseApy + (Math.random() - 0.5) * 3) * 100) / 100,
      tvl: Math.round(baseTvl + (Math.random() - 0.5) * 500_000),
    };
  });
}

export function AnalyticsPage() {
  const history = useMemo(() => generateMockHistory(30, 8.74, 2_450_000), []);
  const avgApy = Math.round((history.reduce((s, h) => s + h.apy, 0) / history.length) * 100) / 100;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-[#565a6e] mt-1">Performance overview and yield history</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="30-Day Avg APY"
          value={`${avgApy}%`}
          sub="Across all strategies"
          icon={<TrendingUp className="w-4 h-4" />}
          className="animate-fade-in-up"
          highlight
        />
        <StatCard
          label="Sharpe Ratio"
          value="2.4"
          sub="Risk-adjusted returns"
          icon={<BarChart3 className="w-4 h-4" />}
          className="animate-fade-in-up delay-100"
        />
        <StatCard
          label="Max Drawdown"
          value="-3.2%"
          sub="Worst single-day loss"
          icon={<Activity className="w-4 h-4" />}
          className="animate-fade-in-up delay-200"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-6 animate-fade-in-left delay-300">
          <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider mb-4">APY History (30 days)</h3>
          <ApyHistoryChart data={history} />
        </div>
        <div className="glass-card p-6 animate-fade-in-right delay-300">
          <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider mb-4">TVL History (30 days)</h3>
          <TvlChart data={history} />
        </div>
      </div>

      {/* Premium upsell */}
      <div className="glass-card p-8 text-center animate-fade-in-up delay-400">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center animate-float">
            <Lock className="w-5 h-5 text-violet-400" />
          </div>
        </div>
        <h2 className="text-base font-semibold text-white mb-2">Premium AI Analytics</h2>
        <p className="text-sm text-[#8b8fa3] max-w-md mx-auto mb-6">
          Unlock AI-generated 7-day forecasts, strategy signals, and deeper portfolio analytics via x402 micropayments.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
          {[
            { title: "7-Day Forecast", price: "0.1 STX", desc: "APY projections with confidence bands" },
            { title: "Strategy Signals", price: "0.15 STX", desc: "Optimal allocation recommendations" },
            { title: "Portfolio Analytics", price: "0.2 STX", desc: "Performance, Sharpe ratio, risk" },
          ].map((item, i) => (
            <div
              key={item.title}
              className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04] hover:border-violet-500/20 transition-all duration-200 animate-fade-in-up"
              style={{ animationDelay: `${500 + i * 80}ms` }}
            >
              <p className="text-[13px] font-medium text-white">{item.title}</p>
              <p className="text-[11px] text-[#565a6e] mt-1">{item.desc}</p>
              <p className="text-[13px] font-semibold text-blue-400 mt-2">{item.price}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
