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

if (!process.env.OPENAI_API_KEY) {
  logger.warn(
    "OPENAI_API_KEY is not set. AI yield optimization will use deterministic fallback."
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
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  x402FacilitatorUrl:
    process.env.X402_FACILITATOR_URL || "https://x402.aibtc.dev",
  paymentAddress:
    process.env.PAYMENT_ADDRESS ||
    "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  port: parseInt(process.env.PORT || "4000", 10),

  // Contract addresses (update after deployment)
  contracts: {
    vaultCore: "vault-core",
    strategyRouter: "strategy-router",
    yieldToken: "yield-token",
    feeCollector: "fee-collector",
  },
};
