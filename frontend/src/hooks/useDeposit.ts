import { useCallback } from "react";
import { uintCV, contractPrincipalCV } from "@stacks/transactions";
import { useContractCall } from "./useContractCall";
import type { FungiblePostCondition } from "@stacks/transactions";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

const TOKEN_CONTRACTS: Record<string, { name: string; asset: string }> = {
  sBTC: { name: "sbtc-token", asset: "sbtc" },
  USDCx: { name: "usdcx-token", asset: "usdcx" },
};

export function useDeposit() {
  const { execute, txId, txState, error, reset } = useContractCall();

  const deposit = useCallback(
    async (asset: string, amount: number, userAddress: string) => {
      const tokenInfo = TOKEN_CONTRACTS[asset];
      if (!tokenInfo) throw new Error(`Unknown asset: ${asset}`);

      const amountMicro = Math.floor(amount * 1_000_000); // 6 decimals

      const postConditions: FungiblePostCondition[] = [
        {
          type: "ft-postcondition",
          address: userAddress,
          condition: "lte",
          asset: `${CONTRACT_ADDRESS}.${tokenInfo.name}::${tokenInfo.asset}`,
          amount: amountMicro,
        },
      ];

      await execute({
        contractAddress: CONTRACT_ADDRESS,
        contractName: "vault-core",
        functionName: "deposit",
        functionArgs: [
          contractPrincipalCV(CONTRACT_ADDRESS, tokenInfo.name),
          uintCV(amountMicro),
        ],
        postConditions,
      });
    },
    [execute]
  );

  return { deposit, txId, txState, error, reset };
}
