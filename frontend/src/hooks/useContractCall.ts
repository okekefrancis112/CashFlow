import { useState, useCallback } from "react";
import { openContractCall } from "@stacks/connect";
import type { ClarityValue } from "@stacks/transactions";
import { PostConditionMode } from "@stacks/transactions";
import type { TransactionState } from "../types";

const STACKS_API =
  process.env.NEXT_PUBLIC_STACKS_API || "https://api.testnet.hiro.so";

interface ContractCallOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions?: any[];
  onFinish?: (txId: string) => void;
  onCancel?: () => void;
}

interface ContractCallResult {
  execute: (options: ContractCallOptions) => Promise<void>;
  txId: string | null;
  txState: TransactionState;
  error: string | null;
  reset: () => void;
}

async function pollTxStatus(txId: string): Promise<"confirmed" | "failed"> {
  const maxAttempts = 60; // ~10 minutes with 10s intervals
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    try {
      const res = await fetch(`${STACKS_API}/extended/v1/tx/${txId}`);
      const data = await res.json();
      if (data.tx_status === "success") return "confirmed";
      if (data.tx_status === "abort_by_response" || data.tx_status === "abort_by_post_condition")
        return "failed";
    } catch {
      // Network error, keep polling
    }
  }
  return "failed";
}

export function useContractCall(): ContractCallResult {
  const [txId, setTxId] = useState<string | null>(null);
  const [txState, setTxState] = useState<TransactionState>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTxId(null);
    setTxState("idle");
    setError(null);
  }, []);

  const execute = useCallback(async (options: ContractCallOptions) => {
    setTxState("signing");
    setError(null);

    try {
      await openContractCall({
        ...options,
        network: "testnet",
        postConditionMode: PostConditionMode.Allow,
        onFinish: async (data) => {
          const id = data.txId;
          setTxId(id);
          setTxState("pending");
          options.onFinish?.(id);

          const status = await pollTxStatus(id);
          setTxState(status);
          if (status === "failed") {
            setError("Transaction failed on-chain");
          }
        },
        onCancel: () => {
          setTxState("idle");
          options.onCancel?.();
        },
      });
    } catch (err: any) {
      setTxState("failed");
      setError(err?.message || "Failed to initiate transaction");
    }
  }, []);

  return { execute, txId, txState, error, reset };
}
