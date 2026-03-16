"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/format";
import { Logo } from "../common/Logo";
import { useState, useRef, useEffect } from "react";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/yields", label: "Yields" },
  { to: "/analytics", label: "Analytics" },
];

interface NavbarProps {
  walletAddress: string | null;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Navbar({ walletAddress, isConnected, onConnect, onDisconnect }: NavbarProps) {
  const pathname = usePathname();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50 animate-fade-in-down"
    >
      <div className="absolute inset-0 bg-[#06060b]/70 backdrop-blur-xl border-b border-white/[0.04]" />

      <div className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Logo size={30} />
            <span className="text-[17px] font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors duration-200">
              CashFlow
            </span>
          </Link>

          <span className="badge badge-navy text-[10px] py-1 px-2.5 animate-pulse-glow">
            Testnet
          </span>

          <div className="hidden md:flex items-center gap-1 ml-2">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = pathname === to;
              return (
                <Link
                  key={to}
                  href={to}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200",
                    isActive
                      ? "text-white"
                      : "text-[#8b8fa3] hover:text-white"
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-lg bg-white/[0.06] border border-white/[0.06]" />
                  )}
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {isConnected && walletAddress ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200",
                "bg-white/[0.04] border border-white/[0.06] text-white",
                "hover:bg-white/[0.07] hover:border-white/[0.1]"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{formatAddress(walletAddress)}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-[#565a6e] transition-transform duration-200", showDropdown && "rotate-180")} />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 glass-card glass-card-elevated rounded-xl p-1.5 animate-scale-in origin-top-right">
                <div className="px-3 py-2 mb-1">
                  <p className="text-[10px] text-[#565a6e] uppercase tracking-wider font-medium">Connected</p>
                  <p className="text-xs text-[#8b8fa3] mt-0.5 font-mono truncate">{walletAddress}</p>
                </div>
                <div className="h-px bg-white/[0.04] mx-2" />
                <button
                  onClick={() => { onDisconnect(); setShowDropdown(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors duration-150"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="btn-primary flex items-center gap-2 !py-2 !px-5 !text-[13px]"
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
