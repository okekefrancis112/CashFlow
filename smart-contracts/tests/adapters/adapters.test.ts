import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

describe("zest-adapter", () => {
  it("accepts deposits and tracks balance", () => {
    const result = simnet.callPublicFn("zest-adapter", "adapter-deposit",
      [Cl.uint(10000)], deployer);
    expect(result.result).toBeOk(Cl.uint(10000));

    const balance = simnet.callReadOnlyFn("zest-adapter", "get-balance", [], deployer);
    expect(balance.result).toBeOk(Cl.uint(10000));
  });

  it("allows withdrawal up to balance", () => {
    simnet.callPublicFn("zest-adapter", "adapter-deposit", [Cl.uint(5000)], deployer);
    const result = simnet.callPublicFn("zest-adapter", "adapter-withdraw",
      [Cl.uint(3000)], deployer);
    expect(result.result).toBeOk(Cl.uint(3000));

    const balance = simnet.callReadOnlyFn("zest-adapter", "get-balance", [], deployer);
    expect(balance.result).toBeOk(Cl.uint(2000));
  });

  it("rejects withdrawal exceeding balance", () => {
    simnet.callPublicFn("zest-adapter", "adapter-deposit", [Cl.uint(1000)], deployer);
    const result = simnet.callPublicFn("zest-adapter", "adapter-withdraw",
      [Cl.uint(5000)], deployer);
    expect(result.result).toBeErr(Cl.uint(402));
  });

  it("simulates yield and harvests it", () => {
    simnet.callPublicFn("zest-adapter", "adapter-deposit", [Cl.uint(10000)], deployer);
    simnet.callPublicFn("zest-adapter", "simulate-yield", [Cl.uint(500)], deployer);

    const pending = simnet.callReadOnlyFn("zest-adapter", "get-pending-yield", [], deployer);
    expect(pending.result).toBeOk(Cl.uint(500));

    const harvest = simnet.callPublicFn("zest-adapter", "harvest", [], deployer);
    expect(harvest.result).toBeOk(Cl.uint(500));

    // Yield should be zero after harvest
    const afterHarvest = simnet.callReadOnlyFn("zest-adapter", "get-pending-yield", [], deployer);
    expect(afterHarvest.result).toBeOk(Cl.uint(0));
  });

  it("rejects unauthorized deposit", () => {
    const result = simnet.callPublicFn("zest-adapter", "adapter-deposit",
      [Cl.uint(1000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });
});

describe("stackingdao-adapter", () => {
  it("accepts deposits and tracks balance", () => {
    const result = simnet.callPublicFn("stackingdao-adapter", "adapter-deposit",
      [Cl.uint(8000)], deployer);
    expect(result.result).toBeOk(Cl.uint(8000));

    const balance = simnet.callReadOnlyFn("stackingdao-adapter", "get-balance", [], deployer);
    expect(balance.result).toBeOk(Cl.uint(8000));
  });

  it("allows withdrawal up to balance", () => {
    simnet.callPublicFn("stackingdao-adapter", "adapter-deposit", [Cl.uint(5000)], deployer);
    const result = simnet.callPublicFn("stackingdao-adapter", "adapter-withdraw",
      [Cl.uint(2000)], deployer);
    expect(result.result).toBeOk(Cl.uint(2000));

    const balance = simnet.callReadOnlyFn("stackingdao-adapter", "get-balance", [], deployer);
    expect(balance.result).toBeOk(Cl.uint(3000));
  });

  it("simulates yield and harvests it", () => {
    simnet.callPublicFn("stackingdao-adapter", "adapter-deposit", [Cl.uint(10000)], deployer);
    simnet.callPublicFn("stackingdao-adapter", "simulate-yield", [Cl.uint(800)], deployer);

    const harvest = simnet.callPublicFn("stackingdao-adapter", "harvest", [], deployer);
    expect(harvest.result).toBeOk(Cl.uint(800));
  });

  it("rejects unauthorized harvest", () => {
    const result = simnet.callPublicFn("stackingdao-adapter", "harvest", [], wallet1);
    expect(result.result).toBeErr(Cl.uint(401));
  });
});
