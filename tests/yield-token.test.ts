import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

describe("yield-token", () => {
  it("has correct token metadata", () => {
    const name = simnet.callReadOnlyFn("yield-token", "get-name", [], deployer);
    expect(name.result).toBeOk(Cl.stringAscii("CashFlow Yield Token"));

    const symbol = simnet.callReadOnlyFn("yield-token", "get-symbol", [], deployer);
    expect(symbol.result).toBeOk(Cl.stringAscii("cfYIELD"));

    const decimals = simnet.callReadOnlyFn("yield-token", "get-decimals", [], deployer);
    expect(decimals.result).toBeOk(Cl.uint(6));
  });

  it("starts with zero supply", () => {
    const result = simnet.callReadOnlyFn("yield-token", "get-total-supply", [], deployer);
    expect(result.result).toBeOk(Cl.uint(0));
  });

  it("allows default minter (deployer) to mint tokens", () => {
    // Default authorized-minter is deployer (tx-sender at deploy time)
    const result = simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(1000000), Cl.principal(wallet1)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    const balance = simnet.callReadOnlyFn("yield-token", "get-balance",
      [Cl.principal(wallet1)], deployer);
    expect(balance.result).toBeOk(Cl.uint(1000000));
  });

  it("rejects minting zero amount", () => {
    const result = simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(0), Cl.principal(wallet1)], deployer);
    expect(result.result).toBeErr(Cl.uint(403));
  });

  it("rejects unauthorized minting", () => {
    const result = simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(1000), Cl.principal(wallet1)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("allows default minter to burn tokens", () => {
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(500000), Cl.principal(wallet1)], deployer);
    const result = simnet.callPublicFn("yield-token", "burn",
      [Cl.uint(200000), Cl.principal(wallet1)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("allows owner to set authorized minter", () => {
    const result = simnet.callPublicFn("yield-token", "set-authorized-minter",
      [Cl.principal(`${deployer}.vault-core`)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));
  });

  // --- Auth Fix Tests ---

  it("rejects direct mint after minter changed to vault-core", () => {
    // Change minter to vault-core, then try to mint directly as deployer
    simnet.callPublicFn("yield-token", "set-authorized-minter",
      [Cl.principal(`${deployer}.vault-core`)], deployer);
    const result = simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(1000), Cl.principal(wallet1)], deployer);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("rejects direct burn after minter changed to vault-core", () => {
    // Mint some tokens first (before changing minter)
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(1000), Cl.principal(wallet1)], deployer);
    // Change minter
    simnet.callPublicFn("yield-token", "set-authorized-minter",
      [Cl.principal(`${deployer}.vault-core`)], deployer);
    const result = simnet.callPublicFn("yield-token", "burn",
      [Cl.uint(100), Cl.principal(wallet1)], deployer);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("allows mint through vault-core deposit flow", () => {
    // Mint tokens to wallet1, set vault as minter, whitelist, deposit
    simnet.callPublicFn("yield-token", "mint",
      [Cl.uint(50000), Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("yield-token", "set-authorized-minter",
      [Cl.principal(`${deployer}.vault-core`)], deployer);
    simnet.callPublicFn("vault-core", "add-whitelisted-token",
      [Cl.principal(`${deployer}.yield-token`)], deployer);
    const result = simnet.callPublicFn("vault-core", "deposit",
      [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
    expect(result.result).toBeOk(Cl.uint(5000));
  });

  it("rejects non-owner from setting authorized minter", () => {
    const result = simnet.callPublicFn("yield-token", "set-authorized-minter",
      [Cl.principal(wallet1)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });
});
