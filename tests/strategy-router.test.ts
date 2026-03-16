import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// Helper: add a strategy and return its id
function addStrategy(name: string, alloc: number) {
  return simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii(name), Cl.principal(wallet1), Cl.uint(alloc)], deployer);
}

describe("strategy-router", () => {
  it("starts with zero strategies", () => {
    const result = simnet.callReadOnlyFn("strategy-router", "get-strategy-count", [], deployer);
    expect(result.result).toBeOk(Cl.uint(0));
  });

  it("starts with zero total allocation", () => {
    const result = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
    expect(result.result).toBeOk(Cl.uint(0));
  });

  it("allows owner to add a strategy", () => {
    const result = addStrategy("Zest sBTC Lending", 3000);
    expect(result.result).toBeOk(Cl.uint(0));
    const count = simnet.callReadOnlyFn("strategy-router", "get-strategy-count", [], deployer);
    expect(count.result).toBeOk(Cl.uint(1));
    const total = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
    expect(total.result).toBeOk(Cl.uint(3000));
  });

  it("rejects non-owner from adding strategies", () => {
    const result = simnet.callPublicFn("strategy-router", "add-strategy",
      [Cl.stringAscii("Unauthorized"), Cl.principal(wallet1), Cl.uint(1000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("prevents allocation overflow beyond 10000 bps", () => {
    addStrategy("Strategy A", 6000);
    const result = simnet.callPublicFn("strategy-router", "add-strategy",
      [Cl.stringAscii("Strategy B"), Cl.principal(wallet1), Cl.uint(5000)], deployer);
    expect(result.result).toBeErr(Cl.uint(404));
  });

  it("allows owner to authorize an agent", () => {
    simnet.callPublicFn("strategy-router", "add-agent",
      [Cl.principal(wallet1)], deployer);
    const result = simnet.callReadOnlyFn("strategy-router", "is-authorized-agent",
      [Cl.principal(wallet1)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));
  });

  // --- Deactivate / Activate Tests ---

  it("deactivates a strategy and saves its allocation", () => {
    addStrategy("Zest sBTC", 3000);
    const result = simnet.callPublicFn("strategy-router", "deactivate-strategy",
      [Cl.uint(0)], deployer);
    expect(result.result).toBeOk(Cl.bool(false));
    const total = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
    expect(total.result).toBeOk(Cl.uint(0));
  });

  it("reactivates a strategy and restores saved allocation", () => {
    addStrategy("Zest sBTC", 3000);
    simnet.callPublicFn("strategy-router", "deactivate-strategy", [Cl.uint(0)], deployer);
    const result = simnet.callPublicFn("strategy-router", "activate-strategy",
      [Cl.uint(0)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));
    const alloc = simnet.callReadOnlyFn("strategy-router", "get-allocation",
      [Cl.uint(0)], deployer);
    expect(alloc.result).toBeOk(Cl.uint(3000));
    const total = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
    expect(total.result).toBeOk(Cl.uint(3000));
  });

  it("rejects activating an already-active strategy", () => {
    addStrategy("Active One", 1000);
    const result = simnet.callPublicFn("strategy-router", "activate-strategy",
      [Cl.uint(0)], deployer);
    expect(result.result).toBeErr(Cl.uint(405));
  });

  it("rejects deactivating an already-inactive strategy", () => {
    addStrategy("Test", 1000);
    simnet.callPublicFn("strategy-router", "deactivate-strategy", [Cl.uint(0)], deployer);
    const result = simnet.callPublicFn("strategy-router", "deactivate-strategy",
      [Cl.uint(0)], deployer);
    expect(result.result).toBeErr(Cl.uint(405));
  });

  // --- Update Allocation Tests ---

  it("allows authorized agent to update allocation", () => {
    addStrategy("Agent Test", 2000);
    simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
    const result = simnet.callPublicFn("strategy-router", "update-allocation",
      [Cl.uint(0), Cl.uint(3500)], wallet1);
    expect(result.result).toBeOk(Cl.uint(3500));
  });

  it("rejects unauthorized user from updating allocation", () => {
    addStrategy("Unauth Test", 1000);
    const result = simnet.callPublicFn("strategy-router", "update-allocation",
      [Cl.uint(0), Cl.uint(2000)], wallet2);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("prevents update-allocation from exceeding 10000 bps total", () => {
    addStrategy("S1", 5000);
    addStrategy("S2", 3000);
    const result = simnet.callPublicFn("strategy-router", "update-allocation",
      [Cl.uint(1), Cl.uint(6000)], deployer);
    expect(result.result).toBeErr(Cl.uint(404));
  });

  it("allows owner to remove an agent", () => {
    simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("strategy-router", "remove-agent", [Cl.principal(wallet1)], deployer);
    const result = simnet.callReadOnlyFn("strategy-router", "is-authorized-agent",
      [Cl.principal(wallet1)], deployer);
    expect(result.result).toBeOk(Cl.bool(false));
  });

  it("rejects non-owner from removing agents", () => {
    simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
    const result = simnet.callPublicFn("strategy-router", "remove-agent",
      [Cl.principal(wallet1)], wallet2);
    expect(result.result).toBeErr(Cl.uint(401));
  });

  // --- Agent Rotation ---

  it("owner can rotate an agent key atomically", () => {
    // Add wallet1 as agent
    simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
    const before = simnet.callReadOnlyFn("strategy-router", "is-authorized-agent", [Cl.principal(wallet1)], deployer);
    expect(before.result).toBeOk(Cl.bool(true));

    // Rotate wallet1 -> wallet2
    const result = simnet.callPublicFn("strategy-router", "rotate-agent",
      [Cl.principal(wallet1), Cl.principal(wallet2)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    // Old agent removed
    const old = simnet.callReadOnlyFn("strategy-router", "is-authorized-agent", [Cl.principal(wallet1)], deployer);
    expect(old.result).toBeOk(Cl.bool(false));

    // New agent added
    const newAgent = simnet.callReadOnlyFn("strategy-router", "is-authorized-agent", [Cl.principal(wallet2)], deployer);
    expect(newAgent.result).toBeOk(Cl.bool(true));
  });

  it("rotate-agent fails if old agent is not authorized", () => {
    const result = simnet.callPublicFn("strategy-router", "rotate-agent",
      [Cl.principal(wallet1), Cl.principal(wallet2)], deployer);
    expect(result.result).toBeErr(Cl.uint(405)); // ERR-INVALID-INPUT
  });

  it("non-owner cannot rotate agent", () => {
    simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
    const result = simnet.callPublicFn("strategy-router", "rotate-agent",
      [Cl.principal(wallet1), Cl.principal(wallet2)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });
});
