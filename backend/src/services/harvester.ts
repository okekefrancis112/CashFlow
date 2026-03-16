import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
} from "@stacks/transactions";
import { config } from "../config";
import { logger } from "../lib/logger";
import { getNetwork, callReadOnly } from "./stacks";

interface AdapterConfig {
  name: string;
  contractName: string;
  consecutiveFailures: number;
  paused: boolean;
}

const ADAPTERS: AdapterConfig[] = [
  { name: "Zest", contractName: "zest-adapter", consecutiveFailures: 0, paused: false },
  { name: "StackingDAO", contractName: "stackingdao-adapter", consecutiveFailures: 0, paused: false },
];

const MAX_CONSECUTIVE_FAILURES = 3;
let harvestInterval: ReturnType<typeof setInterval> | null = null;

async function harvestAdapter(adapter: AdapterConfig): Promise<number> {
  if (adapter.paused) {
    logger.info({ adapter: adapter.name }, "Adapter harvesting is paused, skipping");
    return 0;
  }

  try {
    // Check pending yield before harvesting
    const pendingYield = await callReadOnly(adapter.contractName, "get-pending-yield");
    const yieldAmount = parseInt(pendingYield?.value ?? "0", 10);

    if (yieldAmount === 0) {
      logger.debug({ adapter: adapter.name }, "No pending yield to harvest");
      adapter.consecutiveFailures = 0;
      return 0;
    }

    // Execute harvest on-chain
    if (!config.privateKey) {
      logger.warn({ adapter: adapter.name, yield: yieldAmount },
        "No private key configured, skipping on-chain harvest");
      return yieldAmount;
    }

    const harvestTx = await makeContractCall({
      contractAddress: config.walletAddress,
      contractName: adapter.contractName,
      functionName: "harvest",
      functionArgs: [],
      senderKey: config.privateKey,
      network: getNetwork(),
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    });

    const broadcastResult = await broadcastTransaction(harvestTx, getNetwork());

    if ("error" in broadcastResult) {
      throw new Error(`Broadcast failed: ${broadcastResult.error}`);
    }

    logger.info({
      adapter: adapter.name,
      yield: yieldAmount,
      txId: broadcastResult.txid,
    }, "Harvest submitted");

    // Report yield to vault-core-v2
    const reportTx = await makeContractCall({
      contractAddress: config.walletAddress,
      contractName: "vault-core-v2",
      functionName: "report-yield",
      functionArgs: [uintCV(yieldAmount)],
      senderKey: config.privateKey,
      network: getNetwork(),
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    });

    const reportResult = await broadcastTransaction(reportTx, getNetwork());

    if ("error" in reportResult) {
      logger.warn({ adapter: adapter.name, error: reportResult.error },
        "Yield report broadcast failed (harvest succeeded)");
    } else {
      logger.info({
        adapter: adapter.name,
        yield: yieldAmount,
        reportTxId: reportResult.txid,
      }, "Yield reported to vault");
    }

    adapter.consecutiveFailures = 0;
    return yieldAmount;
  } catch (error) {
    adapter.consecutiveFailures++;
    logger.error({
      adapter: adapter.name,
      error,
      failures: adapter.consecutiveFailures,
    }, "Harvest failed");

    // Circuit breaker: pause after MAX_CONSECUTIVE_FAILURES
    if (adapter.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      adapter.paused = true;
      logger.error({
        adapter: adapter.name,
        failures: adapter.consecutiveFailures,
      }, "CIRCUIT BREAKER: Adapter harvesting paused after consecutive failures");
    }

    return 0;
  }
}

export async function runHarvestCycle(): Promise<{ totalYield: number; results: Record<string, number> }> {
  logger.info("Starting harvest cycle");
  const results: Record<string, number> = {};
  let totalYield = 0;

  for (const adapter of ADAPTERS) {
    const yieldAmount = await harvestAdapter(adapter);
    results[adapter.name] = yieldAmount;
    totalYield += yieldAmount;
  }

  logger.info({ totalYield, results }, "Harvest cycle complete");
  return { totalYield, results };
}

export function startHarvester(intervalMs = 24 * 60 * 60 * 1000) {
  if (harvestInterval) {
    logger.warn("Harvester already running");
    return;
  }

  logger.info({ intervalMs }, "Starting harvester");
  harvestInterval = setInterval(() => {
    runHarvestCycle().catch((err) => {
      logger.error(err, "Harvest cycle failed unexpectedly");
    });
  }, intervalMs);

  // Run immediately on start
  runHarvestCycle().catch((err) => {
    logger.error(err, "Initial harvest cycle failed");
  });
}

export function stopHarvester() {
  if (harvestInterval) {
    clearInterval(harvestInterval);
    harvestInterval = null;
    logger.info("Harvester stopped");
  }
}

export function getAdapterStatuses() {
  return ADAPTERS.map((a) => ({
    name: a.name,
    contractName: a.contractName,
    consecutiveFailures: a.consecutiveFailures,
    paused: a.paused,
  }));
}

export function resumeAdapter(name: string) {
  const adapter = ADAPTERS.find((a) => a.name === name);
  if (adapter) {
    adapter.paused = false;
    adapter.consecutiveFailures = 0;
    logger.info({ adapter: name }, "Adapter resumed");
    return true;
  }
  return false;
}
