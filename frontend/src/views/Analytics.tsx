import { useState, useEffect, useCallback } from "react";
import { TrendingUp, BarChart3, Activity } from "lucide-react";
import { ApyHistoryChart } from "../components/charts/ApyHistoryChart";
import { TvlChart } from "../components/charts/TvlChart";
import { StatCard } from "../components/common/StatCard";
import { CardSkeleton } from "../components/common/LoadingSkeleton";
import { api } from "../lib/api";

interface AnalyticsData {
  currentApy: number;
  thirtyDayAvgApy: number;
  totalRebalances: number;
  daysTracked?: number;
  history: { date: string; apy: number; tvl: number }[];
  topPerformingStrategy: { protocol: string; asset: string; apy: number };
  riskMetrics: { sharpeRatio: number; maxDrawdown: number; volatility: number };
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get("/ai/portfolio-analytics");
      const payload = res.data?.data ?? res.data;
      setData(payload);
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-bold"><span className="hero-gradient-warm text-glow-warm">Analytics</span></h1>
          <p className="text-sm text-[#565a6e] mt-1">Vault performance, risk metrics, and yield history across all strategies</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const days = data.daysTracked ?? data.history.filter((h) => h.apy > 0).length;
  const hasRiskData = days >= 2 && data.riskMetrics.volatility > 0;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold"><span className="hero-gradient-warm text-glow-warm">Analytics</span></h1>
        <p className="text-sm text-[#565a6e] mt-1">Vault performance, risk metrics, and yield history across all strategies</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={days >= 30 ? "30-Day Avg APY" : `${days}-Day Avg APY`}
          value={days > 0 ? `${data.thirtyDayAvgApy}%` : `${data.currentApy}%`}
          sub={days > 0 ? `Based on ${days} day${days > 1 ? "s" : ""} of data` : "Live current rate"}
          icon={<TrendingUp className="w-4 h-4" />}
          className="animate-fade-in-up"
          highlight
        />
        <StatCard
          label="Sharpe Ratio"
          value={hasRiskData ? `${data.riskMetrics.sharpeRatio}` : "—"}
          sub={hasRiskData ? "Risk-adjusted returns" : "Needs 2+ days of data"}
          icon={<BarChart3 className="w-4 h-4" />}
          className="animate-fade-in-up delay-100"
        />
        <StatCard
          label="Max Drawdown"
          value={hasRiskData ? `${data.riskMetrics.maxDrawdown}%` : "—"}
          sub={hasRiskData ? "Worst peak-to-trough decline" : "Needs 2+ days of data"}
          icon={<Activity className="w-4 h-4" />}
          className="animate-fade-in-up delay-200"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-6 animate-fade-in-left delay-300">
          <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider mb-4">APY History (30 days)</h3>
          <ApyHistoryChart data={data.history} />
        </div>
        <div className="glass-card p-6 animate-fade-in-right delay-300">
          <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider mb-4">TVL History (30 days)</h3>
          <TvlChart data={data.history} />
        </div>
      </div>

    </div>
  );
}
