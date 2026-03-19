import {
  callReadOnlyFunction,
  cvToJSON,
  uintCV,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

const DEPLOYER = "ST2211JFW8MMPR3ZKDH4303QMZ5WCHZ2NFG1W53YD";

async function check() {
  const count = await callReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName: "strategy-router",
    functionName: "get-strategy-count",
    functionArgs: [],
    network: STACKS_TESTNET,
    senderAddress: DEPLOYER,
  });
  const countVal = cvToJSON(count);
  console.log("Strategy count:", JSON.stringify(countVal));

  const n = parseInt(countVal?.value ?? "0", 10);
  for (let i = 0; i < n; i++) {
    const strat = await callReadOnlyFunction({
      contractAddress: DEPLOYER,
      contractName: "strategy-router",
      functionName: "get-strategy",
      functionArgs: [uintCV(i)],
      network: STACKS_TESTNET,
      senderAddress: DEPLOYER,
    });
    console.log(`Strategy ${i}:`, JSON.stringify(cvToJSON(strat)));
  }
}
check().catch(console.error);
