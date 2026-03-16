import { useCallback } from "react";
import {
  uintCV,
  contractPrincipalCV,
} from "@stacks/transactions";
import { useContractCall } from "./useContractCall";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

const TOKEN_CONTRACTS: Record<string, string> = {
  sBTC: "sbtc-token",
  USDCx: "usdcx-token",
};

export function useWithdraw() {
  const { execute, txId, txState, error, reset } = useContractCall();

  const withdraw = useCallback(
    async (asset: string, amount: number) => {
      const tokenName = TOKEN_CONTRACTS[asset];
      if (!tokenName) throw new Error(`Unknown asset: ${asset}`);

      const amountMicro = Math.floor(amount * 1_000_000);

      await execute({
        contractAddress: CONTRACT_ADDRESS,
        contractName: "vault-core",
        functionName: "withdraw",
        functionArgs: [
          contractPrincipalCV(CONTRACT_ADDRESS, tokenName),
          uintCV(amountMicro),
        ],
      });
    },
    [execute]
  );

  return { withdraw, txId, txState, error, reset };
}
