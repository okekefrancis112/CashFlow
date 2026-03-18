import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

const DB_DIR = process.env.DB_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "cashflow.json");

interface DbSchema {
  tvlSnapshots: Array<{ timestamp: string; totalAssets: number; totalShares: number; sharePrice: number }>;
  apySnapshots: Array<{ timestamp: string; protocol: string; apy: number }>;
  harvestLogs: Array<{ timestamp: string; adapter: string; yieldAmount: number; txId?: string }>;
  rebalanceLogs: Array<{ timestamp: string; adapter: string; direction: string; amount: number; txId?: string }>;
  feeLogs: Array<{ timestamp: string; feeAmount: number; yieldAmount: number }>;
}

function emptyDb(): DbSchema {
  return {
    tvlSnapshots: [],
    apySnapshots: [],
    harvestLogs: [],
    rebalanceLogs: [],
    feeLogs: [],
  };
}

let db: DbSchema | null = null;

function loadDb(): DbSchema {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      logger.info({ path: DB_FILE }, "Database loaded");
    } catch {
      logger.warn("Failed to parse database file, starting fresh");
      db = emptyDb();
    }
  } else {
    db = emptyDb();
    logger.info({ path: DB_FILE }, "Database initialized");
  }

  return db!;
}

function saveDb() {
  const data = loadDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const MAX_ENTRIES = 10000;
function trimArray<T>(arr: T[]): T[] {
  if (arr.length > MAX_ENTRIES) {
    return arr.slice(arr.length - MAX_ENTRIES);
  }
  return arr;
}

// --- Snapshot Writers ---

export function recordTvlSnapshot(totalAssets: number, totalShares: number, sharePrice: number) {
  const data = loadDb();
  data.tvlSnapshots.push({
    timestamp: new Date().toISOString(),
    totalAssets,
    totalShares,
    sharePrice,
  });
  data.tvlSnapshots = trimArray(data.tvlSnapshots);
  saveDb();
}

export function recordApySnapshot(protocol: string, apy: number) {
  const data = loadDb();
  data.apySnapshots.push({
    timestamp: new Date().toISOString(),
    protocol,
    apy,
  });
  data.apySnapshots = trimArray(data.apySnapshots);
  saveDb();
}

export function recordHarvest(adapter: string, yieldAmount: number, txId?: string) {
  const data = loadDb();
  data.harvestLogs.push({
    timestamp: new Date().toISOString(),
    adapter,
    yieldAmount,
    txId,
  });
  data.harvestLogs = trimArray(data.harvestLogs);
  saveDb();
}

export function recordRebalance(adapter: string, direction: string, amount: number, txId?: string) {
  const data = loadDb();
  data.rebalanceLogs.push({
    timestamp: new Date().toISOString(),
    adapter,
    direction,
    amount,
    txId,
  });
  data.rebalanceLogs = trimArray(data.rebalanceLogs);
  saveDb();
}

export function recordFee(feeAmount: number, yieldAmount: number) {
  const data = loadDb();
  data.feeLogs.push({
    timestamp: new Date().toISOString(),
    feeAmount,
    yieldAmount,
  });
  data.feeLogs = trimArray(data.feeLogs);
  saveDb();
}

// --- Query Functions ---

export function getTvlHistory(days = 30) {
  const data = loadDb();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return data.tvlSnapshots.filter((s) => s.timestamp >= cutoff);
}

export function getApyHistory(days = 30) {
  const data = loadDb();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return data.apySnapshots.filter((s) => s.timestamp >= cutoff);
}

export function getHarvestHistory(limit = 50) {
  const data = loadDb();
  return data.harvestLogs.slice(-limit).reverse();
}

export function getRebalanceHistory(limit = 50) {
  const data = loadDb();
  return data.rebalanceLogs.slice(-limit).reverse();
}

export function getFeeHistory(limit = 50) {
  const data = loadDb();
  return data.feeLogs.slice(-limit).reverse();
}

export function getDbStats() {
  const data = loadDb();
  return {
    tvlSnapshots: data.tvlSnapshots.length,
    apySnapshots: data.apySnapshots.length,
    harvestLogs: data.harvestLogs.length,
    rebalanceLogs: data.rebalanceLogs.length,
    feeLogs: data.feeLogs.length,
  };
}

export function initDatabase() {
  loadDb();
  logger.info("Database service initialized");
}
