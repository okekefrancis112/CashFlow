import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { config } from "./config";
import { logger } from "./lib/logger";
import routes from "./api/routes";
import userRoutes from "./api/user-routes";
import { globalErrorHandler } from "./middleware/error-handler";
import { globalLimiter } from "./middleware/rate-limiter";

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
    },
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
