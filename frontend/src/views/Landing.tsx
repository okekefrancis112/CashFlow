import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Cpu,
  TrendingUp,
  Layers,
  Lock,
  Zap,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "../lib/utils";

/* ================================================================
   DATA
   ================================================================ */

const PROTOCOLS = [
  { name: "Zest Protocol", type: "Lending", color: "bg-sky-400", apy: "5.2%" },
  { name: "Bitflow", type: "Liquidity", color: "bg-emerald-400", apy: "12.4%" },
  { name: "StackingDAO", type: "Stacking", color: "bg-violet-400", apy: "7.8%" },
  { name: "Hermetica", type: "Vault", color: "bg-amber-400", apy: "9.1%" },
];

const FEATURES = [
  {
    icon: Cpu,
    title: "AI-Optimized Allocation",
    description: "GPT-powered agent continuously analyzes yield sources and rebalances across protocols for maximum risk-adjusted returns.",
    gradient: "from-blue-600/20 to-blue-600/0",
    iconColor: "group-hover:text-blue-400",
    glowColor: "group-hover:shadow-[0_0_20px_rgba(37,99,235,0.15)]",
  },
  {
    icon: Shield,
    title: "Battle-Tested Security",
    description: "Deposit caps, timelock governance, inflation-attack mitigation, and on-chain circuit breakers protect your capital.",
    gradient: "from-emerald-500/20 to-emerald-500/0",
    iconColor: "group-hover:text-emerald-400",
    glowColor: "group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
  },
  {
    icon: TrendingUp,
    title: "Auto-Compounding",
    description: "Yields are harvested and reinvested automatically. Your cfYIELD share tokens appreciate in value over time.",
    gradient: "from-sky-500/20 to-sky-500/0",
    iconColor: "group-hover:text-sky-400",
    glowColor: "group-hover:shadow-[0_0_20px_rgba(14,165,233,0.15)]",
  },
  {
    icon: Layers,
    title: "Multi-Protocol Diversification",
    description: "Capital is spread across 5+ DeFi protocols on Stacks, reducing single-protocol risk.",
    gradient: "from-violet-500/20 to-violet-500/0",
    iconColor: "group-hover:text-violet-400",
    glowColor: "group-hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]",
  },
  {
    icon: Lock,
    title: "Non-Custodial",
    description: "Your funds are held in auditable Clarity smart contracts on Stacks L2. Withdraw anytime by burning shares.",
    gradient: "from-indigo-500/20 to-indigo-500/0",
    iconColor: "group-hover:text-indigo-400",
    glowColor: "group-hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]",
  },
  {
    icon: Zap,
    title: "x402 Premium Intelligence",
    description: "Pay-per-request AI forecasts and strategy signals via HTTP micropayments. No API keys needed.",
    gradient: "from-blue-500/20 to-blue-500/0",
    iconColor: "group-hover:text-blue-400",
    glowColor: "group-hover:shadow-[0_0_20px_rgba(37,99,235,0.15)]",
  },
];

const STEPS = [
  { step: "01", title: "Connect Wallet", description: "Link your Stacks wallet in one click." },
  { step: "02", title: "Deposit sBTC", description: "Choose your asset and deposit amount. You receive cfYIELD share tokens." },
  { step: "03", title: "AI Optimizes", description: "Our AI agent allocates across Zest, Bitflow, StackingDAO, and Hermetica." },
  { step: "04", title: "Earn & Withdraw", description: "Yield auto-compounds. Withdraw anytime — your shares are always redeemable." },
];

