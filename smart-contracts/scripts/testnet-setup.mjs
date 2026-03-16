/**
 * Testnet setup script — sends 3 contract calls:
 * 1. vault-core: add-whitelisted-token (sbtc-token)
 * 2. yield-token: set-authorized-minter (vault-core)
 * 3. sbtc-token: mint 100 sBTC to deployer wallet
 */

import {
  makeContractCall,
  broadcastTransaction,
  contractPrincipalCV,
  uintCV,
  standardPrincipalCV,
  AnchorMode,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

const DEPLOYER = "ST2211JFW8MMPR3ZKDH4303QMZ5WCHZ2NFG1W53YD";
const MNEMONIC =
  "reward fly pretty shadow express fossil appear bounce stool agent blossom duty";

// Derive private key from mnemonic
async function getPrivateKey() {
  const { generateWallet } = await import("@stacks/wallet-sdk");
  const wallet = await generateWallet({
    secretKey: MNEMONIC,
    password: "",
  });
  return wallet.accounts[0].stxPrivateKey;
}

async function sendContractCall({ contractName, functionName, functionArgs, nonce }) {
  const privateKey = await getPrivateKey();

  const txOptions = {
    contractAddress: DEPLOYER,
    contractName,
    functionName,
    functionArgs,
    senderKey: privateKey,
    network: STACKS_TESTNET,
    anchorMode: AnchorMode.Any,
    fee: 50000n, // 0.05 STX
    nonce: BigInt(nonce),
  };

  const tx = await makeContractCall(txOptions);
  const result = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });
  return result;
}

async function getNonce() {
  const res = await fetch(
    `https://api.testnet.hiro.so/extended/v1/address/${DEPLOYER}/nonces`
  );
  const data = await res.json();
  return data.possible_next_nonce;
}

async function main() {
  let nonce = await getNonce();
  console.log(`Starting nonce: ${nonce}\n`);

  // 1. Whitelist sbtc-token in vault-core
  console.log("1. Whitelisting sbtc-token in vault-core...");
  const r1 = await sendContractCall({
    contractName: "vault-core",
    functionName: "add-whitelisted-token",
    functionArgs: [contractPrincipalCV(DEPLOYER, "sbtc-token")],
    nonce: nonce++,
  });
  console.log(`   TX: ${r1.txid || JSON.stringify(r1)}\n`);

  // 2. Set vault-core as authorized minter on yield-token
  console.log("2. Setting vault-core as authorized minter on yield-token...");
  const r2 = await sendContractCall({
    contractName: "yield-token",
    functionName: "set-authorized-minter",
    functionArgs: [contractPrincipalCV(DEPLOYER, "vault-core")],
    nonce: nonce++,
  });
  console.log(`   TX: ${r2.txid || JSON.stringify(r2)}\n`);

  // 3. Mint 100 sBTC (100_000_000 micro) to deployer
  console.log("3. Minting 100 sBTC to deployer wallet...");
  const r3 = await sendContractCall({
    contractName: "sbtc-token",
    functionName: "mint",
    functionArgs: [
      uintCV(100_000_000), // 100 sBTC (6 decimals)
      standardPrincipalCV(DEPLOYER),
    ],
    nonce: nonce++,
  });
  console.log(`   TX: ${r3.txid || JSON.stringify(r3)}\n`);

  console.log("✅ All setup transactions broadcasted!");
  console.log("Wait ~1-2 minutes for testnet confirmation.");
}

main().catch(console.error);
