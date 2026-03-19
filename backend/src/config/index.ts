import dotenv from "dotenv";
import { logger } from "../lib/logger";
dotenv.config();

// ---------------------------------------------------------------------------
// Validate required env vars on startup
// ---------------------------------------------------------------------------
const required: string[] = [
  "STACKS_NETWORK",
  "WALLET_ADDRESS",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}`
  );
}

if (!process.env.GROQ_API_KEY && !process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY) {
  logger.warn(
    "No AI API key set (GROQ_API_KEY, XAI_API_KEY, or OPENAI_API_KEY). AI yield optimization will use deterministic fallback."
  );
}

// ---------------------------------------------------------------------------
// Exported config
// ---------------------------------------------------------------------------
export const config = {
  stacksNetwork: process.env.STACKS_NETWORK || "testnet",
  walletAddress:
    process.env.WALLET_ADDRESS ||
    "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  privateKey: process.env.PRIVATE_KEY || "",
  // AI provider priority: Groq > xAI Grok > OpenAI
  aiApiKey: process.env.GROQ_API_KEY || process.env.XAI_API_KEY || process.env.OPENAI_API_KEY || "",
  aiBaseUrl: process.env.GROQ_API_KEY
    ? "https://api.groq.com/openai/v1"
    : process.env.XAI_API_KEY
      ? "https://api.x.ai/v1"
      : "https://api.openai.com/v1",
  aiModel: process.env.GROQ_API_KEY
    ? "llama-3.3-70b-versatile"
    : process.env.XAI_API_KEY
      ? "grok-3-mini"
      : "gpt-4o-mini",
  x402FacilitatorUrl:
    process.env.X402_FACILITATOR_URL || "https://x402.aibtc.dev",
  paymentAddress:
    process.env.PAYMENT_ADDRESS ||
    "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // CORS: comma-separated origins or defaults to localhost
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ([/^http:\/\/localhost:\d+$/] as (string | RegExp)[]),

  // Contract addresses (update after deployment)
  contracts: {
    vaultCore: "vault-core",
    strategyRouter: "strategy-router",
    yieldToken: "yield-token",
    feeCollector: "fee-collector",
    adapters: {
      Zest: "zest-adapter",
      StackingDAO: "stackingdao-adapter",
      Bitflow: "bitflow-adapter",
      Hermetica: "hermetica-adapter",
    },
  },
};
