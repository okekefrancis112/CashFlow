"use client";

import { useState, useMemo } from "react";
import {
  Sparkles,
  Zap,
  TrendingUp,
  BarChart3,
  Shield,
  Play,
  CheckCircle,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Activity,
  Target,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { AnimatedBorderCard } from "@/components/common/AnimatedBorderCard";

type EndpointId = "yield-forecast" | "strategy-signals" | "portfolio-analytics";
type RiskProfile = "conservative" | "balanced" | "aggressive";

interface EndpointConfig {
  id: EndpointId;
  method: string;
  path: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  queryParams?: string;
}

const ENDPOINTS: EndpointConfig[] = [
  {
    id: "yield-forecast",
    method: "GET",
    path: "/api/ai/yield-forecast",
    title: "AI Yield Forecast",
    description:
      "7-day forward-looking APY projections for all 7 yield sources. Each forecast includes a confidence score reflecting market predictability.",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "blue",
    features: [
      "7-day forward-looking APY projections",
      "Per-protocol confidence scores",
      "Market trend analysis",
      "Actionable allocation insights",
    ],
  },
  {
    id: "strategy-signals",
    method: "GET",
    path: "/api/ai/strategy-signals",
    title: "Strategy Signals",
    description:
      "Optimal allocation weights with AI reasoning for each protocol. Choose conservative, balanced, or aggressive risk profiles.",
    icon: <BarChart3 className="w-5 h-5" />,
    color: "violet",
    features: [
      "Optimal allocation recommendations",
      "Risk-adjusted weighting",
      "AI reasoning explanation",
      "3 risk profiles supported",
    ],
    queryParams: "?risk=balanced",
  },
  {
    id: "portfolio-analytics",
    method: "GET",
    path: "/api/ai/portfolio-analytics",
    title: "Portfolio Analytics",
    description:
      "30-day performance history with Sharpe ratio, max drawdown, volatility tracking, and identification of top-performing strategies.",
    icon: <Shield className="w-5 h-5" />,
    color: "emerald",
    features: [
      "30-day performance history",
      "Sharpe ratio & volatility metrics",
      "Max drawdown tracking",
      "Top-performing strategy identification",
    ],
  },
];

// ── Data for visualizations ──

const FORECAST_DATA = {
  protocols: [
    { protocol: "Zest (sBTC)", currentApy: 5.2, predictedApy: 5.6, confidence: 0.91 },
    { protocol: "Bitflow (sBTC/STX)", currentApy: 12.4, predictedApy: 13.1, confidence: 0.78 },
    { protocol: "StackingDAO", currentApy: 8.1, predictedApy: 8.5, confidence: 0.92 },
    { protocol: "Hermetica", currentApy: 15.3, predictedApy: 14.1, confidence: 0.73 },
    { protocol: "Stacks Network", currentApy: 5.0, predictedApy: 5.0, confidence: 0.96 },
    { protocol: "Zest (USDCx)", currentApy: 6.8, predictedApy: 7.2, confidence: 0.89 },
    { protocol: "Bitflow (USDCx/sBTC)", currentApy: 18.7, predictedApy: 17.4, confidence: 0.68 },
  ],
};

const STRATEGY_DATA = {
  balanced: [
    { protocol: "Zest (sBTC)", weight: 20, reasoning: "Steady lending yield with near-zero IL risk", color: "#2563eb" },
    { protocol: "Bitflow (sBTC/STX)", weight: 15, reasoning: "Strong trading volume driving LP fees", color: "#0ea5e9" },
    { protocol: "StackingDAO", weight: 20, reasoning: "Consensus-backed stacking with stSTX liquidity", color: "#10b981" },
    { protocol: "Hermetica", weight: 10, reasoning: "Options-based BTC yield in low-volatility regime", color: "#8b5cf6" },
    { protocol: "Stacks Network", weight: 15, reasoning: "Base PoX stacking rewards — protocol-level security", color: "#60a5fa" },
    { protocol: "Zest (USDCx)", weight: 10, reasoning: "Stablecoin lending diversifies BTC-correlated risk", color: "#f59e0b" },
    { protocol: "Bitflow (USDCx/sBTC)", weight: 10, reasoning: "High-volume pair but elevated impermanent loss", color: "#ef4444" },
  ],
  conservative: [
    { protocol: "Zest (sBTC)", weight: 20, reasoning: "Low-risk supply-side lending with no IL exposure", color: "#2563eb" },
    { protocol: "Bitflow (sBTC/STX)", weight: 5, reasoning: "Minimal LP allocation — IL risk kept low", color: "#0ea5e9" },
    { protocol: "StackingDAO", weight: 30, reasoning: "Highest allocation to stable consensus-backed yield", color: "#10b981" },
    { protocol: "Hermetica", weight: 5, reasoning: "Minimal options exposure to limit tail risk", color: "#8b5cf6" },
    { protocol: "Stacks Network", weight: 20, reasoning: "Protocol-level sBTC stacking — safest yield source", color: "#60a5fa" },
    { protocol: "Zest (USDCx)", weight: 15, reasoning: "Stable returns from USDCx borrowing demand", color: "#f59e0b" },
    { protocol: "Bitflow (USDCx/sBTC)", weight: 5, reasoning: "Token exposure capped due to cross-asset IL", color: "#ef4444" },
  ],
  aggressive: [
    { protocol: "Zest (sBTC)", weight: 10, reasoning: "Small lending base for capital preservation", color: "#2563eb" },
    { protocol: "Bitflow (sBTC/STX)", weight: 20, reasoning: "High LP returns justify impermanent loss risk", color: "#0ea5e9" },
    { protocol: "StackingDAO", weight: 5, reasoning: "Minimal stable allocation — yield ceiling too low", color: "#10b981" },
    { protocol: "Hermetica", weight: 25, reasoning: "Maximum options-based yield in current BTC regime", color: "#8b5cf6" },
    { protocol: "Stacks Network", weight: 5, reasoning: "De minimis — capital deployed to higher yield pools", color: "#60a5fa" },
    { protocol: "Zest (USDCx)", weight: 10, reasoning: "Stablecoin hedge against BTC drawdown scenarios", color: "#f59e0b" },
    { protocol: "Bitflow (USDCx/sBTC)", weight: 25, reasoning: "Highest volume pair — elevated risk, peak returns", color: "#ef4444" },
  ],
};

function generateHistory() {
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0];
    return {
      date,
      apy: Math.round((8.5 + Math.sin(i / 4) * 1.5 + (Math.random() - 0.5) * 1) * 100) / 100,
      tvl: Math.round(2_200_000 + Math.sin(i / 5) * 300_000 + Math.random() * 100_000),
    };
  });
}

