import { Router, Request, Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { getUserDeposit, getUserShares, getSharePrice, getTokenBalance } from "../services/stacks";
import { config } from "../config";
import { logger } from "../lib/logger";

const router = Router();

const TOKEN_CONTRACTS: Record<string, string> = {
  sBTC: "sbtc-token",
  USDCx: "usdcx-token",
};

// Validate Stacks address format (ST for testnet, SP for mainnet)
const STACKS_ADDRESS_RE = /^S[PT][A-Z0-9]{38,128}$/;

function fullTokenPrincipal(tokenName: string): string {
  return `${config.walletAddress}.${tokenName}`;
}

// GET /user/:address/deposits
router.get("/:address/deposits", async (req: Request, res: Response) => {
  const { address } = req.params;

  if (!STACKS_ADDRESS_RE.test(address)) {
    res.status(400).json(errorResponse("Invalid Stacks address format", 400));
    return;
  }

  try {
    const deposits: Record<string, number> = {};

    for (const [asset, contractName] of Object.entries(TOKEN_CONTRACTS)) {
      const result = await getUserDeposit(
        address,
        fullTokenPrincipal(contractName)
      );
      // cvToJSON returns { success: true, value: { type: "uint", value: "N" } }
      const raw = result?.value?.value ?? result?.value ?? 0;
      deposits[asset] = Number(raw);
    }

    res.json(successResponse({ address, deposits }));
  } catch (error) {
    logger.error(error, "Failed to fetch user deposits");
    res.status(500).json(errorResponse("Failed to fetch user deposits", 500));
  }
});

// GET /user/:address/shares
router.get("/:address/shares", async (req: Request, res: Response) => {
  const { address } = req.params;

  if (!STACKS_ADDRESS_RE.test(address)) {
    res.status(400).json(errorResponse("Invalid Stacks address format", 400));
    return;
  }

  try {
    const [result, sharePrice] = await Promise.all([
      getUserShares(address),
      getSharePrice().catch(() => 1000000), // fallback to 1.0 if contract doesn't have get-share-price
    ]);
    const raw = result?.value?.value ?? result?.value ?? 0;
    const shares = Number(raw);
    // sharePrice is in PRECISION units (1000000 = 1.0)
    // value = shares * sharePrice / PRECISION
    const value = Math.floor((shares * sharePrice) / 1000000);
    res.json(successResponse({ address, shares, sharePrice, value }));
  } catch (error) {
    logger.error(error, "Failed to fetch user shares");
    res.status(500).json(errorResponse("Failed to fetch user shares", 500));
  }
});

// GET /user/:address/wallet
router.get("/:address/wallet", async (req: Request, res: Response) => {
  const { address } = req.params;

  if (!STACKS_ADDRESS_RE.test(address)) {
    res.status(400).json(errorResponse("Invalid Stacks address format", 400));
    return;
  }

  try {
    const balances: Record<string, number> = {};

    for (const [asset, contractName] of Object.entries(TOKEN_CONTRACTS)) {
      balances[asset] = await getTokenBalance(contractName, address);
    }

    res.json(successResponse({ address, balances }));
  } catch (error) {
    logger.error(error, "Failed to fetch wallet balances");
    res.status(500).json(errorResponse("Failed to fetch wallet balances", 500));
  }
});

export default router;
