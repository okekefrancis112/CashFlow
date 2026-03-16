import { useState } from "react";
import { cn } from "../../lib/utils";
import { useDeposit } from "../../hooks/useDeposit";
import { useWithdraw } from "../../hooks/useWithdraw";
import { useReportYield } from "../../hooks/useReportYield";
import { useUserBalance } from "../../hooks/useUserBalance";
import { useSwap } from "../../hooks/useSwap";
import type { TransactionState } from "../../types";

const ASSETS = ["sBTC", "USDCx"] as const;
const QUICK_AMOUNTS = ["0.01", "0.05", "0.1", "0.5"] as const;

const EXPLORER_URL = "https://explorer.hiro.so/txid";

interface DepositWithdrawPanelProps {
  isConnected: boolean;
  address: string | null;
  onConnect: () => void;
}

function TxStatusBadge({ state, txId }: { state: TransactionState; txId: string | null }) {
  if (state === "idle") return null;

  const config: Record<string, { label: string; color: string; bg: string }> = {
    signing: { label: "Waiting for signature...", color: "text-amber-400", bg: "bg-amber-400/10" },
    pending: { label: "Confirming...", color: "text-sky-400", bg: "bg-sky-400/10" },
    confirmed: { label: "Confirmed!", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    failed: { label: "Failed", color: "text-red-400", bg: "bg-red-400/10" },
  };

  const { label, color, bg } = config[state] || config.failed;

  return (
    <div className={cn("flex items-center justify-center gap-2 text-xs mt-4 py-2 rounded-lg", color, bg)}>
      {(state === "signing" || state === "pending") && (
        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {label}
      {txId && state !== "signing" && (
        <a
          href={`${EXPLORER_URL}/${txId}?chain=testnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-white transition-colors"
        >
          View tx
        </a>
      )}
    </div>
  );
}

export function DepositWithdrawPanel({ isConnected, address, onConnect }: DepositWithdrawPanelProps) {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<string>("sBTC");

  const [yieldAmount, setYieldAmount] = useState("");

  const { deposit, txId: depositTxId, txState: depositState, error: depositError, reset: resetDeposit } = useDeposit();
  const { withdraw, txId: withdrawTxId, txState: withdrawState, error: withdrawError, reset: resetWithdraw } = useWithdraw();
  const { reportYield, txId: yieldTxId, txState: yieldState, error: yieldError, reset: resetYield } = useReportYield();
  const { balance, refetch: refetchBalance } = useUserBalance(address);
  const { swap, txState: swapState, txId: swapTxId, error: swapError, reset: resetSwap } = useSwap();

  const txState = tab === "deposit" ? depositState : withdrawState;
  const txId = tab === "deposit" ? depositTxId : withdrawTxId;
  const txError = tab === "deposit" ? depositError : withdrawError;
  const isPending = txState === "signing" || txState === "pending";

  const handleSubmit = async () => {
    if (!isConnected || !address) { onConnect(); return; }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    if (tab === "deposit") {
      resetDeposit();
      await deposit(asset, numAmount, address);
    } else {
      resetWithdraw();
      await withdraw(asset, numAmount);
    }

    // Staggered refetch: try multiple times as tx confirms on-chain
    for (const delay of [3000, 8000, 15000, 30000]) {
      setTimeout(refetchBalance, delay);
    }
  };

  const handleTabSwitch = (t: "deposit" | "withdraw") => {
    setTab(t);
    resetDeposit();
    resetWithdraw();
  };

  return (
    <div className="glass-card glass-card-elevated p-6 animate-scale-in">
      {/* Tab selector */}
      <div className="flex gap-1 mb-5 p-1 bg-white/[0.02] rounded-xl border border-white/[0.04]">
        {(["deposit", "withdraw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => handleTabSwitch(t)}
            className={cn(
              "flex-1 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 capitalize",
              tab === t
                ? "bg-white/[0.06] text-white shadow-sm"
                : "text-[#565a6e] hover:text-[#8b8fa3]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* User balance */}
      {isConnected && balance && (
        <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-[11px] font-medium text-[#565a6e] uppercase tracking-wider mb-2">Your Balances</p>
          <div className="flex justify-between text-xs">
            <span className="text-[#8b8fa3]">sBTC</span>
            <span className="text-white font-medium">{((Number(balance.deposits.sBTC) || 0) / 1_000_000).toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-[#8b8fa3]">USDCx</span>
            <span className="text-white font-medium">{((Number(balance.deposits.USDCx) || 0) / 1_000_000).toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1 pt-1.5 border-t border-white/[0.04]">
            <span className="text-[#8b8fa3]">cfYIELD Shares</span>
            <span className="text-emerald-400 font-medium">{((Number(balance.shares) || 0) / 1_000_000).toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-[#8b8fa3]">Share Value</span>
            <span className="text-emerald-400 font-medium">{((Number(balance.shareValue) || 0) / 1_000_000).toFixed(6)}</span>
          </div>
          {(Number(balance.sharePrice) || 0) !== 1000000 && (
            <div className="flex justify-between text-xs mt-1">
              <span className="text-[#8b8fa3]">Share Price</span>
              <span className="text-[#8b8fa3] font-medium">{((Number(balance.sharePrice) || 0) / 1_000_000).toFixed(6)}x</span>
            </div>
          )}
        </div>
      )}

      {/* Testnet faucet: swap STX for sBTC */}
      {isConnected && (
        <div className="mb-4">
          <button
            onClick={async () => {
              resetSwap();
              await swap(10); // 10 STX -> 0.1 sBTC
              for (const delay of [3000, 8000, 15000, 30000]) {
                setTimeout(refetchBalance, delay);
              }
            }}
            disabled={swapState === "signing" || swapState === "pending"}
            className="w-full py-2 rounded-lg text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all duration-200 disabled:opacity-40"
          >
            {swapState === "signing" || swapState === "pending"
              ? "Swapping..."
              : "Get Test sBTC (swap 10 STX for 0.1 sBTC)"}
          </button>
          <TxStatusBadge state={swapState} txId={swapTxId} />
          {swapError && <p className="text-xs text-red-400 mt-1 text-center">{swapError}</p>}
        </div>
      )}

      {/* Report Yield (owner/harvester only) */}
      {isConnected && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
          <p className="text-[11px] font-medium text-emerald-400/70 uppercase tracking-wider mb-2">Report Yield (Owner)</p>
          <p className="text-[10px] text-[#565a6e] mb-2">
            Simulate strategy returns. Increases share price for all depositors. 10% performance fee is deducted.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Yield amount"
              value={yieldAmount}
              onChange={(e) => setYieldAmount(e.target.value)}
              disabled={yieldState === "signing" || yieldState === "pending"}
              className="flex-1 input-glass !rounded-lg !py-2 text-xs disabled:opacity-40"
            />
            <button
              onClick={async () => {
                const num = parseFloat(yieldAmount);
                if (!num || num <= 0) return;
                resetYield();
                await reportYield(num);
                for (const delay of [3000, 8000, 15000, 30000]) {
                  setTimeout(refetchBalance, delay);
                }
              }}
              disabled={!yieldAmount || yieldState === "signing" || yieldState === "pending"}
              className="px-4 py-2 rounded-lg text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all duration-200 disabled:opacity-40"
            >
              {yieldState === "signing" || yieldState === "pending" ? "..." : "Report"}
            </button>
          </div>
          <div className="flex gap-1.5 mt-2">
            {["0.001", "0.01", "0.05", "0.1"].map((amt) => (
              <button
                key={amt}
                onClick={() => setYieldAmount(amt)}
                className="flex-1 py-1 rounded text-[10px] font-medium bg-white/[0.02] border border-white/[0.04] text-[#8b8fa3] hover:text-emerald-400 hover:border-emerald-500/20 transition-all duration-200"
              >
                {amt}
              </button>
            ))}
          </div>
          <TxStatusBadge state={yieldState} txId={yieldTxId} />
          {yieldError && <p className="text-[10px] text-red-400 mt-1 text-center">{yieldError}</p>}
        </div>
      )}

      {/* Asset selector */}
      <div className="flex gap-2 mb-4">
        {ASSETS.map((a) => (
          <button
            key={a}
            onClick={() => setAsset(a)}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-[13px] font-medium border transition-all duration-200",
              asset === a
                ? "bg-blue-600/10 border-blue-600/20 text-blue-400 glow-navy-subtle"
                : "bg-white/[0.02] border-white/[0.04] text-[#8b8fa3] hover:text-white hover:border-white/[0.08]"
            )}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="relative mb-4">
        <input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending}
          className="w-full input-glass !rounded-xl !py-3.5 !pr-16 text-lg font-medium disabled:opacity-40"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-[#565a6e]">
          {asset}
        </span>
      </div>

      {/* Quick amounts */}
      <div className="flex gap-2 mb-5">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            onClick={() => setAmount(amt)}
            disabled={isPending}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-white/[0.02] border border-white/[0.04] text-[#8b8fa3] hover:text-white hover:border-white/[0.08] transition-all duration-200 disabled:opacity-40"
          >
            {amt}
          </button>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={handleSubmit}
        disabled={(isConnected && !amount) || isPending}
        className={cn(
          "w-full py-3.5 rounded-xl font-semibold text-[13px] transition-all duration-200",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          !isConnected || (amount && !isPending)
            ? "btn-primary !w-full"
            : "bg-white/[0.04] text-[#565a6e] border border-white/[0.04]",
          isPending && "animate-pulse"
        )}
      >
        {!isConnected
          ? "Connect Wallet"
          : isPending
            ? "Processing..."
            : `${tab === "deposit" ? "Deposit" : "Withdraw"} ${amount || "0"} ${asset}`}
      </button>

      <TxStatusBadge state={txState} txId={txId} />

      {txError && (
        <p className="text-xs text-red-400 mt-3 text-center">{txError}</p>
      )}

      {txState === "idle" && (
        <p className="text-[11px] text-[#3a3e52] mt-3 text-center">
          {tab === "deposit" ? "You'll receive cfYIELD share tokens" : "Burn cfYIELD shares to withdraw"}
        </p>
      )}
    </div>
  );
}
