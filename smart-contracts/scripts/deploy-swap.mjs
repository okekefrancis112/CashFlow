/**
 * Deploy sbtc-swap contract to testnet, then mint sBTC to its pool
 */
import {
  makeContractDeploy,
  makeContractCall,
  broadcastTransaction,
  uintCV,
  contractPrincipalCV,
  AnchorMode,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";
import { readFileSync } from "fs";

const DEPLOYER = "ST2211JFW8MMPR3ZKDH4303QMZ5WCHZ2NFG1W53YD";
const MNEMONIC =
  "reward fly pretty shadow express fossil appear bounce stool agent blossom duty";

async function getPrivateKey() {
  const { generateWallet } = await import("@stacks/wallet-sdk");
  const wallet = await generateWallet({
    secretKey: MNEMONIC,
    password: "",
  });
  return wallet.accounts[0].stxPrivateKey;
}

async function getNonce() {
  const res = await fetch(
    `https://api.testnet.hiro.so/extended/v1/address/${DEPLOYER}/nonces`
  );
  const data = await res.json();
  return data.possible_next_nonce;
}

async function main() {
  const privateKey = await getPrivateKey();
  let nonce = await getNonce();

  // 1. Deploy sbtc-swap contract
  const code = readFileSync("contracts/sbtc-swap.clar", "utf-8");
  console.log("1. Deploying sbtc-swap contract...");

  const deployTx = await makeContractDeploy({
    contractName: "sbtc-swap",
    codeBody: code,
    senderKey: privateKey,
    network: STACKS_TESTNET,
    anchorMode: AnchorMode.OnChainOnly,
    fee: 300000n,
    nonce: BigInt(nonce++),
    clarityVersion: 3,
  });

  const deployResult = await broadcastTransaction({ transaction: deployTx, network: STACKS_TESTNET });
  console.log(`   TX: ${deployResult.txid || JSON.stringify(deployResult)}\n`);

  // 2. Mint 10,000 sBTC to the swap contract pool
  console.log("2. Minting 10,000 sBTC to swap contract pool...");
  const mintTx = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName: "sbtc-token",
    functionName: "mint",
    functionArgs: [
      uintCV(10_000_000_000), // 10,000 sBTC (6 decimals)
      contractPrincipalCV(DEPLOYER, "sbtc-swap"),
    ],
    senderKey: privateKey,
    network: STACKS_TESTNET,
    anchorMode: AnchorMode.Any,
    fee: 50000n,
    nonce: BigInt(nonce++),
  });

  const mintResult = await broadcastTransaction({ transaction: mintTx, network: STACKS_TESTNET });
  console.log(`   TX: ${mintResult.txid || JSON.stringify(mintResult)}\n`);

  console.log("Done! Wait ~2 minutes for confirmation, then users can swap STX for sBTC.");
  console.log(`Rate: 1 STX = 0.001 sBTC (adjustable via set-rate)`);
}

main().catch(console.error);
