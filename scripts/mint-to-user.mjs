/**
 * Mint sBTC to a user wallet on testnet
 * Usage: node scripts/mint-to-user.mjs <address> [amount]
 * Amount defaults to 100 sBTC (100_000_000 micro)
 */
import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  standardPrincipalCV,
  AnchorMode,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

const DEPLOYER = "ST2211JFW8MMPR3ZKDH4303QMZ5WCHZ2NFG1W53YD";
const MNEMONIC =
  "reward fly pretty shadow express fossil appear bounce stool agent blossom duty";

const USER_ADDRESS = process.argv[2];
const AMOUNT = parseInt(process.argv[3] || "100000000", 10);

if (!USER_ADDRESS) {
  console.error("Usage: node scripts/mint-to-user.mjs <stacks-address> [amount-in-micro]");
  process.exit(1);
}

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
  const nonce = await getNonce();

  console.log(`Minting ${AMOUNT / 1_000_000} sBTC to ${USER_ADDRESS}...`);

  const tx = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName: "sbtc-token",
    functionName: "mint",
    functionArgs: [
      uintCV(AMOUNT),
      standardPrincipalCV(USER_ADDRESS),
    ],
    senderKey: privateKey,
    network: STACKS_TESTNET,
    anchorMode: AnchorMode.Any,
    fee: 50000n,
    nonce: BigInt(nonce),
  });

  const result = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });
  console.log(`TX: ${result.txid || JSON.stringify(result)}`);
  console.log("Wait ~1-2 minutes for testnet confirmation.");
}

main().catch(console.error);
