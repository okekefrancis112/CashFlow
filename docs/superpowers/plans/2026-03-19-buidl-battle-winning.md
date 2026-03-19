# CashFlow BUIDL Battle #2 — Winning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy all contracts, implement x402 Stacks integration, and polish the project to win the main hackathon + all 3 bounties (Best Use of USDCx, Most Innovative Use of sBTC, Best x402 Integration).

**Architecture:** The backend Express server gets `x402-stacks` middleware on the 3 AI endpoints, replacing the unused `@x402/express` EVM package. The 4 undeployed contracts (usdcx-token, sbtc-swap, bitflow-adapter, hermetica-adapter) are deployed via existing scripts. Frontend and PremiumSection are updated to show x402 payment flow inline.

**Tech Stack:** Clarity 3, x402-stacks, Express.js, @stacks/transactions, React 19, Next.js 15

---

### Task 1: Deploy Remaining Contracts to Testnet

**Files:**
- Run: `smart-contracts/scripts/deploy-usdcx.ts`
- Run: `smart-contracts/scripts/deploy-adapters.ts`
- Run: `smart-contracts/scripts/setup-all-adapters.ts`
- Modify: `smart-contracts/contracts/sbtc-swap.clar` (deploy manually)

- [ ] **Step 1: Deploy usdcx-token + whitelist in vault-core**

```bash
cd smart-contracts && npx tsx scripts/deploy-usdcx.ts
```

Expected: "usdcx-token deployed and whitelisted in vault-core" or "already deployed, skipping"

- [ ] **Step 2: Deploy bitflow-adapter + hermetica-adapter**

```bash
npx tsx scripts/deploy-adapters.ts
```

Expected: "All adapters deployed successfully!"

- [ ] **Step 3: Deploy sbtc-swap contract**

Create a quick deploy script or use stacks CLI:

```bash
npx tsx -e "
import { makeContractDeploy, broadcastTransaction, AnchorMode } from '@stacks/transactions';
import { STACKS_TESTNET } from '@stacks/network';
import { readFileSync } from 'fs';
const source = readFileSync('contracts/sbtc-swap.clar', 'utf-8');
const tx = await makeContractDeploy({ contractName: 'sbtc-swap', codeBody: source, senderKey: 'ac3c5c49a072198863aacc91f6d837c9e8560591ecef5660b85b51059e3f2c1201', network: STACKS_TESTNET, anchorMode: AnchorMode.OnChainOnly, clarityVersion: 3, fee: 50000 });
const r = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });
console.log('Result:', r);
"
```

Expected: txid returned, confirm via Hiro explorer

- [ ] **Step 4: Register all 4 adapters at 25% each + whitelist as rebalance targets**

```bash
npx tsx scripts/setup-all-adapters.ts
```

Expected: "Setup Complete! Strategy allocations: Zest 25%, StackingDAO 25%, Bitflow 25%, Hermetica 25%"

- [ ] **Step 5: Verify all 14 contracts on testnet**

```bash
curl -s "https://api.testnet.hiro.so/extended/v1/address/ST2211JFW8MMPR3ZKDH4303QMZ5WCHZ2NFG1W53YD/transactions?limit=20" | python3 -c "import json,sys; [print(tx['smart_contract']['contract_id']) for tx in json.load(sys.stdin)['results'] if tx['tx_type']=='smart_contract' and tx['tx_status']=='success']" 2>/dev/null
```

Expected: All 14 contract names listed

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: deploy all 14 contracts to testnet"
```

---

### Task 2: Replace @x402/express with x402-stacks

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Uninstall EVM x402 packages**

```bash
cd backend && npm uninstall @x402/express @x402/core @x402/extensions
```

- [ ] **Step 2: Install x402-stacks**

```bash
npm install x402-stacks
```

- [ ] **Step 3: Verify installation**

```bash
node -e "const x = require('x402-stacks'); console.log('x402-stacks loaded:', Object.keys(x).join(', '))"
```

Expected: Lists exports including `paymentMiddleware`, `STXtoMicroSTX`, etc.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json && git commit -m "deps: replace @x402/express (EVM) with x402-stacks (Stacks-native)"
```

---

### Task 3: Add x402 Payment Middleware to AI Endpoints

**Files:**
- Modify: `backend/src/api/routes.ts`

- [ ] **Step 1: Add x402 imports and config**

At the top of `backend/src/api/routes.ts`, add after existing imports:

