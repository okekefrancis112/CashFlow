import { Request, Response, NextFunction } from "express";
import { z } from "zod";

const riskProfileSchema = z.object({
  risk: z
    .enum(["conservative", "balanced", "aggressive"])
    .optional()
    .default("balanced"),
});

/**
 * Validates the `risk` query parameter on strategy-signals endpoint.
 * Accepts: conservative | balanced | aggressive (defaults to balanced).
 */
export function validateRiskParam(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const result = riskProfileSchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: {
        message: `Invalid risk parameter. Must be one of: conservative, balanced, aggressive`,
        code: "VALIDATION_ERROR",
        details: result.error.flatten().fieldErrors,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Attach validated value back to query
  req.query.risk = result.data.risk;
  next();
}
