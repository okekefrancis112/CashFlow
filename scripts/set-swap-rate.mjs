import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  AnchorMode,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

const DEPLOYER = "ST2211JFW8MMPR3ZKDH4303QMZ5WCHZ2NFG1W53YD";
const MNEMONIC =
  "reward fly pretty shadow express fossil appear bounce stool agent blossom duty";

async function getPrivateKey() {
  const { generateWallet } = await import("@stacks/wallet-sdk");
  const wallet = await generateWallet({ secretKey: MNEMONIC, password: "" });
  return wallet.accounts[0].stxPrivateKey;
}

async function getNonce() {
  const res = await fetch(`https://api.testnet.hiro.so/extended/v1/address/${DEPLOYER}/nonces`);
  const data = await res.json();
  return data.possible_next_nonce;
}

async function main() {
  const privateKey = await getPrivateKey();
  const nonce = await getNonce();

  // New rate: 10000 micro-sBTC per 1 STX = 0.01 sBTC per STX
  // So 10 STX = 0.1 sBTC
  console.log("Setting swap rate to 10000 (10 STX = 0.1 sBTC)...");

  const tx = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName: "sbtc-swap",
    functionName: "set-rate",
    functionArgs: [uintCV(10000)],
    senderKey: privateKey,
    network: STACKS_TESTNET,
    anchorMode: AnchorMode.Any,
    fee: 50000n,
    nonce: BigInt(nonce),
  });

  const result = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });
  console.log(`TX: ${result.txid || JSON.stringify(result)}`);
}

main().catch(console.error);
