import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// Helper: full deposit setup (whitelist + mint + set-minter + deposit)
function setupDeposit(user: string, amount: number) {
  simnet.callPublicFn("vault-core", "add-whitelisted-token",
    [Cl.principal(`${deployer}.yield-token`)], deployer);
  simnet.callPublicFn("yield-token", "mint",
    [Cl.uint(amount * 10), Cl.principal(user)], deployer);
  simnet.callPublicFn("yield-token", "set-authorized-minter",
    [Cl.principal(`${deployer}.vault-core`)], deployer);
  // Also authorize vault-core as fee-collector's vault for report-yield
  simnet.callPublicFn("fee-collector", "set-authorized-vault",
    [Cl.principal(`${deployer}.vault-core`)], deployer);
  simnet.callPublicFn("vault-core", "deposit",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(amount)], user);
}

describe("vault-core", () => {
  it("initializes with correct defaults", () => {
    const totalShares = simnet.callReadOnlyFn("vault-core", "get-total-shares", [], deployer);
    expect(totalShares.result).toBeOk(Cl.uint(0));

    const totalAssets = simnet.callReadOnlyFn("vault-core", "get-total-assets", [], deployer);
    expect(totalAssets.result).toBeOk(Cl.uint(0));

    const isPaused = simnet.callReadOnlyFn("vault-core", "is-paused", [], deployer);
    expect(isPaused.result).toBeOk(Cl.bool(false));

    // Share price defaults to 1.0 (PRECISION = 1000000) when no shares
    const price = simnet.callReadOnlyFn("vault-core", "get-share-price", [], deployer);
    expect(price.result).toBeOk(Cl.uint(1000000));
  });

  it("allows owner to whitelist a token", () => {
    const result = simnet.callPublicFn("vault-core", "add-whitelisted-token",
      [Cl.principal(`${deployer}.yield-token`)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    const isWhitelisted = simnet.callReadOnlyFn("vault-core", "is-whitelisted",
      [Cl.principal(`${deployer}.yield-token`)], deployer);
    expect(isWhitelisted.result).toBeOk(Cl.bool(true));
  });

  it("rejects non-owner from whitelisting tokens", () => {
    const result = simnet.callPublicFn("vault-core", "add-whitelisted-token",
      [Cl.principal(`${deployer}.yield-token`)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("allows owner to pause and unpause vault", () => {
    const pause = simnet.callPublicFn("vault-core", "pause-vault", [], deployer);
    expect(pause.result).toBeOk(Cl.bool(true));
    const isPaused = simnet.callReadOnlyFn("vault-core", "is-paused", [], deployer);
    expect(isPaused.result).toBeOk(Cl.bool(true));
    const unpause = simnet.callPublicFn("vault-core", "unpause-vault", [], deployer);
    expect(unpause.result).toBeOk(Cl.bool(true));
    const isPaused2 = simnet.callReadOnlyFn("vault-core", "is-paused", [], deployer);
    expect(isPaused2.result).toBeOk(Cl.bool(false));
  });

  it("rejects non-owner from pausing vault", () => {
    const result = simnet.callPublicFn("vault-core", "pause-vault", [], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("returns zero for unknown user deposits", () => {
    const result = simnet.callReadOnlyFn("vault-core", "get-user-deposit",
      [Cl.principal(wallet1), Cl.principal(`${deployer}.yield-token`)], deployer);
    expect(result.result).toBeOk(Cl.uint(0));
  });

  it("returns zero for unknown user shares", () => {
    const result = simnet.callReadOnlyFn("vault-core", "get-user-shares",
      [Cl.principal(wallet1)], deployer);
    expect(result.result).toBeOk(Cl.uint(0));
  });

  // --- Dynamic Share Pricing Tests ---

  it("first deposit mints 1:1 shares", () => {
    setupDeposit(wallet1, 1000);
    const shares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
      [Cl.principal(wallet1)], deployer);
    expect(shares.result).toBeOk(Cl.uint(1000));
    const assets = simnet.callReadOnlyFn("vault-core", "get-total-assets", [], deployer);
    expect(assets.result).toBeOk(Cl.uint(1000));
  });

  it("share price increases after yield report", () => {
    setupDeposit(wallet1, 10000);

    // Report 1000 yield (10% fee default = 100 fee, 900 net)
    simnet.callPublicFn("vault-core", "report-yield",
      [Cl.uint(1000)], deployer);

    // total-assets = 10000 + 900 = 10900, total-shares = 10000
    // price = (10900 * 1000000) / 10000 = 1090000
    const price = simnet.callReadOnlyFn("vault-core", "get-share-price", [], deployer);
    expect(price.result).toBeOk(Cl.uint(1090000));
  });

  it("second depositor gets fewer shares after yield accrues", () => {
    // Setup: whitelist, mint tokens for both users, set minter, authorize fee-collector
    simnet.callPublicFn("vault-core", "add-whitelisted-token",
      [Cl.principal(`${deployer}.yield-token`)], deployer);
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(100000), Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(100000), Cl.principal(wallet2)], deployer);
    simnet.callPublicFn("yield-token", "set-authorized-minter",
      [Cl.principal(`${deployer}.vault-core`)], deployer);
    simnet.callPublicFn("fee-collector", "set-authorized-vault",
      [Cl.principal(`${deployer}.vault-core`)], deployer);

    // wallet1 deposits 10000 (first deposit, 1:1)
    simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(10000)], wallet1);

    // Report yield: 2000 gross, 10% fee = 200, net = 1800
    // total-assets = 10000 + 1800 = 11800
    simnet.callPublicFn("vault-core", "report-yield",
      [Cl.uint(2000)], deployer);

    // wallet2 deposits 11800 tokens
    const dep2 = simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(11800)], wallet2);
    // shares = (11800 * 10000) / 11800 = 10000
    expect(dep2.result).toBeOk(Cl.uint(10000));

    // Both users now have 10000 shares each, total = 20000
    const totalShares = simnet.callReadOnlyFn("vault-core", "get-total-shares", [], deployer);
    expect(totalShares.result).toBeOk(Cl.uint(20000));
  });

  it("withdrawal returns proportional assets based on share price", () => {
    setupDeposit(wallet1, 10000);

    // Report yield: 5000 gross, 500 fee, 4500 net
    // total-assets = 14500, total-shares = 10000
    simnet.callPublicFn("vault-core", "report-yield",
      [Cl.uint(5000)], deployer);

    // Mint extra tokens to vault so it can pay out the yield
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(5000), Cl.principal(`${deployer}.vault-core`)], deployer);

    // Withdraw 5000 shares -> assets = (5000 * 14500) / 10000 = 7250
    // But capped at user deposit tracking (10000), so 7250
    const result = simnet.callPublicFn("vault-core", "withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
    expect(result.result).toBeOk(Cl.uint(7250));
  });

  // --- Emergency Withdrawal Tests ---

  it("blocks normal withdraw when vault is paused", () => {
    setupDeposit(wallet1, 1000);
    simnet.callPublicFn("vault-core", "pause-vault", [], deployer);
    const result = simnet.callPublicFn("vault-core", "withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(500)], wallet1);
    expect(result.result).toBeErr(Cl.uint(405));
  });

  it("allows emergency-withdraw when vault is paused", () => {
    setupDeposit(wallet1, 1000);
    simnet.callPublicFn("vault-core", "pause-vault", [], deployer);
    const result = simnet.callPublicFn("vault-core", "emergency-withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(500)], wallet1);
    expect(result.result).toBeOk(Cl.uint(500));
    const shares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
      [Cl.principal(wallet1)], deployer);
    expect(shares.result).toBeOk(Cl.uint(500));
  });

  it("emergency-withdraw caps at available balance when amount exceeds deposit", () => {
    setupDeposit(wallet1, 1000);
    // Request 9999 shares but only have 1000 - should withdraw 1000 (capped)
    const result = simnet.callPublicFn("vault-core", "emergency-withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(9999)], wallet1);
    expect(result.result).toBeOk(Cl.uint(1000));
    // Shares should be zero after full withdrawal
    const shares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
      [Cl.principal(wallet1)], deployer);
    expect(shares.result).toBeOk(Cl.uint(0));
  });

  // --- Deposit Cap Tests ---

  it("rejects deposit exceeding per-user cap", () => {
    simnet.callPublicFn("vault-core", "set-deposit-cap-per-user",
      [Cl.uint(500)], deployer);
    simnet.callPublicFn("vault-core", "add-whitelisted-token",
      [Cl.principal(`${deployer}.yield-token`)], deployer);
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(10000), Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("yield-token", "set-authorized-minter",
      [Cl.principal(`${deployer}.vault-core`)], deployer);
    const result = simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(1000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(407));
  });

  it("rejects rebalance exceeding max-rebalance-per-tx", () => {
    simnet.callPublicFn("vault-core", "set-max-rebalance-per-tx",
      [Cl.uint(50)], deployer);
    simnet.callPublicFn("vault-core", "add-whitelisted-target",
      [Cl.principal(wallet2)], deployer);
    simnet.callPublicFn("vault-core", "add-whitelisted-token",
      [Cl.principal(`${deployer}.yield-token`)], deployer);
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(10000), Cl.principal(`${deployer}.vault-core`)], deployer);
    const result = simnet.callPublicFn("vault-core", "rebalance",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(100), Cl.principal(wallet2)], deployer);
    expect(result.result).toBeErr(Cl.uint(408));
  });

  // --- Ownership Transfer Tests ---

  it("allows two-step ownership transfer", () => {
    const propose = simnet.callPublicFn("vault-core", "propose-owner",
      [Cl.principal(wallet1)], deployer);
    expect(propose.result).toBeOk(Cl.bool(true));
    const accept = simnet.callPublicFn("vault-core", "accept-ownership", [], wallet1);
    expect(accept.result).toBeOk(Cl.bool(true));
    const owner = simnet.callReadOnlyFn("vault-core", "get-owner", [], deployer);
    expect(owner.result).toBeOk(Cl.principal(wallet1));
  });

  it("rejects accept-ownership from non-proposed address", () => {
    simnet.callPublicFn("vault-core", "propose-owner",
      [Cl.principal(wallet1)], deployer);
    const result = simnet.callPublicFn("vault-core", "accept-ownership", [], wallet2);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("rejects emergency-withdraw for zero amount", () => {
    const result = simnet.callPublicFn("vault-core", "emergency-withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(0)], wallet1);
    expect(result.result).toBeErr(Cl.uint(403));
  });

  // --- Rebalance Target Validation Tests ---

  it("allows owner to whitelist a rebalance target", () => {
    const result = simnet.callPublicFn("vault-core", "add-whitelisted-target",
      [Cl.principal(wallet2)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("rejects non-owner from whitelisting targets", () => {
    const result = simnet.callPublicFn("vault-core", "add-whitelisted-target",
      [Cl.principal(wallet2)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("rejects rebalance to non-whitelisted target", () => {
    const result = simnet.callPublicFn("vault-core", "rebalance",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(100), Cl.principal(wallet1)], deployer);
    expect(result.result).toBeErr(Cl.uint(406));
  });

  it("allows rebalance to whitelisted target", () => {
    simnet.callPublicFn("vault-core", "add-whitelisted-target",
      [Cl.principal(wallet2)], deployer);
    simnet.callPublicFn("vault-core", "add-whitelisted-token",
      [Cl.principal(`${deployer}.yield-token`)], deployer);
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(10000), Cl.principal(`${deployer}.vault-core`)], deployer);
    const result = simnet.callPublicFn("vault-core", "rebalance",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(100), Cl.principal(wallet2)], deployer);
    expect(result.result).toBeOk(Cl.uint(100));
  });

  it("allows owner to remove a whitelisted target", () => {
    simnet.callPublicFn("vault-core", "add-whitelisted-target",
      [Cl.principal(wallet2)], deployer);
    const result = simnet.callPublicFn("vault-core", "remove-whitelisted-target",
      [Cl.principal(wallet2)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));
  });

  // --- Report Yield Tests ---

  it("rejects report-yield from unauthorized caller", () => {
    const result = simnet.callPublicFn("vault-core", "report-yield",
      [Cl.uint(1000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("rejects report-yield with zero amount", () => {
    const result = simnet.callPublicFn("vault-core", "report-yield",
      [Cl.uint(0)], deployer);
    expect(result.result).toBeErr(Cl.uint(403));
  });

  it("allows authorized harvester to report yield", () => {
    setupDeposit(wallet1, 10000);
    simnet.callPublicFn("vault-core", "set-authorized-harvester",
      [Cl.principal(wallet2)], deployer);
    const result = simnet.callPublicFn("vault-core", "report-yield",
      [Cl.uint(1000)], wallet2);
    expect(result.result).toBeOk(Cl.uint(900)); // 1000 - 10% fee = 900
  });

  // --- Read-only Helpers ---

  it("get-assets-for-shares returns correct value after yield", () => {
    setupDeposit(wallet1, 10000);
    simnet.callPublicFn("vault-core", "report-yield",
      [Cl.uint(2000)], deployer);
    // total-assets = 10000 + 1800 = 11800, total-shares = 10000
    // 5000 shares = (5000 * 11800) / 10000 = 5900
    const result = simnet.callReadOnlyFn("vault-core", "get-assets-for-shares",
      [Cl.uint(5000)], deployer);
    expect(result.result).toBeOk(Cl.uint(5900));
  });

  it("get-shares-for-assets returns correct value after yield", () => {
    setupDeposit(wallet1, 10000);
    simnet.callPublicFn("vault-core", "report-yield",
      [Cl.uint(2000)], deployer);
    // total-assets = 11800, total-shares = 10000
    // 5900 assets = (5900 * 10000) / 11800 = 5000
    const result = simnet.callReadOnlyFn("vault-core", "get-shares-for-assets",
      [Cl.uint(5900)], deployer);
    expect(result.result).toBeOk(Cl.uint(5000));
  });
});
