import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  contractPrincipalCV,
} from "@stacks/transactions";
import { config } from "../config";
import { logger } from "../lib/logger";
import { getNetwork, callReadOnly, getAllStrategies } from "./stacks";

interface AdapterBalance {
  name: string;
  contractName: string;
  balance: number;
  targetBps: number;
}

let rebalanceInterval: ReturnType<typeof setInterval> | null = null;

async function getAdapterBalances(): Promise<AdapterBalance[]> {
  const adapters = [
    { name: "Zest", contractName: "zest-adapter" },
    { name: "StackingDAO", contractName: "stackingdao-adapter" },
  ];

  const strategies = await getAllStrategies().catch(() => []);
  const balances: AdapterBalance[] = [];

  for (const adapter of adapters) {
    try {
      const result = await callReadOnly(adapter.contractName, "get-balance");
      const balance = parseInt(result?.value ?? "0", 10);
      const strategy = strategies.find(
        (s) => s.name.toLowerCase().includes(adapter.name.toLowerCase())
      );

      balances.push({
        name: adapter.name,
        contractName: adapter.contractName,
        balance,
        targetBps: strategy?.allocationBps ?? 0,
      });
    } catch (error) {
      logger.warn({ adapter: adapter.name, error }, "Failed to get adapter balance");
      balances.push({
        name: adapter.name,
        contractName: adapter.contractName,
        balance: 0,
        targetBps: 0,
      });
    }
  }

  return balances;
}

interface RebalanceAction {
  adapter: string;
  direction: "deposit" | "withdraw";
  amount: number;
}

function computeRebalanceActions(
  balances: AdapterBalance[],
  totalAssets: number,
  driftThresholdBps = 500
): RebalanceAction[] {
  if (totalAssets === 0) return [];

  const actions: RebalanceAction[] = [];

  for (const adapter of balances) {
    if (adapter.targetBps === 0) continue;

    const targetAmount = Math.floor((totalAssets * adapter.targetBps) / 10000);
    const drift = Math.abs(adapter.balance - targetAmount);
    const driftBps = Math.floor((drift * 10000) / totalAssets);

    if (driftBps > driftThresholdBps) {
      if (adapter.balance < targetAmount) {
        actions.push({
          adapter: adapter.name,
          direction: "deposit",
          amount: targetAmount - adapter.balance,
        });
      } else {
        actions.push({
          adapter: adapter.name,
          direction: "withdraw",
          amount: adapter.balance - targetAmount,
        });
      }
    }
  }

  return actions;
}

export async function runRebalanceCycle(): Promise<{
  actions: RebalanceAction[];
  executed: boolean;
}> {
  logger.info("Starting rebalance check");

  try {
    const [balances, totalAssetsResult] = await Promise.all([
      getAdapterBalances(),
      callReadOnly("vault-core-v2", "get-total-assets"),
    ]);

    const totalAssets = parseInt(totalAssetsResult?.value ?? "0", 10);
    const actions = computeRebalanceActions(balances, totalAssets);

    if (actions.length === 0) {
      logger.info("No rebalancing needed, allocations within threshold");
      return { actions: [], executed: false };
    }

    logger.info({ actions, totalAssets }, "Rebalance actions computed");

    if (!config.privateKey) {
      logger.warn("No private key configured, skipping on-chain rebalance execution");
      return { actions, executed: false };
    }

    // Execute rebalance actions
    for (const action of actions) {
      try {
        const adapterConfig = [
          { name: "Zest", contractName: "zest-adapter" },
          { name: "StackingDAO", contractName: "stackingdao-adapter" },
        ].find((a) => a.name === action.adapter);

        if (!adapterConfig) continue;

        const functionName = action.direction === "deposit"
          ? "adapter-deposit"
          : "adapter-withdraw";

        const tx = await makeContractCall({
          contractAddress: config.walletAddress,
          contractName: adapterConfig.contractName,
          functionName,
          functionArgs: [uintCV(action.amount)],
          senderKey: config.privateKey,
          network: getNetwork(),
          anchorMode: AnchorMode.Any,
          postConditionMode: PostConditionMode.Allow,
        });

        const result = await broadcastTransaction(tx, getNetwork());

        if ("error" in result) {
          logger.error({ action, error: result.error }, "Rebalance tx failed");
        } else {
          logger.info({
            action,
            txId: result.txid,
          }, "Rebalance tx submitted");
        }
      } catch (error) {
        logger.error({ action, error }, "Failed to execute rebalance action");
      }
    }

    return { actions, executed: true };
  } catch (error) {
    logger.error(error, "Rebalance cycle failed");
    return { actions: [], executed: false };
  }
}

export function startRebalancer(intervalMs = 4 * 60 * 60 * 1000) {
  if (rebalanceInterval) {
    logger.warn("Rebalancer already running");
    return;
  }

  logger.info({ intervalMs }, "Starting rebalancer");
  rebalanceInterval = setInterval(() => {
    runRebalanceCycle().catch((err) => {
      logger.error(err, "Rebalance cycle failed unexpectedly");
    });
  }, intervalMs);
}

export function stopRebalancer() {
  if (rebalanceInterval) {
    clearInterval(rebalanceInterval);
    rebalanceInterval = null;
    logger.info("Rebalancer stopped");
  }
}

export { getAdapterBalances, computeRebalanceActions };