// ── Chart: Forecast comparison bar chart ──

function ForecastChart() {
  const data = FORECAST_DATA.protocols.map((p) => ({
    name: p.protocol,
    current: p.currentApy,
    predicted: p.predictedApy,
    confidence: Math.round(p.confidence * 100),
  }));

  return (
    <div className="glass-card p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider">
          APY: Current vs 7-Day Prediction
        </h3>
        <span className="text-[10px] text-[#3a3e52]">Powered by GPT-4o-mini</span>
      </div>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#8b8fa3", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.04)" }}
            />
            <YAxis
              tick={{ fill: "#565a6e", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
              wrapperStyle={{ background: "none", border: "none", boxShadow: "none", padding: 0 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-[#0a0a14]/80 backdrop-blur-xl border border-blue-500/30 rounded-lg px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium text-white mb-1">{label}</p>
                    <p className="text-[#8b8fa3]">Current: <span className="text-blue-400">{Number(payload[0]?.value).toFixed(1)}%</span></p>
                    <p className="text-[#8b8fa3]">Predicted: <span className="text-emerald-400">{Number(payload[1]?.value).toFixed(1)}%</span></p>
                  </div>
                );
              }}
            />
            <Bar dataKey="current" fill="#2563eb" radius={[4, 4, 0, 0]} opacity={0.7} name="Current APY" />
            <Bar dataKey="predicted" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} name="Predicted APY" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Confidence badges */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.04]">
        {FORECAST_DATA.protocols.map((p) => (
          <div key={p.protocol} className="flex items-center gap-1.5 bg-white/[0.02] rounded-lg px-2.5 py-1.5 border border-white/[0.04]">
            <span className="text-[11px] text-[#8b8fa3]">{p.protocol}</span>
            <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={cn("h-full rounded-full", p.confidence > 0.85 ? "bg-emerald-400" : p.confidence > 0.75 ? "bg-amber-400" : "bg-red-400")}
                style={{ width: `${p.confidence * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-[#565a6e]">{Math.round(p.confidence * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chart: Strategy allocation pie + details ──

function StrategyChart() {
  const [risk, setRisk] = useState<RiskProfile>("balanced");
  const allocations = STRATEGY_DATA[risk];
  const expectedApy: Record<RiskProfile, number> = { conservative: 6.2, balanced: 8.74, aggressive: 13.6 };

  return (
    <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider">
          Optimal Allocation by Risk Profile
        </h3>
      </div>

      {/* Risk selector */}
      <div className="flex gap-2 mb-5">
        {(["conservative", "balanced", "aggressive"] as RiskProfile[]).map((r) => (
          <button
            key={r}
            onClick={() => setRisk(r)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
              risk === r
                ? "bg-violet-500/10 border border-violet-500/30 text-white"
                : "bg-white/[0.02] border border-white/[0.04] text-[#565a6e] hover:text-[#8b8fa3]"
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className="relative h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={allocations}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="weight"
                stroke="none"
                cornerRadius={4}
              >
                {allocations.map((a, i) => (
                  <Cell key={i} fill={a.color} opacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
              wrapperStyle={{ background: "none", border: "none", boxShadow: "none", padding: 0 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0a0a14]/80 backdrop-blur-xl border border-blue-500/30 rounded-lg px-3 py-2 text-xs shadow-xl">
                      <p className="font-medium text-white">{d.protocol}</p>
                      <p className="text-[#8b8fa3] mt-0.5">{d.weight}% allocation</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{expectedApy[risk]}%</p>
              <p className="text-[10px] text-[#565a6e] uppercase tracking-wider">Expected APY</p>
            </div>
          </div>
        </div>

        {/* Allocation details */}
        <div className="space-y-3">
          {allocations.map((a) => (
            <div key={a.protocol} className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-xs font-medium text-white">{a.protocol}</span>
                </div>
                <span className="text-xs font-semibold text-blue-400">{a.weight}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-1.5">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${a.weight}%`, backgroundColor: a.color }} />
              </div>
              <p className="text-[10px] text-[#565a6e]">{a.reasoning}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chart: Portfolio analytics — history + risk metrics ──

function PortfolioChart() {
  const history = useMemo(generateHistory, []);
  const avgApy = Math.round((history.reduce((s, h) => s + h.apy, 0) / history.length) * 100) / 100;

  const riskMetrics = [
    { name: "Sharpe", value: 2.4, max: 4, fill: "#2563eb", label: "Sharpe Ratio" },
    { name: "Vol", value: 4.1, max: 15, fill: "#8b5cf6", label: "Volatility %" },
    { name: "DD", value: 3.2, max: 10, fill: "#ef4444", label: "Max Drawdown %" },
  ];

  const radialData = riskMetrics.map((m) => ({
    name: m.name,
    value: Math.round((m.value / m.max) * 100),
    fill: m.fill,
  }));

  return (
    <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Current APY", value: "8.74%", icon: <TrendingUp className="w-4 h-4" />, color: "text-blue-400" },
          { label: "30-Day Avg", value: `${avgApy}%`, icon: <Activity className="w-4 h-4" />, color: "text-emerald-400" },
          { label: "Sharpe Ratio", value: "2.4", icon: <Target className="w-4 h-4" />, color: "text-violet-400" },
          { label: "Rebalances", value: "9", icon: <BarChart3 className="w-4 h-4" />, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("opacity-60", s.color)}>{s.icon}</span>
              <span className="text-[10px] text-[#565a6e] uppercase tracking-wider">{s.label}</span>
            </div>
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* APY history chart */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider mb-4">
          30-Day APY Performance
        </h3>
        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="premiumApyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#565a6e", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.04)" }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fill: "#565a6e", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
                width={40}
                domain={["auto", "auto"]}
              />
              <Tooltip
                cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
              wrapperStyle={{ background: "none", border: "none", boxShadow: "none", padding: 0 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null;
                  return (
                    <div className="bg-[#0a0a14]/80 backdrop-blur-xl border border-blue-500/30 rounded-lg px-3 py-2 text-xs shadow-xl">
                      <p className="text-[#565a6e]">{label}</p>
                      <p className="font-semibold text-blue-400 mt-0.5">{Number(payload[0].value).toFixed(2)}% APY</p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="apy" stroke="#2563eb" strokeWidth={2} fill="url(#premiumApyGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider mb-4">
            Risk Metrics
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={radialData} startAngle={180} endAngle={0}>
                <RadialBar
                  dataKey="value"
                  cornerRadius={6}
                  background={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Legend
                  iconSize={8}
                  layout="horizontal"
                  verticalAlign="bottom"
                  formatter={(value: string) => <span className="text-[11px] text-[#8b8fa3]">{value}</span>}
                />
                <Tooltip
                  cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
              wrapperStyle={{ background: "none", border: "none", boxShadow: "none", padding: 0 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    const metric = riskMetrics.find((m) => m.name === d.name);
                    return (
                      <div className="bg-[#0a0a14]/80 backdrop-blur-xl border border-blue-500/30 rounded-lg px-3 py-2 text-xs shadow-xl">
                        <p className="font-medium text-white">{metric?.label}</p>
                        <p className="text-[#8b8fa3] mt-0.5">{metric?.value}</p>
                      </div>
                    );
                  }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider mb-4">
            Top Performing Strategy
          </h3>
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04] mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Hermetica</p>
                <p className="text-xs text-[#565a6e] mt-0.5">Structured BTC options vault</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-emerald-400">15.3%</p>
                <p className="text-[10px] text-[#565a6e]">APY</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {riskMetrics.map((m) => (
              <div key={m.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#8b8fa3]">{m.label}</span>
                  <span className="text-xs font-semibold text-white">{m.value}{m.name !== "Sharpe" ? "%" : ""}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(m.value / m.max) * 100}%`, backgroundColor: m.fill }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Endpoint card ──

function EndpointCard({
  endpoint,
  isActive,
  onClick,
}: {
  endpoint: EndpointConfig;
  isActive: boolean;
  onClick: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/[0.06]",
    violet: "border-violet-500/30 bg-violet-500/[0.06]",
    emerald: "border-emerald-500/30 bg-emerald-500/[0.06]",
  };
  const iconColorMap: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/15",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/15",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/15",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "glass-card p-5 text-left w-full transition-all duration-300 group",
        isActive
          ? colorMap[endpoint.color]
          : "border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center border transition-colors",
            isActive ? iconColorMap[endpoint.color] : "bg-white/[0.03] border-white/[0.06] text-[#565a6e]"
          )}
        >
          {endpoint.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{endpoint.title}</h3>
          </div>
          <p className="text-xs text-[#8b8fa3] mt-1 line-clamp-2">{endpoint.description}</p>
        </div>
      </div>
    </button>
  );
}

// ── Response viewer with JSON terminal ──

const MOCK_RESPONSES: Record<EndpointId, object> = {
  "yield-forecast": {
    success: true,
    data: {
      forecast: FORECAST_DATA.protocols,
      generatedAt: new Date().toISOString(),
    },
  },
  "strategy-signals": {
    success: true,
    data: {
      riskProfile: "balanced",
      allocations: STRATEGY_DATA.balanced.map((a) => ({ protocol: a.protocol, weight: a.weight * 100, reasoning: a.reasoning })),
      totalWeight: 10000,
      expectedApy: 8.74,
    },
  },
  "portfolio-analytics": {
    success: true,
    data: {
      currentApy: 8.74,
      thirtyDayAvgApy: 8.52,
      totalRebalances: 9,
      topPerformingStrategy: { protocol: "Hermetica", asset: "hBTC", apy: 15.3 },
      riskMetrics: { sharpeRatio: 2.4, maxDrawdown: -3.2, volatility: 4.1 },
    },
  },
};

function ResponseViewer({ endpointId }: { endpointId: EndpointId }) {
  const [response, setResponse] = useState<object | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [usedLive, setUsedLive] = useState(false);

  const endpoint = ENDPOINTS.find((e) => e.id === endpointId)!;

  async function tryLiveRequest() {
    setLoading(true);
    setError(null);
    setUsedLive(true);
    try {
      const res = await api.get(`/ai/${endpointId}${endpoint.queryParams || ""}`);
      setResponse(res.data);
    } catch {
      setError("Request failed — showing example response below");
      setResponse(MOCK_RESPONSES[endpointId]);
    } finally {
      setLoading(false);
    }
  }

  function showExample() {
    setUsedLive(false);
    setError(null);
    setResponse(MOCK_RESPONSES[endpointId]);
  }

  async function copyResponse() {
    if (!response) return;
    await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="glass-card p-4">
        <p className="text-[10px] text-[#565a6e] uppercase tracking-wider font-medium mb-2">Request</p>
        <code className="text-xs text-[#8b8fa3] font-mono bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04] block overflow-x-auto whitespace-nowrap">
          <span className="text-emerald-400">GET</span>{" "}
          <span className="text-white">{endpoint.path}{endpoint.queryParams || ""}</span>
        </code>
      </div>

      <div className="flex gap-2">
        <button onClick={tryLiveRequest} disabled={loading} className="btn-primary flex items-center gap-2 !py-2 !px-4 !text-xs">
          {loading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Try Live Request
        </button>
        <button onClick={showExample} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-[#8b8fa3] hover:bg-white/[0.07] hover:text-white transition-all">
          <Sparkles className="w-3.5 h-3.5" />
          Show Example
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-400/90">{error}</p>
        </div>
      )}

      {response && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
              <span className="ml-2 text-[10px] text-[#3a3e52] font-mono">
                {usedLive ? "live" : "example"}-response.json
              </span>
            </div>
            <button onClick={copyResponse} className="text-[#565a6e] hover:text-white transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <pre className="p-4 text-xs text-[#8b8fa3] font-mono overflow-x-auto max-h-[280px] overflow-y-auto leading-relaxed">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main page ──

export function PremiumPage() {
  const [activeEndpoint, setActiveEndpoint] = useState<EndpointId>("yield-forecast");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">
            <span className="hero-gradient-warm text-glow-warm">AI Intelligence API</span>
          </h1>
          <span className="badge badge-violet text-[10px]">
            <Zap className="w-3 h-3" />
            x402 Powered
          </span>
        </div>
        <p className="text-sm text-[#565a6e] max-w-2xl">
          Yield intelligence powered by GPT-4o-mini, monetized via HTTP 402 micropayments on Stacks. Pay 0.001 STX per query — no API keys, no subscriptions, no accounts.
        </p>
      </div>

      {/* Endpoint selector */}
      <div>
        <p className="text-[10px] text-[#565a6e] uppercase tracking-wider font-medium mb-3">
          Select Endpoint
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ENDPOINTS.map((ep, i) => (
            <AnimatedBorderCard
              key={ep.id}
              speed={0.3 + i * 0.1}
              className="animate-fade-in-up"
              style={{ animationDelay: `${150 + i * 80}ms` }}
            >
              <EndpointCard endpoint={ep} isActive={activeEndpoint === ep.id} onClick={() => setActiveEndpoint(ep.id)} />
            </AnimatedBorderCard>
          ))}
        </div>
      </div>

      {/* Visualization for active endpoint */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[10px] text-[#565a6e] uppercase tracking-wider font-medium">
            Data Preview
          </p>
          <span className="text-[10px] text-[#3a3e52]">— Example output visualization</span>
        </div>
        {activeEndpoint === "yield-forecast" && <ForecastChart />}
        {activeEndpoint === "strategy-signals" && <StrategyChart />}
        {activeEndpoint === "portfolio-analytics" && <PortfolioChart />}
      </div>

      {/* API Explorer */}
      <div>
        <p className="text-[10px] text-[#565a6e] uppercase tracking-wider font-medium mb-3">
          API Explorer
        </p>
        <div className="glass-card p-5 mb-4">
          {(() => {
            const ep = ENDPOINTS.find((e) => e.id === activeEndpoint)!;
            return (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold font-mono">{ep.method}</span>
                  <code className="text-sm text-white font-mono">{ep.path}</code>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ep.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-400/60 shrink-0" />
                      <span className="text-[11px] text-[#8b8fa3]">{f}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
        <ResponseViewer endpointId={activeEndpoint} />
      </div>

      {/* Integration guide */}
      <div className="glass-card p-6 animate-fade-in-up" style={{ animationDelay: "500ms" }}>
        <h2 className="text-sm font-semibold text-white mb-4">Quick Integration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-[#565a6e] uppercase tracking-wider font-medium mb-2">cURL</p>
            <pre className="text-xs text-[#8b8fa3] font-mono bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] overflow-x-auto leading-relaxed whitespace-pre-wrap">
{`# Request returns HTTP 402 with payment details
curl -v http://localhost:4000/api/ai/yield-forecast
# Response: 402 Payment Required + payment-required header

# Use x402-stacks client for automatic payment
npx tsx -e "
import { createPaymentClient, privateKeyToAccount } from 'x402-stacks';
const account = privateKeyToAccount(process.env.PRIVATE_KEY, 'testnet');
const api = createPaymentClient(account, { baseURL: 'http://localhost:4000/api' });
const res = await api.get('/ai/yield-forecast');
console.log(res.data);
"`}
            </pre>
          </div>
          <div>
            <p className="text-[10px] text-[#565a6e] uppercase tracking-wider font-medium mb-2">JavaScript</p>
            <pre className="text-xs text-[#8b8fa3] font-mono bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] overflow-x-auto leading-relaxed whitespace-pre-wrap">
{`import { createPaymentClient, privateKeyToAccount } from 'x402-stacks';

// x402 auto-handles 402 → sign → pay → response
const account = privateKeyToAccount(key, 'testnet');
const api = createPaymentClient(account, {
  baseURL: 'http://localhost:4000/api'
});
const { data } = await api.get('/ai/yield-forecast');
console.log(data.forecast);`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
