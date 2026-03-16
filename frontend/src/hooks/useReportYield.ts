import { useCallback } from "react";
import { uintCV } from "@stacks/transactions";
import { useContractCall } from "./useContractCall";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

export function useReportYield() {
  const { execute, txId, txState, error, reset } = useContractCall();

  const reportYield = useCallback(
    async (amount: number) => {
      const amountMicro = Math.floor(amount * 1_000_000);

      await execute({
        contractAddress: CONTRACT_ADDRESS,
        contractName: "vault-core",
        functionName: "report-yield",
        functionArgs: [uintCV(amountMicro)],
      });
    },
    [execute]
  );

  return { reportYield, txId, txState, error, reset };
}
