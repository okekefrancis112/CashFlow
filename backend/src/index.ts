import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { config } from "./config";
import { logger } from "./lib/logger";
import routes from "./api/routes";
import userRoutes from "./api/user-routes";
import automationRoutes from "./api/automation-routes";
import { globalErrorHandler } from "./middleware/error-handler";
import { globalLimiter } from "./middleware/rate-limiter";
import { initDatabase } from "./services/database";
import { startHarvester, stopHarvester } from "./services/harvester";
import { startRebalancer, stopRebalancer } from "./services/rebalancer";
import { startMonitor, stopMonitor } from "./services/monitor";

const app = express();

// ---------- Security headers ----------
app.use(helmet());
app.disable("x-powered-by");

// ---------- Structured logging ----------
app.use(pinoHttp({ logger }));

// ---------- CORS lockdown ----------
const allowedOrigins = config.allowedOrigins;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.some((o) => origin === o || o instanceof RegExp && o.test(origin))) {
        return callback(null, true);
      }
      callback(new Error("CORS: origin not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// ---------- Global rate limiter ----------
app.use(globalLimiter);

// Mount API routes
app.use("/api", routes);
app.use("/api/user", userRoutes);
app.use("/api/automation", automationRoutes);

// Root route — no internal config disclosure
app.get("/", (_req, res) => {
  res.json({
    name: "CashFlow API",
    version: "1.0.0",
    docs: {
      public: [
        "GET /api/health",
        "GET /api/yields",
        "GET /api/vault/stats",
        "GET /api/strategy/current",
      ],
      premium: [
        "GET /api/premium/yield-forecast",
        "GET /api/premium/strategy-signals",
        "GET /api/premium/portfolio-analytics",
      ],
      automation: [
        "GET /api/automation/harvester/status",
        "GET /api/automation/harvester/history",
        "GET /api/automation/rebalancer/status",
        "GET /api/automation/rebalancer/history",
        "GET /api/automation/monitor/summary",
        "GET /api/automation/monitor/alerts",
        "GET /api/automation/history/tvl",
        "GET /api/automation/history/apy",
        "GET /api/automation/history/fees",
        "GET /api/automation/stats",
      ],
    },
  });
});

// ---------- Global error handler (MUST be after all routes) ----------
app.use(globalErrorHandler);

// ---------- Initialize services ----------
initDatabase();

const server = app.listen(config.port, () => {
  logger.info(`CashFlow API running on http://localhost:${config.port}`);
  logger.info(`Network: ${config.stacksNetwork}`);
  logger.info(`Mode: ${config.privateKey ? "production (on-chain)" : "simulation"}`);

  // Start automation services after server is ready
  startHarvester();
  startRebalancer();
  startMonitor();

  logger.info("All automation services started");
});

// ---------- Graceful shutdown ----------
function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, stopping services...");

  stopHarvester();
  stopRebalancer();
  stopMonitor();
  logger.info("Automation services stopped");

  server.close(() => {
    logger.info("All connections drained. Exiting.");
    process.exit(0);
  });

  // Force exit after 10 seconds if connections aren't drained
  setTimeout(() => {
    logger.error("Could not drain connections in time, forcing exit.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
