import { logger } from "../lib/logger";
import { callReadOnly } from "./stacks";
import { getAdapterStatuses } from "./harvester";

interface Alert {
  level: "warn" | "critical";
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

const alerts: Alert[] = [];
let monitorInterval: ReturnType<typeof setInterval> | null = null;

function addAlert(level: Alert["level"], message: string, data?: Record<string, unknown>) {
  const alert: Alert = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };

  alerts.push(alert);
  // Keep last 100 alerts
  if (alerts.length > 100) alerts.shift();

  if (level === "critical") {
    logger.error({ alert }, "CRITICAL ALERT");
  } else {
    logger.warn({ alert }, "Warning alert");
  }

  // TODO: In production, send to Discord/Telegram webhook
}

async function checkAdapterBalances() {
  const adapters = [
    { name: "Zest", contractName: "zest-adapter" },
    { name: "StackingDAO", contractName: "stackingdao-adapter" },
  ];

  for (const adapter of adapters) {
    try {
      const result = await callReadOnly(adapter.contractName, "get-balance");
      const balance = parseInt(result?.value ?? "0", 10);
      logger.debug({ adapter: adapter.name, balance }, "Adapter balance check");
    } catch (error) {
      addAlert("warn", `Failed to read ${adapter.name} adapter balance`, {
        adapter: adapter.name,
        error: String(error),
      });
    }
  }
}

async function checkSharePrice() {
  try {
    const result = await callReadOnly("vault-core-v2", "get-share-price");
    const sharePrice = parseInt(result?.value ?? "1000000", 10);

    // Alert if share price drops more than 5% below 1:1 (950000)
    if (sharePrice < 950000) {
      addAlert("critical", "Share price dropped more than 5% below par", {
        sharePrice,
        parPrice: 1000000,
        dropPercent: ((1000000 - sharePrice) / 1000000) * 100,
      });
    }

    // Alert if share price increases more than 50% above par (suspicious)
    if (sharePrice > 1500000) {
      addAlert("warn", "Share price unusually high - possible accounting error", {
        sharePrice,
      });
    }
  } catch (error) {
    addAlert("warn", "Failed to read share price", { error: String(error) });
  }
}

function checkCircuitBreakers() {
  const statuses = getAdapterStatuses();
  for (const status of statuses) {
    if (status.paused) {
      addAlert("critical", `Adapter ${status.name} is paused due to consecutive failures`, {
        adapter: status.name,
        failures: status.consecutiveFailures,
      });
    }
  }
}

async function checkVaultPaused() {
  try {
    const result = await callReadOnly("vault-core-v2", "is-paused");
    if (result?.value === true) {
      addAlert("critical", "Vault is paused", {});
    }
  } catch {
    // Ignore - vault may not be deployed yet
  }
}

export async function runMonitorCheck() {
  logger.debug("Running monitor check");
  await Promise.allSettled([
    checkAdapterBalances(),
    checkSharePrice(),
    checkVaultPaused(),
  ]);
  checkCircuitBreakers();
}

export function startMonitor(intervalMs = 5 * 60 * 1000) {
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
}

export function stopMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info("Monitor stopped");
  }
}

export function getAlerts(limit = 20): Alert[] {
  return alerts.slice(-limit);
}

export function clearAlerts() {
  alerts.length = 0;
}