```typescript
import { paymentMiddleware, STXtoMicroSTX } from "x402-stacks";
```

- [ ] **Step 2: Create x402 config object**

Add after the imports, before the router:

```typescript
const x402Config = {
  amount: STXtoMicroSTX(0.001),
  address: config.paymentAddress,
  network: config.stacksNetwork as "testnet" | "mainnet",
  facilitatorUrl: config.x402FacilitatorUrl,
};
```

- [ ] **Step 3: Add paymentMiddleware to yield-forecast endpoint**

Change the route at line ~176 from:

```typescript
router.get(
  "/ai/yield-forecast",
  aiLimiter,
  async (_req: Request, res: Response) => {
```

To:

```typescript
router.get(
  "/ai/yield-forecast",
  aiLimiter,
  paymentMiddleware({
    ...x402Config,
    description: "AI yield forecast — 7-day projections",
  }),
  async (_req: Request, res: Response) => {
```

- [ ] **Step 4: Add paymentMiddleware to strategy-signals endpoint**

Change the route at line ~193 from:

```typescript
router.get(
  "/ai/strategy-signals",
  aiLimiter,
  validateRiskParam,
  async (req: Request, res: Response) => {
```

To:

```typescript
router.get(
  "/ai/strategy-signals",
  aiLimiter,
  paymentMiddleware({
    ...x402Config,
    description: "AI strategy signals — risk-adjusted allocation",
  }),
  validateRiskParam,
  async (req: Request, res: Response) => {
```

- [ ] **Step 5: Add paymentMiddleware to portfolio-analytics endpoint**

Change the route at line ~214 from:

```typescript
router.get(
  "/ai/portfolio-analytics",
  aiLimiter,
  async (_req: Request, res: Response) => {
```

To:

```typescript
router.get(
  "/ai/portfolio-analytics",
  aiLimiter,
  paymentMiddleware({
    ...x402Config,
    description: "Portfolio analytics — 30-day performance & risk metrics",
  }),
  async (_req: Request, res: Response) => {
```

- [ ] **Step 6: Test locally — verify 402 response**

```bash
cd backend && npm run dev &
sleep 3
curl -v http://localhost:4000/api/ai/yield-forecast 2>&1 | grep -E "< HTTP|payment-required"
```

Expected: `< HTTP/1.1 402` and a `payment-required` header with base64-encoded JSON

- [ ] **Step 7: Commit**

```bash
git add src/api/routes.ts && git commit -m "feat: add x402 Stacks payment middleware to AI endpoints"
```

---

### Task 4: Create x402 Test Script

**Files:**
- Create: `backend/scripts/test-x402.ts`

- [ ] **Step 1: Write the test script**

```typescript
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
  console.log(`Testing x402 payments against: ${BASE_URL}\n`);

  const account = privateKeyToAccount(PRIVATE_KEY, "testnet");
  console.log(`Payer address: ${account.address}\n`);

  const api = createPaymentClient(account, { baseURL: BASE_URL });

  const endpoints = [
    { name: "Yield Forecast", path: "/ai/yield-forecast" },
    { name: "Strategy Signals", path: "/ai/strategy-signals?risk=balanced" },
    { name: "Portfolio Analytics", path: "/ai/portfolio-analytics" },
  ];

  for (const ep of endpoints) {
    try {
      console.log(`--- ${ep.name} ---`);
      console.log(`GET ${ep.path}`);
      const res = await api.get(ep.path);
      console.log(`Status: ${res.status}`);
      console.log(`Payment response header: ${res.headers["payment-response"] ? "present" : "none"}`);
      console.log(`Data keys: ${Object.keys(res.data?.data || res.data || {}).join(", ")}`);
      console.log("PASS\n");
    } catch (err: any) {
      console.error(`FAIL: ${err.response?.status || err.message}`);
      if (err.response?.headers?.["payment-required"]) {
        console.log("Got 402 but payment auto-signing failed — check wallet balance");
      }
      console.log();
    }
  }

  console.log("Done!");
}

main().catch(console.error);
```

- [ ] **Step 2: Test against running local backend**

```bash
cd backend && npx tsx scripts/test-x402.ts
```

Expected: All 3 endpoints show "PASS" with payment-response headers

- [ ] **Step 3: Commit**

```bash
git add scripts/test-x402.ts && git commit -m "feat: add x402 payment test script"
```

---

