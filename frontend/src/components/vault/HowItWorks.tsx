import { ArrowDownToLine, Brain, TrendingUp, ArrowUpFromLine } from "lucide-react";

const STEPS = [
  { icon: ArrowDownToLine, title: "Deposit", desc: "Deposit sBTC or USDCx into the vault" },
  { icon: Brain, title: "AI Optimizes", desc: "AI agent allocates across 5+ DeFi protocols" },
  { icon: TrendingUp, title: "Earn Yield", desc: "Auto-compounded Bitcoin-native yield" },
  { icon: ArrowUpFromLine, title: "Withdraw", desc: "Withdraw anytime by burning cfYIELD shares" },
];

export function HowItWorks() {
  return (
    <div className="glass-card p-6">
      <h3 className="text-xs font-medium text-[#565a6e] uppercase tracking-wider mb-5">How It Works</h3>
      <div className="space-y-4">
        {STEPS.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="flex items-start gap-3.5 group animate-fade-in-left"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.04] text-[#8b8fa3] shrink-0 group-hover:text-blue-400 group-hover:border-blue-600/20 group-hover:bg-blue-600/[0.06] transition-all duration-300">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-white">
                <span className="text-blue-400/60 mr-1.5 font-mono text-xs">{i + 1}</span>
                {title}
              </p>
              <p className="text-xs text-[#565a6e] mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
