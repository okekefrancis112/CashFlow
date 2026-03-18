import { Router, Request, Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { getHarvestHistory, getRebalanceHistory, getTvlHistory, getApyHistory, getFeeHistory, getDbStats } from "../services/database";
import { getAdapterStatuses, runHarvestCycle, resumeAdapter } from "../services/harvester";
import { runRebalanceCycle, getAdapterBalances } from "../services/rebalancer";
import { getAlerts, getAlertsByCategory, getMonitorSummary, runMonitorCheck } from "../services/monitor";

const router = Router();

// ============================================================
// HARVESTER ENDPOINTS
// ============================================================

// GET /api/automation/harvester/status — adapter statuses and circuit breaker info
router.get("/harvester/status", (_req: Request, res: Response) => {
  const adapters = getAdapterStatuses();
  const activeCount = adapters.filter((a) => !a.paused).length;

  res.json(successResponse({
    adapters,
    activeCount,
    totalCount: adapters.length,
    allHealthy: activeCount === adapters.length,
  }));
});

// GET /api/automation/harvester/history — recent harvest logs
router.get("/harvester/history", (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const history = getHarvestHistory(limit);

  res.json(successResponse({
    harvests: history,
    count: history.length,
  }));
});

// POST /api/automation/harvester/run — trigger manual harvest cycle
router.post("/harvester/run", async (_req: Request, res: Response) => {
  try {
    const result = await runHarvestCycle();
    res.json(successResponse(result));
  } catch (error) {
    res.status(500).json(errorResponse("Harvest cycle failed", 500));
  }
});

// POST /api/automation/harvester/resume/:adapter — resume a paused adapter
router.post("/harvester/resume/:adapter", (req: Request, res: Response) => {
  const { adapter } = req.params;
  const resumed = resumeAdapter(adapter);

  if (resumed) {
    res.json(successResponse({ message: `Adapter ${adapter} resumed`, adapter }));
  } else {
    res.status(404).json(errorResponse(`Adapter ${adapter} not found`, 404));
  }
});

// ============================================================
// REBALANCER ENDPOINTS
// ============================================================

// GET /api/automation/rebalancer/status — current adapter balances and allocations
router.get("/rebalancer/status", async (_req: Request, res: Response) => {
  try {
    const balances = await getAdapterBalances();
    const totalAssets = balances.reduce((sum, b) => sum + b.balance, 0);

    res.json(successResponse({
      balances: balances.map((b) => ({
        ...b,
        currentPct: totalAssets > 0 ? ((b.balance / totalAssets) * 100).toFixed(2) : "0",
        targetPct: (b.targetBps / 100).toFixed(2),
      })),
      totalAssets,
    }));
  } catch (error) {
    res.status(500).json(errorResponse("Failed to fetch rebalancer status", 500));
  }
});

// GET /api/automation/rebalancer/history — recent rebalance logs
router.get("/rebalancer/history", (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const history = getRebalanceHistory(limit);

  res.json(successResponse({
    rebalances: history,
    count: history.length,
  }));
});

// POST /api/automation/rebalancer/run — trigger manual rebalance
router.post("/rebalancer/run", async (_req: Request, res: Response) => {
  try {
    const result = await runRebalanceCycle();
    res.json(successResponse(result));
  } catch (error) {
    res.status(500).json(errorResponse("Rebalance cycle failed", 500));
  }
});

// ============================================================
// MONITOR ENDPOINTS
// ============================================================

// GET /api/automation/monitor/summary — overall system health
router.get("/monitor/summary", (_req: Request, res: Response) => {
  const summary = getMonitorSummary();
  const adapters = getAdapterStatuses();

  res.json(successResponse({
    ...summary,
    adapters: {
      active: adapters.filter((a) => !a.paused).length,
      total: adapters.length,
    },
  }));
});

// GET /api/automation/monitor/alerts — recent alerts
router.get("/monitor/alerts", (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const category = req.query.category as string | undefined;

  const alertList = category
    ? getAlertsByCategory(category as "harvest" | "rebalance" | "price" | "system" | "circuit-breaker", limit)
    : getAlerts(limit);

  res.json(successResponse({
    alerts: alertList,
    count: alertList.length,
  }));
});

// POST /api/automation/monitor/check — trigger manual monitor check
router.post("/monitor/check", async (_req: Request, res: Response) => {
  try {
    await runMonitorCheck();
    const summary = getMonitorSummary();
    res.json(successResponse({ message: "Monitor check completed", ...summary }));
  } catch (error) {
    res.status(500).json(errorResponse("Monitor check failed", 500));
  }
});

// ============================================================
// HISTORICAL DATA ENDPOINTS
// ============================================================

// GET /api/automation/history/tvl — TVL snapshots over time
router.get("/history/tvl", (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 90);
  const snapshots = getTvlHistory(days);

  res.json(successResponse({
    snapshots,
    count: snapshots.length,
    period: `${days}d`,
  }));
});

// GET /api/automation/history/apy — APY snapshots over time
router.get("/history/apy", (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 90);
  const snapshots = getApyHistory(days);

  res.json(successResponse({
    snapshots,
    count: snapshots.length,
    period: `${days}d`,
  }));
});

// GET /api/automation/history/fees — fee collection history
router.get("/history/fees", (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const fees = getFeeHistory(limit);

  res.json(successResponse({
    fees,
    count: fees.length,
  }));
});

// GET /api/automation/stats — database stats
router.get("/stats", (_req: Request, res: Response) => {
  const dbStats = getDbStats();
  const summary = getMonitorSummary();
  const adapters = getAdapterStatuses();

  res.json(successResponse({
    database: dbStats,
    monitor: summary,
    harvester: {
      adapters: adapters.length,
      active: adapters.filter((a) => !a.paused).length,
      paused: adapters.filter((a) => a.paused).length,
    },
  }));
});

export default router;
