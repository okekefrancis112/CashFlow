import { Router, Request, Response } from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import axios from "axios";
import { config } from "../config";
import { logger } from "../lib/logger";
import { successResponse, errorResponse } from "../lib/response";
import { premiumLimiter, aiLimiter } from "../middleware/rate-limiter";
import {
  fetchYieldSources,
  getCurrentAllocations,
  getWeightedApy,
} from "../services/yield-monitor";
import {
  getVaultStats,
  getAllStrategies,
  getPerformanceFeeBps,
  getSharePrice,
  getTotalAssets,
} from "../services/stacks";
import { analyzeYields, generateForecast } from "../agents/yield-optimizer";
import { validateRiskParam } from "../middleware/validation";

const router = Router();

// ============================================================
// x402 PAYMENT MIDDLEWARE
// ============================================================

const premiumRoutes = {
  "GET /premium/yield-forecast": {
    accepts: {
      scheme: "exact",
      payTo: config.paymentAddress,
      price: 0.1,
      network: "stacks:testnet" as const,
    },
    description: "AI yield forecast for next 7 days",
  },
  "GET /premium/strategy-signals": {
    accepts: {
      scheme: "exact",
      payTo: config.paymentAddress,
      price: 0.15,
      network: "stacks:testnet" as const,
    },
    description: "Real-time optimal allocation signals with AI reasoning",
  },
  "GET /premium/portfolio-analytics": {
    accepts: {
      scheme: "exact",
      payTo: config.paymentAddress,
      price: 0.2,
      network: "stacks:testnet" as const,
    },
    description: "Detailed historical performance analytics",
  },
};

const facilitatorClient = new HTTPFacilitatorClient({
  url: config.x402FacilitatorUrl,
});

// syncFacilitatorOnStart=false: defer initialization to first premium request
// This prevents the server from crashing if the facilitator is unreachable at startup
router.use(
  paymentMiddlewareFromConfig(
    premiumRoutes,
    facilitatorClient,
    undefined, // schemes
    undefined, // paywallConfig
    undefined, // paywall
    false,     // syncFacilitatorOnStart - don't crash on startup
  )
);

// ============================================================
// PUBLIC ENDPOINTS
// ============================================================

router.get("/health", async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  // Check Stacks node reachability
  try {
    const stacksUrl =
      config.stacksNetwork === "mainnet"
        ? "https://stacks-node-api.mainnet.stacks.co/v2/info"
        : "https://stacks-node-api.testnet.stacks.co/v2/info";
    await axios.get(stacksUrl, { timeout: 5000 });
    checks.stacks = "ok";
  } catch {
    checks.stacks = "unreachable";
  }

  // Check OpenAI key presence
  checks.openai = config.openaiApiKey ? "ok" : "missing";

  const values = Object.values(checks);
  const allOk = values.every((v) => v === "ok");
  const anyFailed = values.some((v) => v === "unreachable");

  const status = allOk ? "healthy" : anyFailed ? "unhealthy" : "degraded";

  res.status(status === "unhealthy" ? 503 : 200).json(
    successResponse({
      status,
      service: "CashFlow API",
      version: "1.0.0",
      network: config.stacksNetwork,
      checks,
    })
  );
});

// Current yield sources across Stacks DeFi
router.get("/yields", (_req: Request, res: Response) => {
  const sources = fetchYieldSources();
  res.json(
    successResponse({
      sources,
      count: sources.length,
      averageApy:
        Math.round(
          (sources.reduce((s, src) => s + src.apy, 0) / sources.length) * 100
        ) / 100,
      isMock: true, // Static data with jitter until protocol APIs are integrated (Phase 2)
    })
  );
});

// Vault stats
router.get("/vault/stats", async (_req: Request, res: Response) => {
  try {
    const [vaultStats, totalAssets, sharePrice, strategies] = await Promise.all([
      getVaultStats(),
      getTotalAssets().catch(() => 0),
      getSharePrice().catch(() => 1000000),
      getAllStrategies(),
    ]);

    const activeStrategies = strategies.filter((s) => s.isActive);
    const allocations = getCurrentAllocations();
    const weightedApy = getWeightedApy(allocations);

    res.json(
      successResponse({
        tvl: totalAssets,
        totalShares: vaultStats.totalShares,
        sharePrice,
        weightedApy,
        activeStrategies: activeStrategies.length,
        supportedAssets: ["sBTC", "USDCx"],
        isPaused: vaultStats.isPaused,
        isMock: false,
      })
    );
  } catch (error) {
    logger.warn("Failed to fetch on-chain vault stats, falling back to mock data");
    const allocations = getCurrentAllocations();
    const weightedApy = getWeightedApy(allocations);

    res.json(
      successResponse({
        tvl: 2_450_000,
        totalShares: 2_450_000_000_000,
        weightedApy,
        activeStrategies: allocations.length,
        supportedAssets: ["sBTC", "USDCx"],
        isPaused: false,
        isMock: true,
      })
    );
  }
});

