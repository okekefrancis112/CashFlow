import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

describe("fee-collector", () => {
  it("starts with zero fees collected", () => {
    const result = simnet.callReadOnlyFn("fee-collector", "get-total-fees", [], deployer);
    expect(result.result).toBeOk(Cl.uint(0));
  });

  it("returns default performance fee of 1000 bps (10%)", () => {
    const result = simnet.callReadOnlyFn("fee-collector", "get-performance-fee-bps", [], deployer);
    expect(result.result).toBeOk(Cl.uint(1000));
  });

  it("calculates fees correctly", () => {
    const result = simnet.callReadOnlyFn("fee-collector", "calculate-fee",
      [Cl.uint(10000)], deployer);
    expect(result.result).toBeOk(Cl.uint(1000));
  });

  it("allows STX fee collection", () => {
    const result = simnet.callPublicFn("fee-collector", "collect-fee",
      [Cl.uint(500000)], wallet1);
    expect(result.result).toBeOk(Cl.uint(500000));
    const total = simnet.callReadOnlyFn("fee-collector", "get-total-fees", [], deployer);
    expect(total.result).toBeOk(Cl.uint(500000));
  });

  it("rejects zero amount fee collection", () => {
    const result = simnet.callPublicFn("fee-collector", "collect-fee",
      [Cl.uint(0)], wallet1);
    expect(result.result).toBeErr(Cl.uint(403));
  });

  it("allows owner to update fee bps", () => {
    const result = simnet.callPublicFn("fee-collector", "update-fee-bps",
      [Cl.uint(1500)], deployer);
    expect(result.result).toBeOk(Cl.uint(1500));
    const bps = simnet.callReadOnlyFn("fee-collector", "get-performance-fee-bps", [], deployer);
    expect(bps.result).toBeOk(Cl.uint(1500));
  });

  it("rejects fee bps above 50%", () => {
    const result = simnet.callPublicFn("fee-collector", "update-fee-bps",
      [Cl.uint(6000)], deployer);
    expect(result.result).toBeErr(Cl.uint(403));
  });

  it("rejects non-owner from updating fees", () => {
    const result = simnet.callPublicFn("fee-collector", "update-fee-bps",
      [Cl.uint(500)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("rejects non-owner from withdrawing fees", () => {
    simnet.callPublicFn("fee-collector", "collect-fee", [Cl.uint(100000)], wallet1);
    const result = simnet.callPublicFn("fee-collector", "withdraw-fees",
      [Cl.uint(50000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  // --- Fee Precision Tests ---

  it("calculates zero fee for tiny yield amounts", () => {
    const result = simnet.callReadOnlyFn("fee-collector", "calculate-fee",
      [Cl.uint(9)], deployer);
    expect(result.result).toBeOk(Cl.uint(0));
  });

  it("calculates fee correctly at boundary", () => {
    const result = simnet.callReadOnlyFn("fee-collector", "calculate-fee",
      [Cl.uint(10)], deployer);
    expect(result.result).toBeOk(Cl.uint(1));
  });

  it("calculates fee for large yield amounts", () => {
    // Default bps is 1000 (10%): (1000000 * 1000) / 10000 = 100000
    const result = simnet.callReadOnlyFn("fee-collector", "calculate-fee",
      [Cl.uint(1000000)], deployer);
    expect(result.result).toBeOk(Cl.uint(100000));
  });

  // --- Owner Fee Withdrawal ---

  it("allows owner to withdraw STX fees", () => {
    simnet.callPublicFn("fee-collector", "collect-fee", [Cl.uint(100000)], wallet1);
    const result = simnet.callPublicFn("fee-collector", "withdraw-fees",
      [Cl.uint(50000)], deployer);
    expect(result.result).toBeOk(Cl.uint(50000));
  });

  it("rejects withdrawing more fees than available", () => {
    simnet.callPublicFn("fee-collector", "collect-fee", [Cl.uint(1000)], wallet1);
    const result = simnet.callPublicFn("fee-collector", "withdraw-fees",
      [Cl.uint(999999)], deployer);
    expect(result.result).toBeErr(Cl.uint(402));
  });
});
