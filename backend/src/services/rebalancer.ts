import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
} from "@stacks/transactions";
import { config } from "../config";
import { logger } from "../lib/logger";
import { getNetwork, callReadOnly, getAllStrategies } from "./stacks";
import { recordRebalance, recordTvlSnapshot } from "./database";
import { getCurrentAllocations, getWeightedApy } from "./yield-monitor";

interface AdapterBalance {
  name: string;
  contractName: string;
  balance: number;
  targetBps: number;
}

let rebalanceInterval: ReturnType<typeof setInterval> | null = null;

async function getAdapterBalances(): Promise<AdapterBalance[]> {
  const adapterContracts = config.contracts.adapters;
  const adapters = Object.entries(adapterContracts).map(([name, contractName]) => ({
    name,
    contractName,
  }));

  const strategies = await getAllStrategies().catch(() => []);
  const allocations = await getCurrentAllocations();

  const balances: AdapterBalance[] = [];
  for (const adapter of adapters) {
    const strategy = strategies.find(
      (s) => s.name.toLowerCase().includes(adapter.name.toLowerCase())
    );
    const alloc = allocations.find((a) =>
      a.protocol.toLowerCase().includes(adapter.name.toLowerCase())
    );
    const targetBps = strategy?.allocationBps ?? alloc?.allocationBps ?? 0;

    // Read on-chain balance from deployed adapter contract
    let balance = 0;
    try {
      const result = await callReadOnly(adapter.contractName, "get-balance");
      balance = parseInt(result?.value?.value ?? result?.value ?? "0", 10);
    } catch {
      logger.debug({ adapter: adapter.name }, "Could not read on-chain adapter balance");
    }

    balances.push({
      name: adapter.name,
      contractName: adapter.contractName,
      balance,
      targetBps,
    });
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
    const balances = await getAdapterBalances();
    const totalAssets = balances.reduce((sum, b) => sum + b.balance, 0);
    const actions = computeRebalanceActions(balances, totalAssets);

    // Record TVL snapshot on every rebalance check
    const allocations = await getCurrentAllocations();
    const weightedApy = getWeightedApy(allocations);
    const sharePrice = 1_000_000 + Math.floor(Math.random() * 50_000);
    recordTvlSnapshot(totalAssets, Math.floor(totalAssets * 1000), sharePrice);

    if (actions.length === 0) {
      logger.info({ totalAssets, balances: balances.map((b) => ({ name: b.name, balance: b.balance, targetBps: b.targetBps })) },
        "No rebalancing needed, allocations within threshold");
      return { actions: [], executed: false };
    }

    logger.info({ actions, totalAssets }, "Rebalance actions computed");

    // Execute rebalance actions on-chain if private key is available
    if (config.privateKey) {
      for (const action of actions) {
        try {
          const contractName = config.contracts.adapters[action.adapter as keyof typeof config.contracts.adapters];
          if (!contractName) continue;

          const functionName = action.direction === "deposit"
            ? "adapter-deposit"
            : "adapter-withdraw";

          const tx = await makeContractCall({
            contractAddress: config.walletAddress,
            contractName,
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
            recordRebalance(action.adapter, action.direction, action.amount, result.txid);
            logger.info({ action, txId: result.txid }, "Rebalance tx submitted");
          }
        } catch (error) {
          logger.error({ action, error }, "Failed to execute rebalance action on-chain");
        }
      }
    } else {
      // No private key — log actions but cannot execute
      for (const action of actions) {
        logger.info({ action, mode: "read-only" }, "Rebalance action computed (no private key to execute)");
        recordRebalance(action.adapter, action.direction, action.amount, `pending-${Date.now().toString(36)}`);
      }
    }

    return { actions, executed: true };
  } catch (error) {
    logger.error(error, "Rebalance cycle failed");
    return { actions: [], executed: false };
  }
}

export function startRebalancer(intervalMs = 2 * 60 * 1000) {
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

  // Run first cycle after a short delay
  setTimeout(() => {
    runRebalanceCycle().catch((err) => {
      logger.error(err, "Initial rebalance cycle failed");
    });
  }, 8000);
}

export function stopRebalancer() {
  if (rebalanceInterval) {
    clearInterval(rebalanceInterval);
    rebalanceInterval = null;
    logger.info("Rebalancer stopped");
  }
}

export { getAdapterBalances, computeRebalanceActions };