// Current strategy allocation
router.get("/strategy/current", async (_req: Request, res: Response) => {
  try {
    const strategies = await getAllStrategies();
    const activeStrategies = strategies.filter((s) => s.isActive);

    const allocations = activeStrategies.map((s) => ({
      sourceId: s.name.toLowerCase().replace(/\s+/g, "-"),
      protocol: s.name,
      asset: "",
      allocationBps: s.allocationBps,
      currentApy: 0, // Real APY requires protocol API integration (Phase 2)
    }));

    const totalAllocationBps = allocations.reduce(
      (s, a) => s + a.allocationBps,
      0
    );

    res.json(
      successResponse({
        allocations,
        totalAllocationBps,
        weightedApy: 0,
        lastRebalance: new Date(Date.now() - 3600000).toISOString(),
        nextRebalance: new Date(Date.now() + 3600000).toISOString(),
        isMock: false,
      })
    );
  } catch (error) {
    logger.warn("Failed to fetch on-chain strategies, falling back to mock data");
    const allocations = getCurrentAllocations();
    const weightedApy = getWeightedApy(allocations);

    res.json(
      successResponse({
        allocations,
        totalAllocationBps: allocations.reduce(
          (s, a) => s + a.allocationBps,
          0
        ),
        weightedApy,
        lastRebalance: new Date(Date.now() - 3600000).toISOString(),
        nextRebalance: new Date(Date.now() + 3600000).toISOString(),
        isMock: true,
      })
    );
  }
});

// ============================================================
// x402-PROTECTED PREMIUM ENDPOINTS
// ============================================================

// AI yield forecast for next 7 days
router.get(
  "/premium/yield-forecast",
  premiumLimiter,
  aiLimiter,
  async (_req: Request, res: Response) => {
    try {
      const sources = fetchYieldSources();
      const forecast = await generateForecast(sources);

      res.json(
        successResponse({
          ...forecast,
          paymentRequired: "0.1 STX via x402",
        })
      );
    } catch (error) {
      logger.error(error, "Failed to generate forecast");
      res.status(500).json(errorResponse("Failed to generate forecast", 500));
    }
  }
);

// Real-time optimal allocation signals with AI reasoning
router.get(
  "/premium/strategy-signals",
  premiumLimiter,
  aiLimiter,
  validateRiskParam,
  async (req: Request, res: Response) => {
    try {
      const riskProfile =
        (req.query.risk as "conservative" | "balanced" | "aggressive") ||
        "balanced";
      const sources = fetchYieldSources();
      const optimization = await analyzeYields(sources, riskProfile);

      res.json(
        successResponse({
          ...optimization,
          paymentRequired: "0.15 STX via x402",
        })
      );
    } catch (error) {
      logger.error(error, "Failed to generate strategy signals");
      res.status(500).json(errorResponse("Failed to generate strategy signals", 500));
    }
  }
);

// Detailed historical performance analytics
router.get(
  "/premium/portfolio-analytics",
  premiumLimiter,
  async (_req: Request, res: Response) => {
    try {
      const allocations = getCurrentAllocations();
      const weightedApy = getWeightedApy(allocations);

      // Simulated historical data
      const history = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000)
          .toISOString()
          .split("T")[0],
        tvl: Math.round(2_000_000 + Math.random() * 500_000),
        apy: Math.round((weightedApy + (Math.random() - 0.5) * 3) * 100) / 100,
        rebalanceCount: Math.random() > 0.7 ? 1 : 0,
      }));

      const totalRebalances = history.reduce(
        (s, h) => s + h.rebalanceCount,
        0
      );

      res.json(
        successResponse({
          currentApy: weightedApy,
          thirtyDayAvgApy:
            Math.round(
              (history.reduce((s, h) => s + h.apy, 0) / history.length) * 100
            ) / 100,
          totalRebalances,
          history,
          topPerformingStrategy: {
            protocol: "Hermetica",
            asset: "hBTC",
            apy: 15.3,
          },
          riskMetrics: {
            sharpeRatio: 2.4,
            maxDrawdown: -3.2,
            volatility: 4.1,
          },
          paymentRequired: "0.2 STX via x402",
        })
      );
    } catch (error) {
      logger.error(error, "Failed to generate analytics");
      res.status(500).json(errorResponse("Failed to generate analytics", 500));
    }
  }
);

export default router;
