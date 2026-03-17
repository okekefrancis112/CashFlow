import rateLimit from "express-rate-limit";

function rateLimitMessage(msg: string) {
  return () => ({
    success: false,
    error: { message: msg, code: 429 },
    timestamp: new Date().toISOString(),
  });
}

/** Global: 500 requests per 15 minutes */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage("Too many requests, please try again later."),
});

/** Premium endpoints: 10 requests per minute */
export const premiumLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage("Premium rate limit exceeded, please try again later."),
});

/** AI endpoints: 5 requests per minute */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage("AI rate limit exceeded, please try again later."),
});
