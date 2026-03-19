"use client";

import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

interface AnimatedBorderCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  speed?: number;
  colors?: [string, string, string, string];
}

/**
 * Card with animated border elements that flow around the perimeter.
 * Inspired by dynamic-border-animations-card from 21st.dev.
 * Uses requestAnimationFrame for smooth 60fps motion.
 */
export function AnimatedBorderCard({
  children,
  className,
  style,
  speed = 0.5,
  colors = [
    "rgba(249, 115, 22, 0.6)",   // orange
    "rgba(139, 92, 246, 0.6)",   // violet
    "rgba(37, 99, 235, 0.6)",    // blue
    "rgba(16, 185, 129, 0.6)",   // emerald
  ],
}: AnimatedBorderCardProps) {
  const topRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationId: number;

    const animate = () => {
      const now = performance.now() / 1000;
      const pos = (axis: "sin" | "cos") => {
        const fn = axis === "sin" ? Math.sin : Math.cos;
        return `${50 + fn(now * speed) * 50}%`;
      };

      if (topRef.current) topRef.current.style.transform = `translateX(${pos("sin")})`;
      if (rightRef.current) rightRef.current.style.transform = `translateY(${pos("cos")})`;
      if (bottomRef.current) bottomRef.current.style.transform = `translateX(${pos("cos")})`;
      if (leftRef.current) leftRef.current.style.transform = `translateY(${pos("sin")})`;

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [speed]);

  return (
    <div className={cn("relative rounded-2xl overflow-hidden", className)} style={style}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(22,22,37,0.9)] to-[rgba(19,19,31,0.7)] backdrop-blur-xl" />

      {/* Animated border elements */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Top */}
        <div
          ref={topRef}
          className="absolute top-0 left-0 w-1/2 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors[0]}, transparent)`,
          }}
        />
        {/* Right */}
        <div
          ref={rightRef}
          className="absolute top-0 right-0 w-[1px] h-1/2"
          style={{
            background: `linear-gradient(180deg, transparent, ${colors[1]}, transparent)`,
          }}
        />
        {/* Bottom */}
        <div
          ref={bottomRef}
          className="absolute bottom-0 left-0 w-1/2 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors[2]}, transparent)`,
          }}
        />
        {/* Left */}
        <div
          ref={leftRef}
          className="absolute top-0 left-0 w-[1px] h-1/2"
          style={{
            background: `linear-gradient(180deg, transparent, ${colors[3]}, transparent)`,
          }}
        />
      </div>

      {/* Static subtle border */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.04] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
