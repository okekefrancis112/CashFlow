import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  className?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, sub, icon, className, highlight }: StatCardProps) {
  return (
    <div className={cn(
      "glass-card glass-card-hover p-5 group",
      className
    )}>
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-[#565a6e] uppercase tracking-wider">{label}</p>
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center text-[#565a6e] group-hover:text-blue-400 group-hover:border-blue-600/20 transition-all duration-300">
              {icon}
            </div>
          )}
        </div>
        <p className={cn(
          "text-2xl font-bold tracking-tight",
          highlight ? "text-emerald-400 text-glow-emerald" : "text-white"
        )}>
          {value}
        </p>
        {sub && <p className="text-xs text-[#565a6e] mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}
