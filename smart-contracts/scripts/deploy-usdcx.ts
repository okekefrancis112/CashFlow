/**
 * Deploy usdcx-token contract to Stacks testnet and whitelist it in vault-core.
 *
 * Usage: npx tsx scripts/deploy-usdcx.ts
 */
import {
  makeContractDeploy,
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  contractPrincipalCV,
  PostConditionMode,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname_resolved = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));

const PRIVATE_KEY = "ac3c5c49a072198863aacc91f6d837c9e8560591ecef5660b85b51059e3f2c1201";
const DEPLOYER = "ST2211JFW8MMPR3ZKDH4303QMZ5WCHZ2NFG1W53YD";
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
      if (data.tx_status === "success") {
        console.log(`${label} confirmed!`);
        return true;
      }
      if (data.tx_status === "abort_by_response" || data.tx_status === "abort_by_post_condition") {
        console.error(`${label} failed on-chain:`, data.tx_result);
        return false;
      }
      process.stdout.write(".");
    } catch {
      process.stdout.write("x");
    }
  }
  console.error(`${label} timed out`);
  return false;
}

async function main() {
  // Step 1: Deploy usdcx-token
  console.log("\nStep 1: Deploying usdcx-token contract...\n");

  const contractSource = readFileSync(
    join(__dirname_resolved, "../contracts/usdcx-token.clar"),
    "utf-8"
  );

  const deployTx = await makeContractDeploy({
    contractName: "usdcx-token",
    codeBody: contractSource,
    senderKey: PRIVATE_KEY,
    network,
    anchorMode: AnchorMode.OnChainOnly,
    clarityVersion: 3,
    fee: 50_000,
  });

  const deployResult = await broadcastTransaction({ transaction: deployTx, network });

  if ("error" in deployResult) {
    const reason = (deployResult as any).reason || "";
    if (reason.includes("ContractAlreadyExists")) {
      console.log("usdcx-token already deployed, skipping to whitelist step...");
    } else {
      console.error("Broadcast failed:", deployResult);
      return;
    }
  } else {
    const deployTxId = typeof deployResult === "string" ? deployResult : deployResult.txid;
    const ok = await waitForTx(deployTxId, "usdcx-token deploy");
    if (!ok) return;
  }

  // Step 2: Whitelist usdcx-token in vault-core
  console.log("\nStep 2: Whitelisting usdcx-token in vault-core...\n");

  const whitelistTx = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName: "vault-core",
    functionName: "add-whitelisted-token",
    functionArgs: [contractPrincipalCV(DEPLOYER, "usdcx-token")],
    senderKey: PRIVATE_KEY,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 20_000,
  });

  const whitelistResult = await broadcastTransaction({ transaction: whitelistTx, network });

  if ("error" in whitelistResult) {
    console.error("Whitelist broadcast failed:", whitelistResult);
    return;
  }

  const whitelistTxId = typeof whitelistResult === "string" ? whitelistResult : whitelistResult.txid;
  const ok2 = await waitForTx(whitelistTxId, "whitelist usdcx-token");
  if (!ok2) return;

  console.log("\nDone! usdcx-token deployed and whitelisted in vault-core.\n");
}

main().catch(console.error);
