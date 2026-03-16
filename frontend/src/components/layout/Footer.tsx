import Link from "next/link";
import { Github, Twitter, Globe, Shield } from "lucide-react";
import { Logo } from "../common/Logo";

const PRODUCT_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Yields", href: "/yields" },
  { label: "Analytics", href: "/analytics" },
];

const RESOURCE_LINKS = [
  { label: "Documentation", href: "#" },
  { label: "Smart Contracts", href: "#" },
  { label: "API Reference", href: "#" },
];

const TECH = ["Stacks L2", "sBTC", "Clarity", "x402"];

const SOCIALS = [
  { icon: Github, href: "#", label: "GitHub" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Globe, href: "#", label: "Website" },
];

export function Footer() {
  return (
    <footer className="relative mt-12 animate-fade-in">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <Logo size={22} />
              <span className="text-sm font-semibold text-white">CashFlow</span>
            </div>
            <p className="text-xs text-[#565a6e] max-w-[280px] leading-relaxed">
              AI-powered yield aggregator for Bitcoin DeFi on Stacks. Maximize returns with intelligent allocation.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3 pt-1">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:border-blue-600/20 hover:bg-blue-600/[0.06] transition-all duration-300 group"
                >
                  <Icon className="w-3.5 h-3.5 text-[#565a6e] group-hover:text-blue-400 transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Product links */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#565a6e] font-medium mb-4">Product</p>
            <div className="space-y-2.5">
              {PRODUCT_LINKS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-xs text-[#8b8fa3] hover:text-white transition-colors duration-200"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#565a6e] font-medium mb-4">Resources</p>
            <div className="space-y-2.5">
              {RESOURCE_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="block text-xs text-[#8b8fa3] hover:text-white transition-colors duration-200"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Built With */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#565a6e] font-medium mb-4">Built With</p>
            <div className="flex flex-wrap gap-2">
              {TECH.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.04] text-[#8b8fa3]"
                >
                  {t}
                </span>
              ))}
            </div>
            {/* Security badge */}
            <div className="mt-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/[0.08]">
              <Shield className="w-3.5 h-3.5 text-emerald-400/60" />
              <span className="text-[11px] text-emerald-400/70 font-medium">Auditable Smart Contracts</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.04] flex items-center justify-between">
          <p className="text-[11px] text-[#3a3e52]">
            &copy; {new Date().getFullYear()} CashFlow. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-[11px] text-[#3a3e52] hover:text-[#565a6e] transition-colors">Terms</a>
            <a href="#" className="text-[11px] text-[#3a3e52] hover:text-[#565a6e] transition-colors">Privacy</a>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-[11px] text-[#565a6e]">Testnet Live</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
