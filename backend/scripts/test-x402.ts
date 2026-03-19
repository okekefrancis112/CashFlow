/**
 * Test x402 payment flow against local or remote backend.
 *
 * Usage: npx tsx scripts/test-x402.ts [base-url]
 * Default base URL: http://localhost:4000/api
 */
import { createPaymentClient, privateKeyToAccount } from "x402-stacks";

const BASE_URL = process.argv[2] || "http://localhost:4000/api";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "ac3c5c49a072198863aacc91f6d837c9e8560591ecef5660b85b51059e3f2c1201";

async function main() {
  console.log(`\nTesting x402 payments against: ${BASE_URL}\n`);

  const account = privateKeyToAccount(PRIVATE_KEY, "testnet");
  console.log(`Payer address: ${account.address}\n`);

  const api = createPaymentClient(account, { baseURL: BASE_URL });

  const endpoints = [
    { name: "Yield Forecast", path: "/ai/yield-forecast" },
    { name: "Strategy Signals", path: "/ai/strategy-signals?risk=balanced" },
    { name: "Portfolio Analytics", path: "/ai/portfolio-analytics" },
  ];

  let passed = 0;
  for (let i = 0; i < endpoints.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 25_000)); // Hiro fee-estimation rate limit
    const ep = endpoints[i];
    try {
      console.log(`--- ${ep.name} ---`);
      console.log(`GET ${ep.path}`);
      const res = await api.get(ep.path);
      console.log(`Status: ${res.status}`);
      console.log(`Payment response header: ${res.headers["payment-response"] ? "present" : "none"}`);
      console.log(`Data keys: ${Object.keys(res.data?.data || res.data || {}).join(", ")}`);
      console.log("PASS\n");
      passed++;
    } catch (err: any) {
      const status = err.response?.status || err.status;
      const msg = err.response?.data?.error?.message || err.message || String(err);
      console.error(`FAIL: ${status || msg}`);
      if (msg.includes("fee")) console.log("  → Hiro fee estimation rate-limited. Wait and retry.");
      if (err.response?.headers?.["payment-required"]) {
        console.log("  → Got 402 but payment auto-signing failed — check wallet balance");
      }
      console.log();
    }
  }

  console.log(`\nResults: ${passed}/${endpoints.length} passed`);
}

main().catch(console.error);
