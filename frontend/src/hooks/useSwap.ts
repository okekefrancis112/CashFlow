import { useCallback } from "react";
import { uintCV } from "@stacks/transactions";
import { useContractCall } from "./useContractCall";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

export function useSwap() {
  const { execute, txId, txState, error, reset } = useContractCall();

  const swap = useCallback(
    async (stxAmount: number) => {
      const amountMicro = Math.floor(stxAmount * 1_000_000); // STX has 6 decimals

      await execute({
        contractAddress: CONTRACT_ADDRESS,
        contractName: "sbtc-swap",
        functionName: "swap",
        functionArgs: [uintCV(amountMicro)],
      });
    },
    [execute]
  );

  return { swap, txId, txState, error, reset };
}
