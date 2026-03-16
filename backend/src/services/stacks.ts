import {
  callReadOnlyFunction,
  cvToJSON,
  ClarityValue,
  principalCV,
  uintCV,
} from "@stacks/transactions";
import { StacksTestnet, StacksMainnet } from "@stacks/network";
import { config } from "../config";

export function getNetwork() {
  return config.stacksNetwork === "mainnet"
    ? new StacksMainnet()
    : new StacksTestnet();
}

export async function callReadOnly(
  contractName: string,
  functionName: string,
  args: ClarityValue[] = []
) {
  const result = await callReadOnlyFunction({
    contractAddress: config.walletAddress,
    contractName,
    functionName,
    functionArgs: args,
    network: getNetwork(),
    senderAddress: config.walletAddress,
  });
  return cvToJSON(result);
}

export async function getVaultStats() {
  const [totalShares, isPaused] = await Promise.all([
    callReadOnly(config.contracts.vaultCore, "get-total-shares"),
    callReadOnly(config.contracts.vaultCore, "is-paused"),
  ]);

  return {
    totalShares: totalShares?.value || 0,
    isPaused: isPaused?.value || false,
  };
}

export async function getUserDeposit(user: string, token: string) {
  return callReadOnly(config.contracts.vaultCore, "get-user-deposit", [
    principalCV(user),
    principalCV(token),
  ]);
}

export async function getStrategyCount() {
  return callReadOnly(config.contracts.strategyRouter, "get-strategy-count");
}

export async function getStrategy(id: number) {
  return callReadOnly(config.contracts.strategyRouter, "get-strategy", [
    uintCV(id),
  ]);
}

export async function getTotalDeposit(token: string) {
  const result = await callReadOnly(
    config.contracts.vaultCore,
    "get-total-deposit",
    [principalCV(token)]
  );
  return result?.value ?? 0;
}

export async function getUserShares(user: string) {
  const result = await callReadOnly(
    config.contracts.vaultCore,
    "get-user-shares",
    [principalCV(user)]
  );
  return result?.value ?? 0;
}

export async function isVaultPaused(): Promise<boolean> {
  const result = await callReadOnly(config.contracts.vaultCore, "is-paused");
  return result?.value ?? false;
}

export async function getAllStrategies() {
  const countResult = await getStrategyCount();
  const count = countResult?.value ?? 0;
  if (count === 0) return [];

  const strategies = [];
  for (let i = 0; i < count; i++) {
    const result = await getStrategy(i);
    const strategy = result?.value?.value;
    if (strategy) {
      strategies.push({
        id: i,
        name: strategy.name?.value ?? "",
        protocolAddress: strategy["protocol-address"]?.value ?? "",
        allocationBps: parseInt(strategy["allocation-bps"]?.value ?? "0", 10),
        isActive: strategy["is-active"]?.value ?? false,
      });
    }
  }
  return strategies;
}

export async function getTotalAllocation() {
  const result = await callReadOnly(
    config.contracts.strategyRouter,
    "get-total-allocation"
  );
  return result?.value ?? 0;
}

export async function getPerformanceFeeBps() {
  const result = await callReadOnly(
    config.contracts.feeCollector,
    "get-performance-fee-bps"
  );
  return result?.value ?? 1000;
}

export async function getTotalFees() {
  const result = await callReadOnly(
    config.contracts.feeCollector,
    "get-total-fees"
  );
  return result?.value ?? 0;
}

export async function getSharePrice() {
  const result = await callReadOnly(config.contracts.vaultCore, "get-share-price");
  const raw = result?.value?.value ?? result?.value ?? 1000000;
  return Number(raw);
}

export async function getTotalAssets() {
  const result = await callReadOnly(config.contracts.vaultCore, "get-total-assets");
  const raw = result?.value?.value ?? result?.value ?? 0;
  return Number(raw);
}