const FAQS = [
  {
    q: "What is CashFlow?",
    a: "CashFlow is an AI-powered yield aggregator built on Bitcoin's Stacks L2. It accepts sBTC deposits, allocates capital across multiple DeFi protocols, and auto-compounds returns — all managed by intelligent AI agents.",
  },
  {
    q: "How does the AI optimization work?",
    a: "Our GPT-powered agent continuously monitors yields across Zest, Bitflow, StackingDAO, and Hermetica. It analyzes risk-adjusted returns, rebalances allocations, and harvests yields automatically every 12-24 hours.",
  },
  {
    q: "What are cfYIELD tokens?",
    a: "cfYIELD is a SIP-010 compliant share token you receive when depositing. As yields compound, each cfYIELD token appreciates in value. Burn your shares anytime to withdraw your proportional assets.",
  },
  {
    q: "Is my deposit safe?",
    a: "Funds are held in auditable Clarity smart contracts with deposit caps, circuit breakers, emergency withdraw, and timelock governance. Contracts will undergo external audit before mainnet launch.",
  },
  {
    q: "What fees does CashFlow charge?",
    a: "A 10% performance fee is collected only on yield generated — never on your principal. If the vault doesn't earn, you don't pay. Fee collection is automated and transparent on-chain.",
  },
  {
    q: "What is x402 premium intelligence?",
    a: "x402 is a pay-per-request protocol. Access AI yield forecasts, strategy signals, and portfolio analytics via HTTP micropayments in STX. No API keys or subscriptions — just pay per request.",
  },
];

/* ================================================================
   HOOKS
   ================================================================ */

/** Scroll-triggered visibility hook using IntersectionObserver */
function useScrollReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

/** Animated number counter that counts up from 0 to target */
function AnimatedCounter({ value, suffix = "", decimals = 0, className }: {
  value: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1800;
          const start = performance.now();
          const step = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(eased * value);
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {display.toFixed(decimals)}{suffix}
    </span>
  );
}

