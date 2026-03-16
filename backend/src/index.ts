import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { config } from "./config";
import { logger } from "./lib/logger";
import routes from "./api/routes";
import userRoutes from "./api/user-routes";
import { globalErrorHandler } from "./middleware/error-handler";
import { globalLimiter } from "./middleware/rate-limiter";

const app = express();

// ---------- Structured logging ----------
app.use(pinoHttp({ logger }));

// ---------- CORS lockdown ----------
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
app.use(express.json());

// ---------- Global rate limiter ----------
app.use(globalLimiter);

// Mount API routes
app.use("/api", routes);
app.use("/api/user", userRoutes);

// Root route
app.get("/", (_req, res) => {
  res.json({
    name: "CashFlow API",
    description: "AI-powered sBTC yield aggregator with x402 payment integration",
    version: "1.0.0",
    docs: {
      public: [
        "GET /api/health",
        "GET /api/yields",
        "GET /api/vault/stats",
        "GET /api/strategy/current",
        "GET /api/user/:address/deposits",
        "GET /api/user/:address/shares",
      ],
      premium: [
        "GET /api/premium/yield-forecast (0.1 STX via x402)",
        "GET /api/premium/strategy-signals (0.15 STX via x402)",
        "GET /api/premium/portfolio-analytics (0.2 STX via x402)",
      ],
    },
    network: config.stacksNetwork,
  });
});

// ---------- Global error handler (MUST be after all routes) ----------
app.use(globalErrorHandler);

const server = app.listen(config.port, () => {
  logger.info(`CashFlow API running on http://localhost:${config.port}`);
  logger.info(`Network: ${config.stacksNetwork}`);
  logger.info(`x402 Facilitator: ${config.x402FacilitatorUrl}`);
});

// ---------- Graceful shutdown ----------
function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, draining connections...");
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
