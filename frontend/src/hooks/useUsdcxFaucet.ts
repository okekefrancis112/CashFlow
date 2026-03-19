import { useCallback } from "react";
import { useContractCall } from "./useContractCall";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

export function useUsdcxFaucet() {
  const { execute, txId, txState, error, reset } = useContractCall();

  const claimUsdcx = useCallback(
    async () => {
      await execute({
        contractAddress: CONTRACT_ADDRESS,
        contractName: "usdcx-token",
        functionName: "faucet",
        functionArgs: [],
      });
    },
    [execute]
  );

  return { claimUsdcx, txId, txState, error, reset };
}
