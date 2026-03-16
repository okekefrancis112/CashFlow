import type { CSSProperties } from "react";
import { cn } from "../../lib/utils";

export function LoadingSkeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("rounded-lg skeleton-shimmer", className)} style={style} />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-3 animate-fade-in">
      <LoadingSkeleton className="h-4 w-24" />
      <LoadingSkeleton className="h-8 w-32" />
      <LoadingSkeleton className="h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 animate-fade-in">
      {Array.from({ length: rows }).map((_, i) => (
        <LoadingSkeleton key={i} className="h-12 w-full" style={{ animationDelay: `${i * 50}ms` }} />
      ))}
    </div>
  );
}
