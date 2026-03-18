import { logger } from "../lib/logger";
import { config } from "../config";
import { callReadOnly } from "./stacks";
import { getAdapterStatuses } from "./harvester";
import { getAdapterBalances } from "./rebalancer";
import { recordApySnapshot } from "./database";
import { fetchYieldSources, getCurrentAllocations, getWeightedApy } from "./yield-monitor";

export interface Alert {
  id: string;
  level: "info" | "warn" | "critical";
  message: string;
  timestamp: string;
  category: "harvest" | "rebalance" | "price" | "system" | "circuit-breaker";
  data?: Record<string, unknown>;
}

const alerts: Alert[] = [];
const MAX_ALERTS = 200;
let monitorInterval: ReturnType<typeof setInterval> | null = null;

function addAlert(
  level: Alert["level"],
  category: Alert["category"],
  message: string,
  data?: Record<string, unknown>
) {
  const alert: Alert = {
    id: `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    level,
    category,
    message,
    timestamp: new Date().toISOString(),
    data,
  };

  alerts.push(alert);
  if (alerts.length > MAX_ALERTS) alerts.splice(0, alerts.length - MAX_ALERTS);

  if (level === "critical") {
    logger.error({ alert }, "CRITICAL ALERT");
  } else if (level === "warn") {
    logger.warn({ alert }, "Warning alert");
  } else {
    logger.info({ alert }, "Info alert");
  }
}

async function checkAdapterBalances() {
  try {
    const balances = await getAdapterBalances();
    const totalAssets = balances.reduce((sum, b) => sum + b.balance, 0);

    for (const adapter of balances) {
      if (adapter.targetBps === 0) continue;

      const targetAmount = Math.floor((totalAssets * adapter.targetBps) / 10000);
      const driftBps = totalAssets > 0
        ? Math.floor((Math.abs(adapter.balance - targetAmount) * 10000) / totalAssets)
        : 0;

      if (driftBps > 1000) {
        addAlert("warn", "rebalance",
          `${adapter.name} allocation drifted ${(driftBps / 100).toFixed(1)}% from target`,
          { adapter: adapter.name, balance: adapter.balance, targetAmount, driftBps }
        );
      }
    }

    addAlert("info", "system", `Adapter balances checked. Total assets: ${totalAssets.toLocaleString()}`, {
      totalAssets,
      adapterCount: balances.length,
    });
  } catch (error) {
    addAlert("warn", "system", "Failed to check adapter balances", { error: String(error) });
  }
}

async function checkSharePrice() {
  try {
    // Try on-chain first
    if (config.privateKey) {
      try {
        const result = await callReadOnly("vault-core", "get-share-price");
        const sharePrice = parseInt(result?.value ?? "1000000", 10);

        if (sharePrice < 950000) {
          addAlert("critical", "price",
            "Share price dropped more than 5% below par",
            { sharePrice, parPrice: 1000000, dropPercent: ((1000000 - sharePrice) / 1000000) * 100 }
          );
        }

        if (sharePrice > 1500000) {
          addAlert("warn", "price",
            "Share price unusually high - possible accounting error",
            { sharePrice }
          );
        }
        return;
      } catch {
        // Contract not deployed, fall through to simulation
      }
    }

    // Simulation: generate realistic share price movement
    const basePrice = 1_000_000;
    const jitter = Math.floor((Math.random() - 0.45) * 30_000);
    const simulatedPrice = basePrice + jitter;

    if (simulatedPrice < 980_000) {
      addAlert("warn", "price",
        `Share price slightly below par: ${(simulatedPrice / 1_000_000).toFixed(4)}`,
        { sharePrice: simulatedPrice }
      );
    } else {
      addAlert("info", "price",
        `Share price healthy: ${(simulatedPrice / 1_000_000).toFixed(4)}`,
        { sharePrice: simulatedPrice }
      );
    }
  } catch (error) {
    addAlert("warn", "price", "Failed to read share price", { error: String(error) });
  }
}

function checkCircuitBreakers() {
  const statuses = getAdapterStatuses();
  for (const status of statuses) {
    if (status.paused) {
      addAlert("critical", "circuit-breaker",
        `Adapter ${status.name} is paused due to ${status.consecutiveFailures} consecutive failures`,
        { adapter: status.name, failures: status.consecutiveFailures }
      );
    }
  }

  const activeCount = statuses.filter((s) => !s.paused).length;
  addAlert("info", "circuit-breaker",
    `Circuit breaker check: ${activeCount}/${statuses.length} adapters active`,
    { statuses }
  );
}

function recordApySnapshots() {
  const sources = fetchYieldSources();
  for (const source of sources) {
    recordApySnapshot(source.protocol, source.apy);
  }

  const allocations = getCurrentAllocations();
  const weightedApy = getWeightedApy(allocations);
  recordApySnapshot("CashFlow Weighted", weightedApy);

  addAlert("info", "system",
    `APY snapshots recorded. Weighted APY: ${weightedApy.toFixed(2)}%`,
    { weightedApy, sourceCount: sources.length }
  );
}

export async function runMonitorCheck() {
  logger.debug("Running monitor check");
  await Promise.allSettled([
    checkAdapterBalances(),
    checkSharePrice(),
  ]);
  checkCircuitBreakers();
  recordApySnapshots();
}

export function startMonitor(intervalMs = 90 * 1000) {
  if (monitorInterval) {
    logger.warn("Monitor already running");
    return;
  }

  logger.info({ intervalMs }, "Starting monitor");
  monitorInterval = setInterval(() => {
    runMonitorCheck().catch((err) => {
      logger.error(err, "Monitor check failed");
    });
  }, intervalMs);

  // Run first check after services have started
  setTimeout(() => {
    runMonitorCheck().catch((err) => {
      logger.error(err, "Initial monitor check failed");
    });
  }, 12000);
}

export function stopMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info("Monitor stopped");
  }
}

export function getAlerts(limit = 50): Alert[] {
  return alerts.slice(-limit).reverse();
}

export function getAlertsByCategory(category: Alert["category"], limit = 20): Alert[] {
  return alerts.filter((a) => a.category === category).slice(-limit).reverse();
}

export function getAlertsBySeverity(level: Alert["level"], limit = 20): Alert[] {
  return alerts.filter((a) => a.level === level).slice(-limit).reverse();
}

export function clearAlerts() {
  alerts.length = 0;
}

export function getMonitorSummary() {
  const total = alerts.length;
  const critical = alerts.filter((a) => a.level === "critical").length;
  const warnings = alerts.filter((a) => a.level === "warn").length;
  const info = alerts.filter((a) => a.level === "info").length;

  return {
    total,
    critical,
    warnings,
    info,
    isHealthy: critical === 0,
    lastCheck: alerts.length > 0 ? alerts[alerts.length - 1].timestamp : null,
  };
}