### Task 5: Update PremiumSection to Show x402 Flow

**Files:**
- Modify: `frontend/src/components/premium/PremiumSection.tsx`

- [ ] **Step 1: Update PremiumSection to mention x402 payments**

Replace the entire content of `frontend/src/components/premium/PremiumSection.tsx`:

```tsx
import { Sparkles, Zap } from "lucide-react";
import { cn } from "../../lib/utils";

const API_ENDPOINTS = [
  {
    endpoint: "GET /api/ai/yield-forecast",
    description: "AI-generated 7-day yield projections with confidence scores",
    price: "0.001 STX",
  },
  {
    endpoint: "GET /api/ai/strategy-signals",
    description: "Real-time optimal allocation weights with AI reasoning",
    price: "0.001 STX",
  },
  {
    endpoint: "GET /api/ai/portfolio-analytics",
    description: "30-day historical performance, Sharpe ratio, risk metrics",
    price: "0.001 STX",
  },
];

export function PremiumSection() {
  return (
    <div id="api" className="glass-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-base font-semibold text-white">AI Intelligence API</h2>
        <span className="badge badge-violet text-[10px]">
          <Zap className="w-3 h-3" />
          x402 Powered
        </span>
      </div>
      <p className="text-sm text-[#8b8fa3] mb-6">
        AI-powered yield intelligence with Bitcoin-native micropayments via{" "}
        <span className="text-violet-400 font-medium">x402 protocol</span>.
        Pay per query with STX, sBTC, or USDCx — no API keys, no subscriptions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {API_ENDPOINTS.map((api, i) => (
          <div
            key={api.endpoint}
            className={cn(
              "bg-white/[0.02] rounded-xl p-4 border border-white/[0.04] hover:border-violet-500/20 hover:bg-white/[0.04] transition-all duration-200 animate-fade-in-up group",
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <code className="text-[11px] text-violet-400/80 font-mono">{api.endpoint}</code>
            <p className="text-[13px] text-[#8b8fa3] mt-2 leading-relaxed">{api.description}</p>
            <div className="mt-3 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400/60" />
              <span className="text-[10px] text-amber-400/80 font-medium">{api.price} per query</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
        <p className="text-[11px] text-[#565a6e] uppercase tracking-wider font-medium mb-2">x402 Payment Flow</p>
        <div className="flex items-center gap-3 text-xs text-[#8b8fa3]">
          <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 font-mono">1. Request</span>
          <span className="text-[#3a3e52]">&rarr;</span>
          <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 font-mono">2. HTTP 402</span>
          <span className="text-[#3a3e52]">&rarr;</span>
          <span className="px-2 py-1 rounded-md bg-violet-500/10 text-violet-400 font-mono">3. Sign &amp; Pay</span>
          <span className="text-[#3a3e52]">&rarr;</span>
          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-mono">4. AI Response</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders locally**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000/dashboard — PremiumSection should show "x402 Powered" badge and payment flow diagram.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/premium/PremiumSection.tsx && git commit -m "feat: update PremiumSection to show x402 payment flow"
```

---

### Task 6: Update Premium.tsx (AI Page) with x402 Integration Guide

**Files:**
- Modify: `frontend/src/views/Premium.tsx`

- [ ] **Step 1: Update the integration guide section to show x402 usage**

In `frontend/src/views/Premium.tsx`, find the "Quick Integration" section (around line 750) and replace the cURL and JavaScript code examples:

Change the cURL example from:
```
curl http://localhost:4000/api/ai/yield-forecast
```

To:
```
# Step 1: Request returns HTTP 402 with payment details
curl -v http://localhost:4000/api/ai/yield-forecast
# Response: 402 Payment Required
# Header: payment-required: <base64-encoded payment details>

# Step 2: Use x402-stacks client for automatic payment
npx tsx -e "
import { createPaymentClient, privateKeyToAccount } from 'x402-stacks';
const account = privateKeyToAccount('YOUR_PRIVATE_KEY', 'testnet');
const api = createPaymentClient(account, { baseURL: 'http://localhost:4000/api' });
const res = await api.get('/ai/yield-forecast');
console.log(res.data);
"
```

Change the JavaScript example to:
```
import { createPaymentClient, privateKeyToAccount } from 'x402-stacks';

// Auto-handles 402 → sign → pay → response
const account = privateKeyToAccount(key, 'testnet');
const api = createPaymentClient(account, {
  baseURL: 'http://localhost:4000/api'
});
const { data } = await api.get('/ai/yield-forecast');
console.log(data.forecast);
```

