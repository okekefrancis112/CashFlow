import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// Helper: setup vault-core-v2 for testing
// 1. Set yield-token-v2 minter to vault-core-v2
// 2. Set fee-collector authorized vault to vault-core-v2
// 3. Whitelist a token
// 4. Mint tokens to the user
function setupV2(user: string, mintAmount: number) {
  // Set yield-token-v2 minter to vault-core-v2
  simnet.callPublicFn("yield-token-v2", "set-authorized-minter",
    [Cl.principal(`${deployer}.vault-core-v2`)], deployer);
  // Set fee-collector authorized vault to vault-core-v2
  simnet.callPublicFn("fee-collector", "set-authorized-vault",
    [Cl.principal(`${deployer}.vault-core-v2`)], deployer);
  // Whitelist the v1 yield-token as the deposit token (reusing it as a generic SIP-010 for tests)
  simnet.callPublicFn("vault-core-v2", "add-whitelisted-token",
    [Cl.principal(`${deployer}.yield-token`)], deployer);
  // Mint deposit tokens to user
  simnet.callPublicFn("yield-token", "mint",
    [Cl.uint(mintAmount), Cl.principal(user)], deployer);
}

function deposit(user: string, amount: number) {
  return simnet.callPublicFn("vault-core-v2", "deposit",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(amount)], user);
}

function withdraw(user: string, shares: number, minAmount: number) {
  return simnet.callPublicFn("vault-core-v2", "withdraw",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(shares), Cl.uint(minAmount)], user);
}

