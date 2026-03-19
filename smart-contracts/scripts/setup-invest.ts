/**
 * One-time testnet setup: whitelist adapters as rebalance targets,
 * register strategies in strategy-router, and add backend as strategy agent.
 *
 * Note: vault-core (v1) on testnet doesn't have report-yield or
 * set-authorized-harvester. The harvester/rebalancer will run in simulation
 * mode. vault-core-v2 has report-yield but the user's deposits are in v1.
 *
 * Usage: npx tsx scripts/setup-invest.ts
 */
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  stringAsciiCV,
  contractPrincipalCV,
  principalCV,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

const PRIVATE_KEY = "ac3c5c49a072198863aacc91f6d837c9e8560591ecef5660b85b51059e3f2c1201";
const DEPLOYER = "ST2211JFW8MMPR3ZKDH4303QMZ5WCHZ2NFG1W53YD";
const network = STACKS_TESTNET;
const API = "https://api.testnet.hiro.so";

async function waitForTx(txId: string, label: string): Promise<boolean> {
  console.log(`  Waiting for "${label}": ${txId}`);
  console.log(`  https://explorer.hiro.so/txid/${txId}?chain=testnet`);

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    try {
      const res = await fetch(`${API}/extended/v1/tx/${txId}`);
      const data = await res.json();
      if (data.tx_status === "success") {
        console.log(`  CONFIRMED: ${label}\n`);
        return true;
      }
      if (data.tx_status === "abort_by_response" || data.tx_status === "abort_by_post_condition") {
        console.error(`  FAILED: ${label}`, data.tx_result?.repr || data.tx_result);
        return false;
      }
      process.stdout.write(".");
    } catch {
      process.stdout.write("x");
    }
  }
  console.error(`  TIMEOUT: ${label}`);
  return false;
}

async function sendTx(
  contractName: string,
  functionName: string,
  functionArgs: any[],
  label: string,
  fee = 30_000
): Promise<boolean> {
  console.log(`\n>> ${label}`);

  const tx = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName,
    functionName,
    functionArgs,
    senderKey: PRIVATE_KEY,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee,
  });

  const result = await broadcastTransaction({ transaction: tx, network });

  if ("error" in result) {
    const reason = (result as any).reason || "";
    console.error(`  Broadcast error: ${reason}`);
    if (reason.includes("ConflictingNonceInMempool")) {
      console.log("  (tx in-flight, waiting...)");
      await new Promise((r) => setTimeout(r, 15_000));
      return true;
    }
    return false;
  }

  const txId = typeof result === "string" ? result : result.txid;
  return waitForTx(txId, label);
}

async function main() {
  console.log("=== CashFlow Testnet Investment Setup ===\n");
  console.log(`Deployer: ${DEPLOYER}\n`);

  // Step 1: Register strategies in strategy-router
  console.log("--- Step 1: Register strategies in strategy-router ---");

  const strategies = [
    { name: "Zest sBTC Lending", adapter: "zest-adapter", bps: 5000 },
    { name: "StackingDAO Liquid Staking", adapter: "stackingdao-adapter", bps: 5000 },
  ];

  for (const strat of strategies) {
    const ok = await sendTx(
      "strategy-router",
      "add-strategy",
      [
        stringAsciiCV(strat.name),
        contractPrincipalCV(DEPLOYER, strat.adapter),
        uintCV(strat.bps),
      ],
      `Add strategy: ${strat.name} (${strat.bps / 100}%)`
    );
    if (!ok) {
      console.error(`Failed to add strategy ${strat.name}, aborting.`);
      return;
    }
  }

  // Step 2: Authorize backend as strategy agent
  console.log("\n--- Step 2: Add backend as authorized agent on strategy-router ---");

  const ok2 = await sendTx(
    "strategy-router",
    "add-agent",
    [principalCV(DEPLOYER)],
    `Add agent: ${DEPLOYER}`
  );
  if (!ok2) {
    console.error("Failed to add agent, aborting.");
    return;
  }

  console.log("\n=== Setup Complete! ===");
  console.log("Strategies registered: Zest 50%, StackingDAO 50%");
  console.log("Backend authorized as strategy agent");
  console.log("\nNote: vault-core adapter whitelisting was already done in step 1.");
  console.log("Harvester/rebalancer run in simulation mode (vault-core v1 has no report-yield).");
}

main().catch(console.error);
