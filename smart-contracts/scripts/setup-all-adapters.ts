/**
 * Register Bitflow + Hermetica strategies in strategy-router,
 * rebalance allocations across all 4, and whitelist adapters
 * as rebalance targets in vault-core.
 *
 * Current on-chain state:
 *   Strategy 0: Zest sBTC Lending — 5000 bps (50%)
 *   Strategy 1: StackingDAO Liquid Staking — 5000 bps (50%)
 *
 * Target state:
 *   Strategy 0: Zest — 2500 bps (25%)
 *   Strategy 1: StackingDAO — 2500 bps (25%)
 *   Strategy 2: Bitflow — 2500 bps (25%)
 *   Strategy 3: Hermetica — 2500 bps (25%)
 *
 * Usage: npx tsx scripts/setup-all-adapters.ts
 */
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  stringAsciiCV,
  contractPrincipalCV,
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
        console.log(`\n  CONFIRMED: ${label}\n`);
        return true;
      }
      if (data.tx_status === "abort_by_response" || data.tx_status === "abort_by_post_condition") {
        console.error(`\n  FAILED: ${label}`, data.tx_result?.repr || data.tx_result);
        return false;
      }
      process.stdout.write(".");
    } catch {
      process.stdout.write("x");
    }
  }
  console.error(`\n  TIMEOUT: ${label}`);
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
  console.log("=== CashFlow: Register All 4 Adapter Strategies ===\n");

  // Step 1: Update existing strategies to 2500 bps each (from 5000)
  console.log("--- Step 1: Reduce Zest allocation to 2500 bps ---");
  let ok = await sendTx(
    "strategy-router",
    "update-allocation",
    [uintCV(0), uintCV(2500)],
    "Update Zest (id=0) to 2500 bps"
  );
  if (!ok) return;

  console.log("--- Step 2: Reduce StackingDAO allocation to 2500 bps ---");
  ok = await sendTx(
    "strategy-router",
    "update-allocation",
    [uintCV(1), uintCV(2500)],
    "Update StackingDAO (id=1) to 2500 bps"
  );
  if (!ok) return;

  // Step 3: Add Bitflow strategy (2500 bps)
  console.log("--- Step 3: Add Bitflow strategy ---");
  ok = await sendTx(
    "strategy-router",
    "add-strategy",
    [
      stringAsciiCV("Bitflow LP"),
      contractPrincipalCV(DEPLOYER, "bitflow-adapter"),
      uintCV(2500),
    ],
    "Add strategy: Bitflow LP (25%)"
  );
  if (!ok) return;

  // Step 4: Add Hermetica strategy (2500 bps)
  console.log("--- Step 4: Add Hermetica strategy ---");
  ok = await sendTx(
    "strategy-router",
    "add-strategy",
    [
      stringAsciiCV("Hermetica hBTC"),
      contractPrincipalCV(DEPLOYER, "hermetica-adapter"),
      uintCV(2500),
    ],
    "Add strategy: Hermetica hBTC (25%)"
  );
  if (!ok) return;

  // Step 5: Whitelist all 4 adapters as rebalance targets in vault-core
  console.log("--- Step 5: Whitelist adapters as rebalance targets ---");
  const adapters = ["zest-adapter", "stackingdao-adapter", "bitflow-adapter", "hermetica-adapter"];
  for (const adapter of adapters) {
    ok = await sendTx(
      "vault-core",
      "add-whitelisted-target",
      [contractPrincipalCV(DEPLOYER, adapter)],
      `Whitelist ${adapter} as rebalance target`
    );
    if (!ok) return;
  }

  console.log("\n=== Setup Complete! ===");
  console.log("Strategy allocations: Zest 25%, StackingDAO 25%, Bitflow 25%, Hermetica 25%");
  console.log("All adapters whitelisted as rebalance targets in vault-core.");
}

main().catch(console.error);
