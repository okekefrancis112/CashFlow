/**
 * Deploy sbtc-swap contract to Stacks testnet.
 * Usage: npx tsx scripts/deploy-sbtc-swap.ts
 */
import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname_resolved = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const PRIVATE_KEY = "ac3c5c49a072198863aacc91f6d837c9e8560591ecef5660b85b51059e3f2c1201";
const network = STACKS_TESTNET;
const API = "https://api.testnet.hiro.so";

async function waitForTx(txId: string, label: string) {
  console.log(`Waiting for ${label} tx: ${txId}`);
  console.log(`Explorer: https://explorer.hiro.so/txid/${txId}?chain=testnet`);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    try {
      const res = await fetch(`${API}/extended/v1/tx/${txId}`);
      const data = await res.json();
      if (data.tx_status === "success") { console.log(`\n${label} confirmed!`); return true; }
      if (data.tx_status === "abort_by_response" || data.tx_status === "abort_by_post_condition") {
        console.error(`\n${label} failed:`, data.tx_result); return false;
      }
      process.stdout.write(".");
    } catch { process.stdout.write("x"); }
  }
  console.error(`\n${label} timed out`);
  return false;
}

async function main() {
  console.log("Deploying sbtc-swap...");
  const source = readFileSync(join(__dirname_resolved, "../contracts/sbtc-swap.clar"), "utf-8");
  const tx = await makeContractDeploy({
    contractName: "sbtc-swap",
    codeBody: source,
    senderKey: PRIVATE_KEY,
    network,
    anchorMode: AnchorMode.OnChainOnly,
    clarityVersion: 3,
    fee: 50_000,
  });
  const result = await broadcastTransaction({ transaction: tx, network });
  if ("error" in result) {
    const reason = (result as any).reason || "";
    if (reason.includes("ContractAlreadyExists")) { console.log("sbtc-swap already deployed."); return; }
    console.error("Broadcast failed:", result); return;
  }
  const txId = typeof result === "string" ? result : result.txid;
  await waitForTx(txId, "sbtc-swap deploy");
}

main().catch(console.error);
