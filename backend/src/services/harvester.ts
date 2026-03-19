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
import { recordHarvest, recordFee } from "./database";

interface AdapterConfig {
  name: string;
  contractName: string;
  consecutiveFailures: number;
  paused: boolean;
}

const ADAPTERS: AdapterConfig[] = Object.entries(config.contracts.adapters).map(
  ([name, contractName]) => ({
    name,
    contractName,
    consecutiveFailures: 0,
    paused: false,
  })
);

const MAX_CONSECUTIVE_FAILURES = 3;
const PERFORMANCE_FEE_BPS = 1000; // 10%
let harvestInterval: ReturnType<typeof setInterval> | null = null;

async function harvestAdapter(adapter: AdapterConfig): Promise<number> {
  if (adapter.paused) {
    logger.info({ adapter: adapter.name }, "Adapter harvesting is paused, skipping");
    return 0;
  }

  try {
    // Try on-chain harvest if private key is set and adapter contracts are deployed
    if (config.privateKey) {
      try {
        const pendingYield = await callReadOnly(adapter.contractName, "get-pending-yield");
        const yieldAmount = parseInt(pendingYield?.value ?? "0", 10);

        if (yieldAmount === 0) {
          adapter.consecutiveFailures = 0;
          return 0;
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

        adapter.consecutiveFailures = 0;
        recordHarvest(adapter.name, yieldAmount, broadcastResult.txid);
        return yieldAmount;
      } catch {
        logger.debug({ adapter: adapter.name }, "On-chain harvest unavailable");
      }
    }

    // No on-chain harvest available — nothing to harvest
    adapter.consecutiveFailures = 0;
    return 0;
  } catch (error) {
    adapter.consecutiveFailures++;
    logger.error({
      adapter: adapter.name,
      error,
      failures: adapter.consecutiveFailures,
    }, "Harvest failed");

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

export function startHarvester(intervalMs = 60 * 1000) {
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

  // Run first cycle after a short delay to let other services initialize
  setTimeout(() => {
    runHarvestCycle().catch((err) => {
      logger.error(err, "Initial harvest cycle failed");
    });
  }, 5000);
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
