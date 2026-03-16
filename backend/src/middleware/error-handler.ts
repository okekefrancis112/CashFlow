import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Global error handler middleware. Must be mounted AFTER all routes.
 * Produces a standardised error shape for all unhandled errors.
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(err, "Unhandled error");

  const statusCode =
    "statusCode" in err ? (err as Error & { statusCode: number }).statusCode : 500;

  res.status(statusCode).json({
    success: false,
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
      code: "INTERNAL_ERROR",
    },
    timestamp: new Date().toISOString(),
  });
}
