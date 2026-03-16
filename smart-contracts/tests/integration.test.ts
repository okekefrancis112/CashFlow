import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// Helper: full deposit setup
function setupVault() {
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
}

describe("integration: full lifecycle", () => {
  it("deposit, verify shares, withdraw, verify final state", () => {
    setupVault();

    // Deposit 10000 (first deposit, 1:1)
    const deposit = simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(10000)], wallet1);
    expect(deposit.result).toBeOk(Cl.uint(10000));

    // Verify shares (1:1 for first deposit)
    const shares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
      [Cl.principal(wallet1)], deployer);
    expect(shares.result).toBeOk(Cl.uint(10000));

    // Verify total shares and total assets
    const totalShares = simnet.callReadOnlyFn("vault-core", "get-total-shares", [], deployer);
    expect(totalShares.result).toBeOk(Cl.uint(10000));
    const totalAssets = simnet.callReadOnlyFn("vault-core", "get-total-assets", [], deployer);
    expect(totalAssets.result).toBeOk(Cl.uint(10000));

    // Partial withdraw: burn 4000 shares (no yield, so 1:1 still)
    const withdraw = simnet.callPublicFn("vault-core", "withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(4000)], wallet1);
    expect(withdraw.result).toBeOk(Cl.uint(4000));

    // Verify remaining
    const remainingShares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
      [Cl.principal(wallet1)], deployer);
    expect(remainingShares.result).toBeOk(Cl.uint(6000));

    const remainingDeposit = simnet.callReadOnlyFn("vault-core", "get-user-deposit",
      [Cl.principal(wallet1), Cl.principal(`${deployer}.yield-token`)], deployer);
    expect(remainingDeposit.result).toBeOk(Cl.uint(6000));
  });

  it("multi-user deposit and withdraw isolation", () => {
    setupVault();

    simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
    simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(3000)], wallet2);

    // Verify total shares = 8000
    const total = simnet.callReadOnlyFn("vault-core", "get-total-shares", [], deployer);
    expect(total.result).toBeOk(Cl.uint(8000));

    // wallet_1 withdraws 2000 shares (1:1, no yield)
    simnet.callPublicFn("vault-core", "withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(2000)], wallet1);

    // wallet_2 balance unaffected
    const w2shares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
      [Cl.principal(wallet2)], deployer);
    expect(w2shares.result).toBeOk(Cl.uint(3000));
  });

  it("rejects deposit of non-whitelisted token", () => {
    const result = simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.fee-collector`), Cl.uint(1000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(404));
  });

  it("rejects withdraw exceeding share balance", () => {
    setupVault();
    simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(1000)], wallet1);
    const result = simnet.callPublicFn("vault-core", "withdraw",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(402));
  });

  it("strategy router + vault integration", () => {
    simnet.callPublicFn("strategy-router", "add-strategy",
      [Cl.stringAscii("Zest sBTC"), Cl.principal(wallet1), Cl.uint(4000)], deployer);
    simnet.callPublicFn("strategy-router", "add-strategy",
      [Cl.stringAscii("Bitflow LP"), Cl.principal(wallet2), Cl.uint(3000)], deployer);

    const total = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
    expect(total.result).toBeOk(Cl.uint(7000));

    // Agent updates allocation
    simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("strategy-router", "update-allocation",
      [Cl.uint(0), Cl.uint(3000)], wallet1);

    const newTotal = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
    expect(newTotal.result).toBeOk(Cl.uint(6000));
  });

  it("fee collection flow: collect STX fees, owner withdraws", () => {
    simnet.callPublicFn("fee-collector", "collect-fee", [Cl.uint(100000)], wallet1);
    simnet.callPublicFn("fee-collector", "collect-fee", [Cl.uint(50000)], wallet2);

    const total = simnet.callReadOnlyFn("fee-collector", "get-total-fees", [], deployer);
    expect(total.result).toBeOk(Cl.uint(150000));

    const withdraw = simnet.callPublicFn("fee-collector", "withdraw-fees",
      [Cl.uint(80000)], deployer);
    expect(withdraw.result).toBeOk(Cl.uint(80000));

    const remaining = simnet.callReadOnlyFn("fee-collector", "get-total-fees", [], deployer);
    expect(remaining.result).toBeOk(Cl.uint(70000));
  });
});