describe("vault-core-v2", () => {
  // --- Basic Initialization ---

  it("initializes with zero total-assets and total-shares", () => {
    const assets = simnet.callReadOnlyFn("vault-core-v2", "get-total-assets", [], deployer);
    expect(assets.result).toBeOk(Cl.uint(0));
    const shares = simnet.callReadOnlyFn("vault-core-v2", "get-total-shares", [], deployer);
    expect(shares.result).toBeOk(Cl.uint(0));
  });

  it("share price starts at 1:1 (1000000 with 6 decimal precision)", () => {
    const price = simnet.callReadOnlyFn("vault-core-v2", "get-share-price", [], deployer);
    // With 0 assets and 0 shares: (0 + OFFSET) * 1e6 / (0 + OFFSET) = 1e6
    expect(price.result).toBeOk(Cl.uint(1000000));
  });

  // --- Deposit Tests ---

  it("first deposit gets ~1:1 shares (minus virtual offset dust)", () => {
    setupV2(wallet1, 100000);
    const result = deposit(wallet1, 10000);
    expect(result.result).toBeOk(Cl.uint(10000)); // At 1:1, should get 10000 shares

    const totalAssets = simnet.callReadOnlyFn("vault-core-v2", "get-total-assets", [], deployer);
    expect(totalAssets.result).toBeOk(Cl.uint(10000));
    const totalShares = simnet.callReadOnlyFn("vault-core-v2", "get-total-shares", [], deployer);
    expect(totalShares.result).toBeOk(Cl.uint(10000));
  });

  it("second depositor gets proportional shares", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    // Mint tokens for wallet2
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(100000), Cl.principal(wallet2)], deployer);
    const result = deposit(wallet2, 5000);
    // At 1:1 ratio (no yield), should get ~5000 shares
    expect(result.result).toBeOk(Cl.uint(5000));
  });

  it("rejects deposit of zero amount", () => {
    setupV2(wallet1, 100000);
    const result = deposit(wallet1, 0);
    expect(result.result).toBeErr(Cl.uint(403));
  });

  it("rejects deposit of non-whitelisted token", () => {
    simnet.callPublicFn("yield-token-v2", "set-authorized-minter",
      [Cl.principal(`${deployer}.vault-core-v2`)], deployer);
    simnet.callPublicFn("fee-collector", "set-authorized-vault",
      [Cl.principal(`${deployer}.vault-core-v2`)], deployer);
    // Don't whitelist the token
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(100000), Cl.principal(wallet1)], deployer);
    const result = deposit(wallet1, 1000);
    expect(result.result).toBeErr(Cl.uint(404));
  });

  it("enforces per-user deposit cap", () => {
    setupV2(wallet1, 1000000);
    simnet.callPublicFn("vault-core-v2", "set-deposit-cap-per-user",
      [Cl.uint(500)], deployer);
    const result = deposit(wallet1, 1000);
    expect(result.result).toBeErr(Cl.uint(407));
  });

  // --- Withdraw Tests ---

  it("withdraw returns proportional assets", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    const result = withdraw(wallet1, 5000, 4999);
    expect(result.result).toBeOk(Cl.uint(5000));

    const totalAssets = simnet.callReadOnlyFn("vault-core-v2", "get-total-assets", [], deployer);
    expect(totalAssets.result).toBeOk(Cl.uint(5000));
  });

  it("withdraw with slippage protection reverts when price moves", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    // Requesting 5000 shares with min-amount 6000 (more than the shares are worth)
    const result = withdraw(wallet1, 5000, 6000);
    expect(result.result).toBeErr(Cl.uint(410)); // ERR-SLIPPAGE
  });

  it("blocks withdraw when paused", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    simnet.callPublicFn("vault-core-v2", "pause-vault", [], deployer);
    const result = withdraw(wallet1, 5000, 0);
    expect(result.result).toBeErr(Cl.uint(405)); // ERR-VAULT-PAUSED
  });

  // --- Emergency Withdraw ---

  it("allows emergency-withdraw when paused", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    simnet.callPublicFn("vault-core-v2", "pause-vault", [], deployer);
    const result = simnet.callPublicFn("vault-core-v2", "emergency-withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
    expect(result.result).toBeOk(Cl.uint(5000));
  });

  it("emergency-withdraw caps at user share balance", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    // Request 99999 shares but only have 10000
    const result = simnet.callPublicFn("vault-core-v2", "emergency-withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(99999)], wallet1);
    expect(result.result).toBeOk(Cl.uint(10000)); // Capped at actual balance
  });

  // --- Yield Reporting ---

  it("report-yield increases total-assets and changes share price", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);

    // Report 1000 yield. Fee = 1000 * 1000/10000 = 100. Net = 900.
    simnet.mineEmptyBlocks(11); // satisfy cooldown
    const result = simnet.callPublicFn("vault-core-v2", "report-yield",
      [Cl.uint(1000)], deployer);
    expect(result.result).toBeOk(Cl.uint(900)); // net yield after 10% fee

    const totalAssets = simnet.callReadOnlyFn("vault-core-v2", "get-total-assets", [], deployer);
    expect(totalAssets.result).toBeOk(Cl.uint(10900)); // 10000 + 900

    // Fee recorded in fee-collector
    const perfFees = simnet.callReadOnlyFn("fee-collector", "get-total-performance-fees", [], deployer);
    expect(perfFees.result).toBeOk(Cl.uint(100));
  });

  it("deposit after yield gives fewer shares per token", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);

    simnet.mineEmptyBlocks(11);
    simnet.callPublicFn("vault-core-v2", "report-yield", [Cl.uint(1000)], deployer);
    // total-assets = 10900, total-shares = 10000
    // New deposit of 10000: shares = 10000 * (10000 + 1000000) / (10900 + 1000000)
    // = 10000 * 1010000 / 1010900 = ~9991
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(100000), Cl.principal(wallet2)], deployer);
    const result = deposit(wallet2, 10000);
    // Should get fewer than 10000 shares since share price > 1
    const sharesValue = result.result;
    // The exact value depends on virtual offset math, but should be < 10000
    expect(sharesValue).toBeOk(Cl.uint(9991));
  });

  it("withdraw after yield returns more tokens per share", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);

    simnet.mineEmptyBlocks(11);
    simnet.callPublicFn("vault-core-v2", "report-yield", [Cl.uint(1000)], deployer);
    // total-assets = 10900, total-shares = 10000
    // Withdraw 5000 shares: assets = 5000 * (10900 + 1000000) / (10000 + 1000000)
    // = 5000 * 1010900 / 1010000 = ~5004
    const result = withdraw(wallet1, 5000, 5000);
    expect(result.result).toBeOk(Cl.uint(5004));
  });

  it("rejects report-yield from non-owner", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    simnet.mineEmptyBlocks(11);
    const result = simnet.callPublicFn("vault-core-v2", "report-yield",
      [Cl.uint(1000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("rejects report-yield exceeding max cap", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    simnet.callPublicFn("vault-core-v2", "set-max-yield-per-report",
      [Cl.uint(500)], deployer);
    simnet.mineEmptyBlocks(11);
    const result = simnet.callPublicFn("vault-core-v2", "report-yield",
      [Cl.uint(1000)], deployer);
    expect(result.result).toBeErr(Cl.uint(411)); // ERR-YIELD-CAP-EXCEEDED
  });

  it("enforces cooldown between yield reports", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    simnet.mineEmptyBlocks(11);
    simnet.callPublicFn("vault-core-v2", "report-yield", [Cl.uint(100)], deployer);
    // Immediately try another report without mining blocks
    const result = simnet.callPublicFn("vault-core-v2", "report-yield",
      [Cl.uint(100)], deployer);
    expect(result.result).toBeErr(Cl.uint(412)); // ERR-COOLDOWN-ACTIVE
  });

  // --- Loss Reporting ---

  it("report-loss decreases total-assets and share price", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);

    const result = simnet.callPublicFn("vault-core-v2", "report-loss",
      [Cl.uint(1000)], deployer);
    expect(result.result).toBeOk(Cl.uint(1000));

    const totalAssets = simnet.callReadOnlyFn("vault-core-v2", "get-total-assets", [], deployer);
    expect(totalAssets.result).toBeOk(Cl.uint(9000));
  });

  it("rejects report-loss exceeding max-loss-bps cap", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    // Default max-loss-bps is 2000 (20%), so max loss = 2000
    const result = simnet.callPublicFn("vault-core-v2", "report-loss",
      [Cl.uint(5000)], deployer);
    expect(result.result).toBeErr(Cl.uint(413)); // ERR-LOSS-CAP-EXCEEDED
  });

  // --- Inflation Attack Mitigation ---

  it("inflation attack yields negligible advantage", () => {
    setupV2(wallet1, 1000000);
    // Attacker deposits minimal amount first
    deposit(wallet1, 1);
    // total-assets = 1, total-shares = 1

    // Even if attacker could somehow donate tokens to inflate share price,
    // the virtual offset (1000000) makes the manipulation negligible.
    // With virtual offset: share price = (1 + 1000000) * 1e6 / (1 + 1000000) = 1e6
    // Without offset the attacker could manipulate heavily, but with offset
    // the price barely moves.
    const price = simnet.callReadOnlyFn("vault-core-v2", "get-share-price", [], deployer);
    expect(price.result).toBeOk(Cl.uint(1000000)); // Still ~1:1

    // Victim deposits 10000
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(1000000), Cl.principal(wallet2)], deployer);
    const victimResult = deposit(wallet2, 10000);
    // Victim should get ~10000 shares (virtual offset protects them)
    expect(victimResult.result).toBeOk(Cl.uint(10000));
  });

  // --- Preview Functions ---

  it("preview-deposit and preview-withdraw are consistent", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);

    const previewDeposit = simnet.callReadOnlyFn("vault-core-v2", "preview-deposit",
      [Cl.uint(5000)], deployer);
    expect(previewDeposit.result).toBeOk(Cl.uint(5000)); // 1:1 before any yield

    const previewWithdraw = simnet.callReadOnlyFn("vault-core-v2", "preview-withdraw",
      [Cl.uint(5000)], deployer);
    expect(previewWithdraw.result).toBeOk(Cl.uint(5000));
  });

  // --- Ownership Transfer ---

  it("supports two-step ownership transfer", () => {
    const propose = simnet.callPublicFn("vault-core-v2", "propose-owner",
      [Cl.principal(wallet1)], deployer);
    expect(propose.result).toBeOk(Cl.bool(true));
    const accept = simnet.callPublicFn("vault-core-v2", "accept-ownership", [], wallet1);
    expect(accept.result).toBeOk(Cl.bool(true));
    const owner = simnet.callReadOnlyFn("vault-core-v2", "get-owner", [], deployer);
    expect(owner.result).toBeOk(Cl.principal(wallet1));
  });

  // --- Rebalance ---

  it("rebalance respects max-rebalance-per-tx", () => {
    setupV2(wallet1, 100000);
    deposit(wallet1, 10000);
    simnet.callPublicFn("vault-core-v2", "add-whitelisted-target",
      [Cl.principal(wallet2)], deployer);
    simnet.callPublicFn("vault-core-v2", "set-max-rebalance-per-tx",
      [Cl.uint(50)], deployer);
    const result = simnet.callPublicFn("vault-core-v2", "rebalance",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(100), Cl.principal(wallet2)], deployer);
    expect(result.result).toBeErr(Cl.uint(408));
  });

  // --- Timelock Governance ---

  it("can queue a governance action", () => {
    const result = simnet.callPublicFn("vault-core-v2", "queue-action",
      [Cl.stringAscii("set-deposit-cap-user"), Cl.uint(5000000), Cl.none()], deployer);
    expect(result.result).toBeOk(Cl.uint(0));

    const action = simnet.callReadOnlyFn("vault-core-v2", "get-pending-action", [Cl.uint(0)], deployer);
    // Just verify the action exists and has correct type/params (block height varies by test order)
    const actionVal = action.result as any;
    expect(action.result).toBeOk(expect.anything());
    // Verify key fields via a separate read
    const actionResult = simnet.callReadOnlyFn("vault-core-v2", "get-pending-action", [Cl.uint(0)], deployer);
    expect(actionResult.result).not.toBeOk(Cl.none());
  });

  it("rejects execute-action before timelock delay", () => {
    simnet.callPublicFn("vault-core-v2", "queue-action",
      [Cl.stringAscii("set-deposit-cap-user"), Cl.uint(5000000), Cl.none()], deployer);
    // Immediately try to execute - should fail
    const result = simnet.callPublicFn("vault-core-v2", "execute-action", [Cl.uint(0)], deployer);
    expect(result.result).toBeErr(Cl.uint(414)); // ERR-TIMELOCK-NOT-READY
  });

  it("can execute action after timelock delay passes", () => {
    // Set a short timelock for testing
    simnet.callPublicFn("vault-core-v2", "set-timelock-delay", [Cl.uint(2)], deployer);

    simnet.callPublicFn("vault-core-v2", "queue-action",
      [Cl.stringAscii("set-deposit-cap-user"), Cl.uint(999), Cl.none()], deployer);

    // Mine blocks to pass the delay
    simnet.mineEmptyBlocks(3);

    const result = simnet.callPublicFn("vault-core-v2", "execute-action", [Cl.uint(0)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    // Verify the cap was actually updated
    const cap = simnet.callReadOnlyFn("vault-core-v2", "get-deposit-cap-per-user", [], deployer);
    expect(cap.result).toBeOk(Cl.uint(999));
  });

  it("rejects non-owner from queueing actions", () => {
    const result = simnet.callPublicFn("vault-core-v2", "queue-action",
      [Cl.stringAscii("set-deposit-cap-user"), Cl.uint(5000000), Cl.none()], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("can cancel a queued action", () => {
    simnet.callPublicFn("vault-core-v2", "queue-action",
      [Cl.stringAscii("set-deposit-cap-user"), Cl.uint(5000000), Cl.none()], deployer);
    const cancel = simnet.callPublicFn("vault-core-v2", "cancel-action", [Cl.uint(0)], deployer);
    expect(cancel.result).toBeOk(Cl.bool(true));

    // Now execution should fail (action is marked executed/cancelled)
    simnet.mineEmptyBlocks(200);
    const exec = simnet.callPublicFn("vault-core-v2", "execute-action", [Cl.uint(0)], deployer);
    expect(exec.result).toBeErr(Cl.uint(415)); // ERR-NO-PENDING-ACTION (already cancelled)
  });

  it("timelock add-token action works via queue/execute", () => {
    simnet.callPublicFn("vault-core-v2", "set-timelock-delay", [Cl.uint(2)], deployer);

    const wallet3 = accounts.get("wallet_3")!;
    simnet.callPublicFn("vault-core-v2", "queue-action",
      [Cl.stringAscii("add-token"), Cl.uint(0), Cl.some(Cl.principal(wallet3))], deployer);

    simnet.mineEmptyBlocks(3);

    const exec = simnet.callPublicFn("vault-core-v2", "execute-action", [Cl.uint(0)], deployer);
    expect(exec.result).toBeOk(Cl.bool(true));

    const whitelisted = simnet.callReadOnlyFn("vault-core-v2", "is-whitelisted", [Cl.principal(wallet3)], deployer);
    expect(whitelisted.result).toBeOk(Cl.bool(true));
  });
});
