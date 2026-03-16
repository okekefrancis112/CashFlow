import { Router, Request, Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { getUserDeposit, getUserShares, getSharePrice } from "../services/stacks";
import { config } from "../config";

const router = Router();

const TOKEN_CONTRACTS: Record<string, string> = {
  sBTC: "sbtc-token",
  USDCx: "usdcx-token",
};

function fullTokenPrincipal(tokenName: string): string {
  return `${config.walletAddress}.${tokenName}`;
}

// GET /user/:address/deposits
router.get("/:address/deposits", async (req: Request, res: Response) => {
  const { address } = req.params;

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
    res.status(500).json(errorResponse("Failed to fetch user deposits", 500));
  }
});

// GET /user/:address/shares
router.get("/:address/shares", async (req: Request, res: Response) => {
  const { address } = req.params;

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
    res.status(500).json(errorResponse("Failed to fetch user shares", 500));
  }
});

export default router;