/** Rising particles that float upward */
function RisingParticles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 6}s`,
    duration: `${4 + Math.random() * 4}s`,
    size: Math.random() * 3 + 1,
    drift: `${(Math.random() - 0.5) * 60}px`,
    opacity: Math.random() * 0.4 + 0.1,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-0 animate-rise-particle"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            ["--drift" as string]: p.drift,
            ["--duration" as string]: p.duration,
          }}
        >
          <div
            className="rounded-full bg-blue-400"
            style={{ width: p.size, height: p.size, opacity: p.opacity }}
          />
        </div>
      ))}
    </div>
  );
}

/** Orbiting rings with dot markers */
function OrbitalRings() {
  return (
    <div className="absolute top-1/2 left-1/2 pointer-events-none" aria-hidden="true">
      <div className="hero-ring hero-ring--sm" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="animate-orbit-tight opacity-30">
          <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
        </div>
      </div>

      <div className="hero-ring hero-ring--md" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="animate-orbit opacity-20">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
        </div>
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="animate-orbit opacity-15" style={{ animationDelay: "-10s" }}>
          <div className="w-1 h-1 rounded-full bg-indigo-400" />
        </div>
      </div>

      <div className="hero-ring hero-ring--lg" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="animate-orbit-wide opacity-10">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
        </div>
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="animate-orbit-wide opacity-10" style={{ animationDuration: "35s", animationDirection: "reverse" }}>
          <div className="w-1 h-1 rounded-full bg-blue-400" />
        </div>
      </div>
    </div>
  );
}

/** FAQ Accordion item */
function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div className="glass-card overflow-hidden transition-all duration-300 group">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <span className="text-[15px] font-medium text-white pr-4">{q}</span>
        <ChevronDown className={cn(
          "w-4 h-4 text-[#565a6e] shrink-0 transition-transform duration-300",
          isOpen && "rotate-180 text-blue-400"
        )} />
      </button>
      <div
        className="overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ maxHeight: height }}
      >
        <div ref={contentRef} className="px-5 pb-5">
          <p className="text-sm text-[#8b8fa3] leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

/** Marquee scrolling protocol bar */
function ProtocolMarquee() {
  const items = [...PROTOCOLS, ...PROTOCOLS, ...PROTOCOLS];
  return (
    <div className="marquee-container overflow-hidden">
      <div className="marquee-track flex gap-12">
        {items.map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex items-center gap-3 shrink-0">
            <div className={cn("w-2.5 h-2.5 rounded-full animate-glow-pulse", p.color)} />
            <span className="text-sm font-semibold text-white/90 whitespace-nowrap">{p.name}</span>
            <span className="text-[11px] text-[#565a6e] whitespace-nowrap">{p.type}</span>
            <span className="text-[11px] font-mono text-emerald-400/70 whitespace-nowrap">{p.apy}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Terminal-style typing line */
function TerminalLine({ text, delay }: { text: string; delay: number }) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasTyped = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTyped.current) {
          hasTyped.current = true;
          setTimeout(() => {
            setShowCursor(true);
            let i = 0;
            const interval = setInterval(() => {
              setDisplayed(text.slice(0, i + 1));
              i++;
              if (i >= text.length) {
                clearInterval(interval);
                setTimeout(() => setShowCursor(false), 500);
              }
            }, 35);
          }, delay);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, delay]);

  return (
    <div ref={ref} className="font-mono text-xs">
      <span className="text-blue-400/60">$ </span>
      <span className="text-[#8b8fa3]">{displayed}</span>
      {showCursor && <span className="inline-block w-[6px] h-[14px] bg-blue-400/80 ml-0.5 animate-blink-cursor" />}
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

interface LandingProps {
  onConnect: () => void;
  isConnected: boolean;
  weightedApy: number;
}

export function Landing({ onConnect, isConnected, weightedApy }: LandingProps) {
  const displayApy = weightedApy > 0 ? weightedApy.toFixed(1) : "8.7";
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Scroll reveal refs for each section
  const protocols = useScrollReveal<HTMLElement>(0.2);
  const features = useScrollReveal<HTMLElement>(0.1);
  const howItWorks = useScrollReveal<HTMLElement>(0.1);
  const x402 = useScrollReveal<HTMLElement>(0.15);
  const faq = useScrollReveal<HTMLElement>(0.1);
  const finalCta = useScrollReveal<HTMLElement>(0.2);

  const toggleFaq = useCallback((i: number) => {
    setOpenFaq((prev) => (prev === i ? null : i));
  }, []);

  return (
    <div className="space-y-0">
      {/* ===== Hero ===== */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/[0.06] animate-morph-blob blur-[140px]" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-500/[0.04] animate-morph-blob blur-[120px]" style={{ animationDelay: "-4s", animationDuration: "15s" }} />
          <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-violet-500/[0.03] animate-morph-blob blur-[100px]" style={{ animationDelay: "-8s", animationDuration: "18s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/[0.04] animate-breathe blur-[100px]" />
          <OrbitalRings />
          <RisingParticles />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-10">
          {/* Status badge */}
          <div className="animate-reveal-up inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[13px] font-medium text-[#8b8fa3] backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            Live on Stacks Testnet
          </div>

          {/* Headline */}
          <div className="space-y-5">
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]">
              <span className="text-white animate-reveal-up inline-block" style={{ animationDelay: "100ms" }}>
                Maximize your
              </span>
              <br />
              <span className="hero-gradient-text text-glow-navy inline-block" style={{ animationDelay: "250ms" }}>
                Bitcoin yield
              </span>
            </h2>
            <p className="text-base md:text-lg text-[#8b8fa3] max-w-xl mx-auto leading-relaxed animate-reveal-up" style={{ animationDelay: "400ms" }}>
              AI-powered yield aggregator that allocates your sBTC across
              Stacks DeFi protocols for optimal risk-adjusted returns.
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-10">
            <div className="text-center animate-stat-pop" style={{ animationDelay: "600ms" }}>
              <p className="text-4xl md:text-5xl font-bold text-emerald-400 text-glow-emerald stat-value-glow">
                <AnimatedCounter value={parseFloat(displayApy)} suffix="%" decimals={1} />
              </p>
              <p className="text-xs text-[#565a6e] mt-2 uppercase tracking-wider font-medium">Weighted APY</p>
            </div>
            <div className="w-px h-14 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent animate-fade-in" style={{ animationDelay: "700ms" }} />
            <div className="text-center animate-stat-pop" style={{ animationDelay: "750ms" }}>
              <p className="text-4xl md:text-5xl font-bold text-white stat-value-glow">
                <AnimatedCounter value={5} suffix="+" decimals={0} />
              </p>
              <p className="text-xs text-[#565a6e] mt-2 uppercase tracking-wider font-medium">DeFi Protocols</p>
            </div>
            <div className="w-px h-14 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent animate-fade-in" style={{ animationDelay: "850ms" }} />
            <div className="text-center animate-stat-pop" style={{ animationDelay: "900ms" }}>
              <p className="text-4xl md:text-5xl font-bold text-white stat-value-glow">24/7</p>
              <p className="text-xs text-[#565a6e] mt-2 uppercase tracking-wider font-medium">Auto-Compound</p>
            </div>
          </div>

          {/* CTA */}
          <div className="animate-reveal-up flex items-center justify-center gap-4 pt-2" style={{ animationDelay: "1000ms" }}>
            {isConnected ? (
              <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2.5 group">
                Go to Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            ) : (
              <button onClick={onConnect} className="btn-primary inline-flex items-center gap-2.5 group animate-pulse-glow">
                Launch App
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
            )}
            <Link href="/dashboard" className="btn-secondary inline-flex items-center gap-2">
              Explore Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Protocol bar — marquee + trust badges ===== */}
      <section
        ref={protocols.ref}
        className={cn(
          "py-10 transition-all duration-700",
          protocols.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
      >
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="max-w-5xl mx-auto py-6 space-y-6">
            <p className="text-center text-[10px] text-[#565a6e] uppercase tracking-[0.2em] font-medium">
              Trusted yield sources across Stacks DeFi
            </p>
            <ProtocolMarquee />
            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 pt-2">
              {["Clarity Contracts", "On-Chain Verified", "Open Source", "Auditable"].map((badge, i) => (
                <div
                  key={badge}
                  className={cn(
                    "flex items-center gap-1.5 transition-all duration-500",
                    protocols.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
                  )}
                  style={{ transitionDelay: `${300 + i * 100}ms` }}
                >
                  <Shield className="w-3 h-3 text-emerald-400/60" />
                  <span className="text-[11px] text-[#565a6e] font-medium">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features grid ===== */}
      <section ref={features.ref} className="py-28">
        <div className="max-w-6xl mx-auto">
          <div className={cn(
            "text-center mb-16 transition-all duration-700",
            features.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-blue-400/80 font-medium mb-3">Why CashFlow</p>
            <h3 className="text-3xl md:text-4xl font-bold text-white">
              Built for Bitcoin DeFi
            </h3>
            <p className="text-[#8b8fa3] mt-3 text-base max-w-lg mx-auto">
              Enterprise-grade security with AI-driven optimization
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, description, gradient, iconColor, glowColor }, i) => (
              <div
                key={title}
                className={cn(
                  "glass-card glass-card-hover p-6 group transition-all duration-700",
                  glowColor,
                  features.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                )}
                style={{ transitionDelay: `${200 + i * 120}ms` }}
              >
                {/* Gradient accent */}
                <div className={cn("absolute top-0 left-0 w-full h-24 bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-500", gradient)} />

                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4 group-hover:border-blue-600/20 group-hover:bg-blue-600/[0.06] transition-all duration-300">
                    <Icon className={cn("w-5 h-5 text-[#8b8fa3] transition-colors duration-300", iconColor)} />
                  </div>
                  <h4 className="text-[15px] font-semibold text-white mb-2">{title}</h4>
                  <p className="text-sm text-[#8b8fa3] leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section ref={howItWorks.ref} className="py-28 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        <div className="max-w-5xl mx-auto">
          <div className={cn(
            "text-center mb-16 transition-all duration-700",
            howItWorks.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-blue-400/80 font-medium mb-3">Getting Started</p>
            <h3 className="text-3xl md:text-4xl font-bold text-white">How it works</h3>
            <p className="text-[#8b8fa3] mt-3 text-base">From deposit to yield in four steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map(({ step, title, description }, i) => (
              <div
                key={step}
                className={cn(
                  "relative transition-all duration-700",
                  howItWorks.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                )}
                style={{ transitionDelay: `${300 + i * 200}ms` }}
              >
                <div className="glass-card glass-card-hover p-6 h-full group">
                  <div className="relative">
                    {/* Animated step number */}
                    <div className="relative inline-block">
                      <span className="text-4xl font-bold bg-gradient-to-b from-blue-600/20 to-transparent bg-clip-text text-transparent">
                        {step}
                      </span>
                      {/* Pulse ring on step number */}
                      <div className={cn(
                        "absolute -inset-2 rounded-full border border-blue-600/10 transition-all duration-1000",
                        howItWorks.isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"
                      )} style={{ transitionDelay: `${600 + i * 200}ms` }} />
                    </div>
                    <h4 className="text-[15px] font-semibold text-white mt-3 mb-2">{title}</h4>
                    <p className="text-sm text-[#8b8fa3] leading-relaxed">{description}</p>
                  </div>
                </div>
                {/* Animated connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "hidden lg:block absolute top-1/2 -right-3 h-px bg-gradient-to-r from-blue-600/20 to-transparent transition-all duration-700 origin-left",
                      howItWorks.isVisible ? "w-6 opacity-100 scale-x-100" : "w-0 opacity-0 scale-x-0"
                    )}
                    style={{ transitionDelay: `${800 + i * 200}ms` }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== x402 section ===== */}
      <section ref={x402.ref} className="py-28 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Floating background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-violet-500/[0.03] rounded-full blur-[100px] animate-float-drift" />
          <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-blue-500/[0.03] rounded-full blur-[80px] animate-float-drift" style={{ animationDelay: "-4s" }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className={cn(
            "transition-all duration-700",
            x402.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <span className="badge badge-violet">
              <Zap className="w-3 h-3" />
              x402 Protocol
            </span>
          </div>
          <h3 className={cn(
            "mt-6 text-3xl md:text-4xl font-bold text-white transition-all duration-700",
            x402.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )} style={{ transitionDelay: "150ms" }}>
            Premium AI Intelligence
          </h3>
          <p className={cn(
            "text-[#8b8fa3] text-base max-w-xl mx-auto mt-4 mb-10 transition-all duration-700",
            x402.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )} style={{ transitionDelay: "250ms" }}>
            Access yield forecasts, strategy signals, and portfolio analytics via HTTP micropayments.
            No API keys — just pay per request with STX.
          </p>

          {/* Terminal window */}
          <div className={cn(
            "glass-card-elevated rounded-xl overflow-hidden text-left max-w-2xl mx-auto mb-10 transition-all duration-700",
            x402.isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
          )} style={{ transitionDelay: "400ms" }}>
            {/* Terminal header */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.04]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
              <span className="ml-3 text-[10px] text-[#3a3e52] font-mono">x402-terminal</span>
            </div>
            {/* Terminal body */}
            <div className="p-4 space-y-2.5">
              {x402.isVisible && (
                <>
                  <TerminalLine text='curl -H "X-Payment: 0.1 STX" /api/premium/yield-forecast' delay={600} />
                  <TerminalLine text='{ "forecast": { "7d_apy": "9.2%", "confidence": 0.87 } }' delay={2200} />
                  <TerminalLine text='curl -H "X-Payment: 0.15 STX" /api/premium/strategy-signals' delay={3800} />
                  <TerminalLine text='{ "signal": "increase_zest_allocation", "weight": 0.35 }' delay={5400} />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { endpoint: "yield-forecast", price: "0.1 STX", desc: "7-day AI projections" },
              { endpoint: "strategy-signals", price: "0.15 STX", desc: "Optimal allocation weights" },
              { endpoint: "portfolio-analytics", price: "0.2 STX", desc: "Performance & risk metrics" },
            ].map(({ endpoint, price, desc }, i) => (
              <div
                key={endpoint}
                className={cn(
                  "glass-card glass-card-hover p-5 text-left group transition-all duration-700",
                  x402.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                )}
                style={{ transitionDelay: `${600 + i * 150}ms` }}
              >
                <div className="relative">
                  <code className="text-[11px] text-violet-400/80 font-mono">
                    GET /api/premium/{endpoint}
                  </code>
                  <p className="text-sm text-[#8b8fa3] mt-2">{desc}</p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm font-semibold text-blue-400">{price}</p>
                    <ExternalLink className="w-3.5 h-3.5 text-[#3a3e52] group-hover:text-blue-400/60 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section ref={faq.ref} className="py-28 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        <div className="max-w-3xl mx-auto">
          <div className={cn(
            "text-center mb-12 transition-all duration-700",
            faq.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-blue-400/80 font-medium mb-3">FAQ</p>
            <h3 className="text-3xl md:text-4xl font-bold text-white">
              Frequently asked questions
            </h3>
            <p className="text-[#8b8fa3] mt-3 text-base">Everything you need to know about CashFlow</p>
          </div>

          <div className="space-y-3">
            {FAQS.map(({ q, a }, i) => (
              <div
                key={i}
                className={cn(
                  "transition-all duration-700",
                  faq.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                <FaqItem
                  q={q}
                  a={a}
                  isOpen={openFaq === i}
                  onToggle={() => toggleFaq(i)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section ref={finalCta.ref} className="py-28 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/[0.05] rounded-full blur-[140px] animate-breathe" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/[0.03] rounded-full blur-[100px] animate-morph-blob" style={{ animationDuration: "15s" }} />
        </div>

        <div className={cn(
          "relative max-w-2xl mx-auto text-center transition-all duration-700",
          finalCta.isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
        )}>
          {/* Decorative rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-dashed border-blue-600/[0.06] animate-ring-rotate pointer-events-none" aria-hidden="true" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-dashed border-indigo-500/[0.04] animate-ring-rotate-reverse pointer-events-none" style={{ animationDuration: "35s" }} aria-hidden="true" />

          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 relative">
            Start earning yield on your Bitcoin
          </h3>
          <p className="text-[#8b8fa3] text-base mb-10 relative">
            Connect your wallet and let AI optimize your returns across Stacks DeFi.
          </p>

          <div className="relative flex items-center justify-center gap-4">
            {isConnected ? (
              <Link
                href="/dashboard"
                className="btn-primary inline-flex items-center gap-2.5 !px-10 !py-3.5 !text-base group"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            ) : (
              <button
                onClick={onConnect}
                className="btn-primary inline-flex items-center gap-2.5 !px-10 !py-3.5 !text-base group animate-pulse-glow"
              >
                Connect Wallet & Start
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
            )}
          </div>

          {/* Trust row */}
          <div className={cn(
            "mt-10 flex items-center justify-center gap-6 transition-all duration-700",
            finalCta.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )} style={{ transitionDelay: "400ms" }}>
            {[
              { icon: Shield, label: "Non-Custodial" },
              { icon: Lock, label: "Auditable Contracts" },
              { icon: Zap, label: "Instant Withdrawals" },
            ].map(({ icon: TrustIcon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <TrustIcon className="w-3.5 h-3.5 text-emerald-400/50" />
                <span className="text-[11px] text-[#565a6e] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
