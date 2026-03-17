import { useMemo } from "react";
import { TrendingUp, BarChart3, Activity } from "lucide-react";
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

    </div>
  );
}