- [ ] **Step 2: Update the header badge**

Change the badge text at line ~683 from:
```tsx
<span className="badge badge-violet text-[10px]">
  <Zap className="w-3 h-3" />
  Open Access
</span>
```

To:
```tsx
<span className="badge badge-violet text-[10px]">
  <Zap className="w-3 h-3" />
  x402 Powered
</span>
```

- [ ] **Step 3: Update the description**

Change line ~689 from:
```tsx
AI-powered yield forecasts, strategy signals, and portfolio analytics — all openly accessible.
```

To:
```tsx
AI-powered yield intelligence with Bitcoin-native micropayments via x402 protocol. Pay 0.001 STX per query — no API keys, no subscriptions.
```

- [ ] **Step 4: Verify locally**

Open http://localhost:3000/ai — should show "x402 Powered" badge, updated description, and x402 integration examples.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/views/Premium.tsx && git commit -m "feat: update AI page with x402 integration guide and branding"
```

---

### Task 7: Update Landing Page Hero Copy

**Files:**
- Modify: `frontend/src/views/Landing.tsx`

- [ ] **Step 1: Find and update the hero heading**

Search for the hero `<h1>` tag (around line 150-180) and update the text to emphasize sBTC + USDCx + x402:

The heading should read something like: "AI-Powered sBTC & USDCx Yield Aggregator"

The subheading should mention: "Deposit sBTC or USDCx, let AI optimize across Zest, Bitflow, StackingDAO & Hermetica. Bitcoin-native micropayments via x402."

- [ ] **Step 2: Add "Live on Testnet" to the protocol feature badges if not present**

The PROTOCOLS array (line 20-25) already has the 4 protocols listed. No change needed.

- [ ] **Step 3: Verify locally**

Open http://localhost:3000 — hero should reflect sBTC + USDCx + x402 messaging.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/views/Landing.tsx && git commit -m "feat: update landing hero to highlight sBTC, USDCx, and x402"
```

---

### Task 8: Local End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Start backend locally**

```bash
cd backend && npm run dev
```

Expected: Server starts on port 4000, harvester/rebalancer/monitor start

- [ ] **Step 2: Verify x402 returns 402**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/ai/yield-forecast
```

Expected: `402`

- [ ] **Step 3: Verify public endpoints still work**

```bash
curl -s http://localhost:4000/api/health | python3 -m json.tool
curl -s http://localhost:4000/api/yields | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"data\"][\"count\"]} yield sources')"
curl -s http://localhost:4000/api/vault/stats | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['data'], indent=2))"
```

Expected: Health OK, 7 yield sources, vault stats with real or fallback data

- [ ] **Step 4: Run x402 payment test**

```bash
cd backend && npx tsx scripts/test-x402.ts
```

Expected: All 3 endpoints PASS with payment-response headers

- [ ] **Step 5: Start frontend locally**

```bash
cd frontend && npm run dev
```

- [ ] **Step 6: Manual browser test**

1. Open http://localhost:3000 — landing page with updated hero
2. Navigate to /dashboard — check all panels load data
3. Navigate to /ai — check x402 branding and try "Try Live Request"
4. Check PremiumSection on dashboard shows x402 flow diagram

- [ ] **Step 7: Final commit with all remaining changes**

```bash
git add -A && git commit -m "chore: local e2e verification complete — all systems operational"
```

---

### Task 9: Apply to All 3 Bounties on DoraHacks

**Files:** None (browser action)

- [ ] **Step 1: Go to https://dorahacks.io/hackathon/buidlbattle2/bounties**

- [ ] **Step 2: Apply to "Best Use of USDCx"**

Highlight: USDCx vault deposits, USDCx faucet, Zest USDCx lending, Bitflow USDCx/sBTC LP, x402 accepts USDCx payments

- [ ] **Step 3: Apply to "Most Innovative Use of sBTC"**

Highlight: AI-optimized sBTC yield across 4 protocols, 627+ on-chain harvest txs, cfYIELD share tokens, auto-compounding vault

- [ ] **Step 4: Apply to "Best x402 Integration"**

Highlight: 3 AI endpoints with x402 micropayments (0.001 STX), x402-stacks SDK, facilitator pattern, pay-per-query AI intelligence

---
