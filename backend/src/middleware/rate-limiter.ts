import rateLimit from "express-rate-limit";

/** Global: 500 requests per 15 minutes */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: "Too many requests, please try again later.", code: 429 },
    timestamp: new Date().toISOString(),
  },
});

/** Premium endpoints: 10 requests per minute */
export const premiumLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: "Premium rate limit exceeded, please try again later.", code: 429 },
    timestamp: new Date().toISOString(),
  },
});

/** AI endpoints: 5 requests per minute */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: "AI rate limit exceeded, please try again later.", code: 429 },
    timestamp: new Date().toISOString(),
  },
});
