import { Shield, AlertTriangle, AlertOctagon } from "lucide-react";
import { cn } from "../../lib/utils";
import type { RiskLevel } from "../../types";

const RISK_CONFIG: Record<RiskLevel, { badge: string; Icon: typeof Shield }> = {
  low: { badge: "badge-emerald", Icon: Shield },
  medium: { badge: "badge-amber", Icon: AlertTriangle },
  high: { badge: "badge-red", Icon: AlertOctagon },
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const config = RISK_CONFIG[risk] || RISK_CONFIG.medium;
  const { Icon } = config;
  return (
    <span className={cn("badge text-[11px] capitalize", config.badge)}>
      <Icon className="w-3 h-3" />
      {risk}
    </span>
  );
}
