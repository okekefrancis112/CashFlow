# CashFlow Production-Readiness Plan

## Context

CashFlow is an AI-powered sBTC yield aggregator currently at hackathon/MVP stage. Every data source is mocked, premium endpoints have no payment gate, the frontend is a 495-line monolith with fake wallet connection, and the smart contracts have several security gaps (no emergency withdrawal, unvalidated rebalance targets, dual-auth vulnerability in token minting). This plan takes the project to production across three phases: security fixes, production hardening, and a complete frontend overhaul.

**This plan lives at `/Users/user/Desktop/Projects/cashFlow/plan.md`** and is the single source of truth throughout implementation. Refer to it at every phase transition.

---

## Phase 0: Setup — Plan File + Reference Screenshots

Before any code changes, establish the reference materials.

### 0.1 Create plan.md at project root
- Copy this plan to `/Users/user/Desktop/Projects/cashFlow/plan.md`
- This file is the living document — update it as phases complete (mark tasks done with ~~strikethrough~~ or checkboxes)

### 0.2 Capture Reference DeFi App Screenshots (Playwright)

Use Playwright MCP to screenshot the production DeFi apps we're modeling after. Save to `screenshots/references/`:

| File | URL | What to capture |
|------|-----|-----------------|
| `screenshots/references/stackingdao-home.png` | https://www.stackingdao.com/ | Hero stat cards, dark theme, staking cards, color scheme |
| `screenshots/references/stackingdao-app.png` | https://app.stackingdao.com/ | Staking dashboard, deposit UI, stats layout |
| `screenshots/references/zest-home.png` | https://www.zestprotocol.com/ | Landing page, warm gradient accent, audit badges |
| `screenshots/references/zest-app.png` | https://app.zestprotocol.com/ | Lending dashboard, pool cards, APY display |
| `screenshots/references/beefy-vaults.png` | https://app.beefy.finance/ | Vault list, sortable table, filter bar, dark theme |
| `screenshots/references/yearn-vaults.png` | https://yearn.fi/v3 | Vault cards, deposit panel, theme system |
| `screenshots/references/pendle-dashboard.png` | https://app.pendle.finance/trade/dashboard | Portfolio overview, P&L, position cards |

### 0.3 Screenshot Our Current Frontend

Capture the starting state for before/after comparison:

| File | What |
|------|------|
| `screenshots/before/current-dashboard.png` | Current App.tsx rendered at 1280px |
| `screenshots/before/current-mobile.png` | Current App.tsx at 375px mobile |

### 0.4 Progress Screenshots During Build

During Phase 3 implementation, capture progress shots:
- `screenshots/progress/phase3-infrastructure.png` — After Tailwind install + cleanup
- `screenshots/progress/phase3-components.png` — After component decomposition
- `screenshots/progress/phase3-wallet.png` — After wallet integration
- `screenshots/progress/phase3-charts.png` — After charts added
- `screenshots/progress/phase3-final-desktop.png` — Final desktop (1280px)
- `screenshots/progress/phase3-final-tablet.png` — Final tablet (768px)
- `screenshots/progress/phase3-final-mobile.png` — Final mobile (375px)

Compare each progress shot against the reference screenshots to ensure we're converging toward the target design.

---

## Phase 1: Security-Critical Fixes

### 1.1 Smart Contract Security

**1.1.1 Emergency Withdrawal** — [vault-core.clar](contracts/vault-core.clar)
- Add `emergency-withdraw` public function that bypasses the `not-paused` guard but keeps all balance checks
- Users must never have funds trapped when vault is paused

**1.1.2 Rebalance Target Validation** — [vault-core.clar](contracts/vault-core.clar)
- Add `whitelisted-targets` map + `add-whitelisted-target` / `remove-whitelisted-target` owner functions
- Assert target is whitelisted in `rebalance` before transferring

**1.1.3 Yield Token Auth Fix** — [yield-token.clar](contracts/yield-token.clar)
- Remove `(is-eq tx-sender CONTRACT-OWNER)` fallback from `mint` and `burn`
- Authorization must be ONLY via `contract-caller` matching `authorized-minter`
- Prevents any contract called by the owner from minting/burning tokens

**1.1.4 Strategy Re-activation Bug** — [strategy-router.clar](contracts/strategy-router.clar)
- Add `strategy-saved-allocation` map to preserve allocation before deactivation
- Split `toggle-strategy` into `deactivate-strategy` (saves + zeros allocation) and `activate-strategy` (restores allocation)

**1.1.5 Per-Block Rate Limiting** — [vault-core.clar](contracts/vault-core.clar)
- Track `last-action-block` and `actions-this-block` data vars
- Cap at `MAX-ACTIONS-PER-BLOCK u10` for deposit/withdraw

### 1.2 Backend Security

**1.2.1 Wire Up x402 Payment Middleware** — [routes.ts](backend/src/api/routes.ts)
- Import and apply `paymentMiddleware` from `@x402/express` to all 3 `/premium/*` routes
- Currently package is installed but never imported — all premium endpoints are public

**1.2.2 Input Validation** — New: `backend/src/middleware/validation.ts`
- Add `zod` dependency
- Validate `risk` query param on `/premium/strategy-signals` (enum: conservative/balanced/aggressive)
- Validate any future body/query params

**1.2.3 CORS Lockdown** — [index.ts](backend/src/index.ts)
- Replace `cors()` with `cors({ origin: config.allowedOrigins })`
- Default to `["http://localhost:5173"]` for dev

**1.2.4 Global Error Handler** — New: `backend/src/middleware/error-handler.ts`
- Express error middleware mounted after all routes
- Standardize error shape: `{ success: false, error: { message, code }, timestamp }`

**1.2.5 Config Validation** — [config/index.ts](backend/src/config/index.ts)
- Validate required env vars on startup (fail fast)
- Warn for missing `OPENAI_API_KEY`, error for missing `PRIVATE_KEY` on mainnet

### 1.3 Phase 1 Smart Contract Tests

All tests use the existing pattern: `simnet.callPublicFn()` / `simnet.callReadOnlyFn()` with `Cl.*` helpers from `@stacks/transactions`. Accounts: `deployer`, `wallet_1`, `wallet_2` from `simnet.getAccounts()`.

#### New tests in [vault-core.test.ts](tests/vault-core.test.ts) (currently 7 tests → 16 tests)

```typescript
// --- Emergency Withdrawal Tests ---

it("blocks normal withdraw when vault is paused", () => {
  // Setup: whitelist yield-token, deposit from wallet_1
  simnet.callPublicFn("vault-core", "add-whitelisted-token",
    [Cl.principal(`${deployer}.yield-token`)], deployer);
  simnet.callPublicFn("yield-token", "set-authorized-minter",
    [Cl.principal(`${deployer}.vault-core`)], deployer);
  simnet.callPublicFn("vault-core", "deposit",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(1000)], wallet1);
  // Pause vault
  simnet.callPublicFn("vault-core", "pause-vault", [], deployer);
  // Normal withdraw should fail with ERR-VAULT-PAUSED (u405)
  const result = simnet.callPublicFn("vault-core", "withdraw",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(500)], wallet1);
  expect(result.result).toBeErr(Cl.uint(405));
});

it("allows emergency-withdraw when vault is paused", () => {
  // Same setup as above, vault is paused
  // emergency-withdraw should succeed
  const result = simnet.callPublicFn("vault-core", "emergency-withdraw",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(500)], wallet1);
  expect(result.result).toBeOk(Cl.uint(500));
  // Verify shares burned and balances updated
  const shares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
    [Cl.principal(wallet1)], deployer);
  expect(shares.result).toBeOk(Cl.uint(500)); // 1000 - 500
});

it("rejects emergency-withdraw for amount exceeding deposit", () => {
  // Try to withdraw more than deposited
  const result = simnet.callPublicFn("vault-core", "emergency-withdraw",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(9999)], wallet1);
  expect(result.result).toBeErr(Cl.uint(402)); // ERR-INSUFFICIENT-BALANCE
});

it("rejects emergency-withdraw for zero amount", () => {
  const result = simnet.callPublicFn("vault-core", "emergency-withdraw",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(0)], wallet1);
  expect(result.result).toBeErr(Cl.uint(403)); // ERR-INVALID-AMOUNT
});

// --- Rebalance Target Validation Tests ---

it("allows owner to whitelist a rebalance target", () => {
  const result = simnet.callPublicFn("vault-core", "add-whitelisted-target",
    [Cl.principal(wallet2)], deployer);
  expect(result.result).toBeOk(Cl.bool(true));
});

it("rejects non-owner from whitelisting rebalance targets", () => {
  const result = simnet.callPublicFn("vault-core", "add-whitelisted-target",
    [Cl.principal(wallet2)], wallet1);
  expect(result.result).toBeErr(Cl.uint(401));
});

it("rejects rebalance to non-whitelisted target", () => {
  // wallet_1 is not whitelisted as target
  const result = simnet.callPublicFn("vault-core", "rebalance",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(100), Cl.principal(wallet1)], deployer);
  // Should fail with new error (e.g., ERR-UNKNOWN-TARGET u406)
  expect(result.result).toBeErr(Cl.uint(406));
});

it("allows rebalance to whitelisted target", () => {
  // Whitelist wallet_2, then rebalance to it
  simnet.callPublicFn("vault-core", "add-whitelisted-target",
    [Cl.principal(wallet2)], deployer);
  // Need tokens in vault first (via deposit)
  const result = simnet.callPublicFn("vault-core", "rebalance",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(100), Cl.principal(wallet2)], deployer);
  expect(result.result).toBeOk(Cl.uint(100));
});

it("allows owner to remove a whitelisted target", () => {
  simnet.callPublicFn("vault-core", "add-whitelisted-target",
    [Cl.principal(wallet2)], deployer);
  const result = simnet.callPublicFn("vault-core", "remove-whitelisted-target",
    [Cl.principal(wallet2)], deployer);
  expect(result.result).toBeOk(Cl.bool(true));
});
```

#### New tests in [yield-token.test.ts](tests/yield-token.test.ts) (currently 6 tests → 10 tests)

```typescript
// --- Auth Fix Tests (after removing tx-sender fallback) ---

it("rejects mint from non-minter even if tx-sender is owner", () => {
  // Set authorized-minter to vault-core
  simnet.callPublicFn("yield-token", "set-authorized-minter",
    [Cl.principal(`${deployer}.vault-core`)], deployer);
  // Now deployer (owner) tries to mint directly — contract-caller is deployer, not vault-core
  const result = simnet.callPublicFn("yield-token", "mint",
    [Cl.uint(1000), Cl.principal(wallet1)], deployer);
  expect(result.result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORIZED
});

it("rejects burn from non-minter even if tx-sender is owner", () => {
  // Mint via vault-core first (need to set up deposit flow)
  // Then try to burn directly as deployer
  const result = simnet.callPublicFn("yield-token", "burn",
    [Cl.uint(100), Cl.principal(wallet1)], deployer);
  expect(result.result).toBeErr(Cl.uint(401));
});

it("allows mint when called through authorized minter contract", () => {
  // Set vault-core as minter, then deposit (which triggers mint via vault-core)
  simnet.callPublicFn("yield-token", "set-authorized-minter",
    [Cl.principal(`${deployer}.vault-core`)], deployer);
  simnet.callPublicFn("vault-core", "add-whitelisted-token",
    [Cl.principal(`${deployer}.yield-token`)], deployer);
  const result = simnet.callPublicFn("vault-core", "deposit",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
  expect(result.result).toBeOk(Cl.uint(5000));
  // Verify token was minted
  const balance = simnet.callReadOnlyFn("yield-token", "get-balance",
    [Cl.principal(wallet1)], deployer);
  expect(balance.result).toBeOk(Cl.uint(5000));
});

it("rejects non-owner from setting authorized minter", () => {
  const result = simnet.callPublicFn("yield-token", "set-authorized-minter",
    [Cl.principal(wallet1)], wallet1);
  expect(result.result).toBeErr(Cl.uint(401));
});
```

#### New tests in [strategy-router.test.ts](tests/strategy-router.test.ts) (currently 5 tests → 14 tests)

```typescript
// --- Deactivate/Activate Tests (replaces toggle-strategy) ---

it("deactivates a strategy and saves its allocation", () => {
  // Add a strategy with 3000 bps
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("Zest sBTC"), Cl.principal(wallet1), Cl.uint(3000)], deployer);
  // Deactivate it
  const result = simnet.callPublicFn("strategy-router", "deactivate-strategy",
    [Cl.uint(0)], deployer);
  expect(result.result).toBeOk(Cl.bool(false));
  // Verify total allocation decreased
  const total = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
  expect(total.result).toBeOk(Cl.uint(0));
  // Verify strategy is inactive with 0 allocation
  const strategy = simnet.callReadOnlyFn("strategy-router", "get-strategy", [Cl.uint(0)], deployer);
  // Strategy should have is-active: false, allocation-bps: u0
});

it("reactivates a strategy and restores its saved allocation", () => {
  // Continuing from deactivation above
  const result = simnet.callPublicFn("strategy-router", "activate-strategy",
    [Cl.uint(0)], deployer);
  expect(result.result).toBeOk(Cl.bool(true));
  // Verify allocation is restored to 3000
  const alloc = simnet.callReadOnlyFn("strategy-router", "get-allocation", [Cl.uint(0)], deployer);
  expect(alloc.result).toBeOk(Cl.uint(3000));
  // Verify total allocation restored
  const total = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
  expect(total.result).toBeOk(Cl.uint(3000));
});

it("rejects activating an already-active strategy", () => {
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("Active One"), Cl.principal(wallet1), Cl.uint(1000)], deployer);
  const result = simnet.callPublicFn("strategy-router", "activate-strategy",
    [Cl.uint(0)], deployer);
  // Should fail — already active
  expect(result.result).toBeErr(Cl.uint(405)); // ERR-INVALID-INPUT or similar
});

it("rejects deactivating an already-inactive strategy", () => {
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("Test"), Cl.principal(wallet1), Cl.uint(1000)], deployer);
  simnet.callPublicFn("strategy-router", "deactivate-strategy", [Cl.uint(0)], deployer);
  const result = simnet.callPublicFn("strategy-router", "deactivate-strategy", [Cl.uint(0)], deployer);
  expect(result.result).toBeErr(Cl.uint(405));
});

// --- Update Allocation Tests ---

it("allows authorized agent to update allocation", () => {
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("Agent Test"), Cl.principal(wallet1), Cl.uint(2000)], deployer);
  simnet.callPublicFn("strategy-router", "add-agent",
    [Cl.principal(wallet1)], deployer);
  // Agent updates allocation
  const result = simnet.callPublicFn("strategy-router", "update-allocation",
    [Cl.uint(0), Cl.uint(3500)], wallet1);
  expect(result.result).toBeOk(Cl.uint(3500));
});

it("rejects unauthorized user from updating allocation", () => {
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("Unauth Test"), Cl.principal(wallet1), Cl.uint(1000)], deployer);
  const result = simnet.callPublicFn("strategy-router", "update-allocation",
    [Cl.uint(0), Cl.uint(2000)], wallet2);
  expect(result.result).toBeErr(Cl.uint(401));
});

it("prevents update-allocation from exceeding 10000 bps total", () => {
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("S1"), Cl.principal(wallet1), Cl.uint(5000)], deployer);
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("S2"), Cl.principal(wallet1), Cl.uint(3000)], deployer);
  // Try to update S2 to 6000 (total would be 11000)
  const result = simnet.callPublicFn("strategy-router", "update-allocation",
    [Cl.uint(1), Cl.uint(6000)], deployer);
  expect(result.result).toBeErr(Cl.uint(404)); // ERR-ALLOCATION-OVERFLOW
});

it("allows owner to remove an agent", () => {
  simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
  simnet.callPublicFn("strategy-router", "remove-agent", [Cl.principal(wallet1)], deployer);
  const result = simnet.callReadOnlyFn("strategy-router", "is-authorized-agent",
    [Cl.principal(wallet1)], deployer);
  expect(result.result).toBeOk(Cl.bool(false));
});

it("rejects non-owner from removing agents", () => {
  simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
  const result = simnet.callPublicFn("strategy-router", "remove-agent",
    [Cl.principal(wallet1)], wallet2);
  expect(result.result).toBeErr(Cl.uint(401));
});
```

#### New tests in [fee-collector.test.ts](tests/fee-collector.test.ts) (currently 8 tests → 14 tests)

```typescript
// --- Fee Precision Tests ---

it("calculates zero fee for tiny yield amounts (precision floor)", () => {
  // With 1000 bps fee: (9 * 1000) / 10000 = 0
  const result = simnet.callReadOnlyFn("fee-collector", "calculate-fee",
    [Cl.uint(9)], deployer);
  expect(result.result).toBeOk(Cl.uint(0)); // OR u1 if minimum fee is added
});

it("calculates fee correctly at boundary (10 units at 10%)", () => {
  // (10 * 1000) / 10000 = 1
  const result = simnet.callReadOnlyFn("fee-collector", "calculate-fee",
    [Cl.uint(10)], deployer);
  expect(result.result).toBeOk(Cl.uint(1));
});

it("calculates fee for large yield amounts", () => {
  // (1_000_000 * 1000) / 10000 = 100_000
  const result = simnet.callReadOnlyFn("fee-collector", "calculate-fee",
    [Cl.uint(1000000)], deployer);
  expect(result.result).toBeOk(Cl.uint(100000));
});

// --- Token Fee Tests (currently untested) ---

it("allows token fee collection via collect-token-fee", () => {
  // Need a SIP-010 token — use yield-token
  const result = simnet.callPublicFn("fee-collector", "collect-token-fee",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
  // Will succeed if wallet1 has yield-token balance (mint first)
  expect(result.result).toBeOk(Cl.uint(5000));
  // Verify total token fees
  const totalFees = simnet.callReadOnlyFn("fee-collector", "get-total-token-fees",
    [Cl.principal(`${deployer}.yield-token`)], deployer);
  expect(totalFees.result).toBeOk(Cl.uint(5000));
});

it("allows owner to withdraw token fees", () => {
  // After collecting token fees above
  const result = simnet.callPublicFn("fee-collector", "withdraw-token-fees",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(2000)], deployer);
  expect(result.result).toBeOk(Cl.uint(2000));
});

it("rejects non-owner from withdrawing token fees", () => {
  const result = simnet.callPublicFn("fee-collector", "withdraw-token-fees",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(100)], wallet1);
  expect(result.result).toBeErr(Cl.uint(401));
});
```

#### New file: [tests/integration.test.ts](tests/integration.test.ts) — Full Lifecycle Tests

```typescript
// --- End-to-End Deposit → Yield → Withdraw Flow ---

it("full lifecycle: deposit, verify shares, withdraw, verify final state", () => {
  // 1. Setup: whitelist token, set vault-core as minter
  simnet.callPublicFn("vault-core", "add-whitelisted-token",
    [Cl.principal(`${deployer}.yield-token`)], deployer);
  simnet.callPublicFn("yield-token", "set-authorized-minter",
    [Cl.principal(`${deployer}.vault-core`)], deployer);

  // 2. Deposit 10000 from wallet_1
  const deposit = simnet.callPublicFn("vault-core", "deposit",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(10000)], wallet1);
  expect(deposit.result).toBeOk(Cl.uint(10000));

  // 3. Verify shares minted (1:1)
  const shares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
    [Cl.principal(wallet1)], deployer);
  expect(shares.result).toBeOk(Cl.uint(10000));

  // 4. Verify total shares
  const totalShares = simnet.callReadOnlyFn("vault-core", "get-total-shares", [], deployer);
  expect(totalShares.result).toBeOk(Cl.uint(10000));

  // 5. Verify cfYIELD token balance
  const tokenBal = simnet.callReadOnlyFn("yield-token", "get-balance",
    [Cl.principal(wallet1)], deployer);
  expect(tokenBal.result).toBeOk(Cl.uint(10000));

  // 6. Partial withdraw 4000
  const withdraw = simnet.callPublicFn("vault-core", "withdraw",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(4000)], wallet1);
  expect(withdraw.result).toBeOk(Cl.uint(4000));

  // 7. Verify remaining shares
  const remainingShares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
    [Cl.principal(wallet1)], deployer);
  expect(remainingShares.result).toBeOk(Cl.uint(6000));

  // 8. Verify remaining deposit
  const remainingDeposit = simnet.callReadOnlyFn("vault-core", "get-user-deposit",
    [Cl.principal(wallet1), Cl.principal(`${deployer}.yield-token`)], deployer);
  expect(remainingDeposit.result).toBeOk(Cl.uint(6000));
});

it("multi-user deposit and withdraw isolation", () => {
  // Setup
  simnet.callPublicFn("vault-core", "add-whitelisted-token",
    [Cl.principal(`${deployer}.yield-token`)], deployer);
  simnet.callPublicFn("yield-token", "set-authorized-minter",
    [Cl.principal(`${deployer}.vault-core`)], deployer);

  // wallet_1 deposits 5000
  simnet.callPublicFn("vault-core", "deposit",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
  // wallet_2 deposits 3000
  simnet.callPublicFn("vault-core", "deposit",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(3000)], wallet2);

  // Verify total shares = 8000
  const total = simnet.callReadOnlyFn("vault-core", "get-total-shares", [], deployer);
  expect(total.result).toBeOk(Cl.uint(8000));

  // wallet_1 withdraws 2000
  simnet.callPublicFn("vault-core", "withdraw",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(2000)], wallet1);

  // wallet_2 balance unaffected
  const w2shares = simnet.callReadOnlyFn("vault-core", "get-user-shares",
    [Cl.principal(wallet2)], deployer);
  expect(w2shares.result).toBeOk(Cl.uint(3000));
});

it("rejects deposit of non-whitelisted token", () => {
  const result = simnet.callPublicFn("vault-core", "deposit",
    [Cl.principal(`${deployer}.fee-collector`), Cl.uint(1000)], wallet1);
  expect(result.result).toBeErr(Cl.uint(404)); // ERR-UNKNOWN-TOKEN
});

it("rejects withdraw exceeding deposited amount", () => {
  simnet.callPublicFn("vault-core", "add-whitelisted-token",
    [Cl.principal(`${deployer}.yield-token`)], deployer);
  simnet.callPublicFn("yield-token", "set-authorized-minter",
    [Cl.principal(`${deployer}.vault-core`)], deployer);
  simnet.callPublicFn("vault-core", "deposit",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(1000)], wallet1);

  const result = simnet.callPublicFn("vault-core", "withdraw",
    [Cl.principal(`${deployer}.yield-token`), Cl.uint(5000)], wallet1);
  expect(result.result).toBeErr(Cl.uint(402)); // ERR-INSUFFICIENT-BALANCE
});

it("strategy router + vault integration: add strategies, verify allocations", () => {
  // Add two strategies
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("Zest sBTC"), Cl.principal(wallet1), Cl.uint(4000)], deployer);
  simnet.callPublicFn("strategy-router", "add-strategy",
    [Cl.stringAscii("Bitflow LP"), Cl.principal(wallet2), Cl.uint(3000)], deployer);

  // Verify total = 7000
  const total = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
  expect(total.result).toBeOk(Cl.uint(7000));

  // Update first strategy via agent
  simnet.callPublicFn("strategy-router", "add-agent", [Cl.principal(wallet1)], deployer);
  simnet.callPublicFn("strategy-router", "update-allocation",
    [Cl.uint(0), Cl.uint(3000)], wallet1);

  // Verify new total = 6000
  const newTotal = simnet.callReadOnlyFn("strategy-router", "get-total-allocation", [], deployer);
  expect(newTotal.result).toBeOk(Cl.uint(6000));
});

it("fee collection flow: collect STX fees, owner withdraws", () => {
  // Collect fees from wallet_1
  simnet.callPublicFn("fee-collector", "collect-fee", [Cl.uint(100000)], wallet1);
  simnet.callPublicFn("fee-collector", "collect-fee", [Cl.uint(50000)], wallet2);

  // Verify total
  const total = simnet.callReadOnlyFn("fee-collector", "get-total-fees", [], deployer);
  expect(total.result).toBeOk(Cl.uint(150000));

  // Owner withdraws partial
  const withdraw = simnet.callPublicFn("fee-collector", "withdraw-fees",
    [Cl.uint(80000)], deployer);
  expect(withdraw.result).toBeOk(Cl.uint(80000));

  // Verify remaining
  const remaining = simnet.callReadOnlyFn("fee-collector", "get-total-fees", [], deployer);
  expect(remaining.result).toBeOk(Cl.uint(70000));
});
```

### Test Count Summary

| File | Current | After Phase 1 | After Phase 2 |
|------|---------|---------------|---------------|
| vault-core.test.ts | 7 | 16 | 16 |
| yield-token.test.ts | 6 | 10 | 10 |
| strategy-router.test.ts | 5 | 14 | 14 |
| fee-collector.test.ts | 8 | 14 | 14 |
| integration.test.ts | 0 | 0 | 6 |
| **Total** | **26** | **54** | **60** |

### Phase 1 Verification
- `npm test` from root: all 54 tests pass, no regressions on existing 26
- Curl: `/premium/yield-forecast` returns 402, `?risk=invalid` returns 400

---

## Phase 2: Production Hardening

### 2.1 Smart Contract Hardening

**2.1.1 Event Emissions** — All 4 contracts
- Add `(print {...})` to every state-changing function for audit trail
- Consistent structure: `{event, user, token, amount, ...}`

**2.1.2 Fee Precision** — [fee-collector.clar](contracts/fee-collector.clar)
- Document floor behavior for small amounts OR add minimum fee of `u1` when yield > 0 but calculated fee rounds to 0

**2.1.3 Integration Tests** — New: [tests/integration.test.ts](tests/integration.test.ts)
- 6 end-to-end tests as specified in Phase 1.3 above (full lifecycle, multi-user isolation, error cases, strategy+vault integration, fee collection flow)
- These tests are written in Phase 2 because they depend on the contract changes from Phase 1 being complete and verified
- Final total: 60 tests across 5 files

### 2.2 Backend Hardening

**2.2.1 Replace Mocks with On-Chain Data** — [routes.ts](backend/src/api/routes.ts), [stacks.ts](backend/src/services/stacks.ts)
- Call existing `getVaultStats()`, `getStrategy()` functions (currently dead code)
- Keep mock fallbacks with `source: "chain" | "mock"` field in responses

**2.2.2 Structured Logging** — New: `backend/src/lib/logger.ts`
- Add `pino` + `pino-http`
- Replace all `console.log` calls
- Add request ID correlation

**2.2.3 Rate Limiting** — New: `backend/src/middleware/rate-limiter.ts`
- `express-rate-limit`: 100 req/15min global, 10 req/min premium, 5 req/min AI endpoints

**2.2.4 Graceful Shutdown** — [index.ts](backend/src/index.ts)
- Handle SIGTERM/SIGINT, drain connections, close server

**2.2.5 Real Health Check** — [routes.ts](backend/src/api/routes.ts)
- Check Stacks node reachability + OpenAI key presence
- Return `healthy` / `degraded` / `unhealthy`

**2.2.6 Response Consistency** — New: `backend/src/lib/response.ts`
- Unified envelope: `{ success, data, timestamp }` for all endpoints

**2.2.7 AI Agent Cache** — [yield-optimizer.ts](backend/src/agents/yield-optimizer.ts)
- In-memory cache with 5-min TTL for AI responses
- Validate parsed JSON structure before returning
- Use cached successful responses as improved fallback

---

## Phase 3: Frontend Overhaul

### Design Research — Modeled After Production DeFi Apps

Based on research of Yearn Finance v3, Beefy Finance, Pendle Finance, StackingDAO, Zest Protocol, and Sommelier, the redesign follows these proven patterns:

**Industry UI Patterns to Adopt:**
| Pattern | Source | How We Apply It |
|---------|--------|----------------|
| Hero stat cards (TVL, APY, Users, Rewards) on dark bg | StackingDAO | Top of Dashboard — 4 metric cards with subtle gradient bg |
| Vault list with sortable APY/TVL/Risk columns | Beefy Finance | Yields table with column sort + filter by protocol |
| Tabbed Deposit/Withdraw panel in a card | Yearn v3 | Right-side sticky panel with sBTC/USDCx tabs |
| Portfolio overview: Total Balance + Claimable Yield | Pendle Finance | Dashboard hero showing user's total position + earned yield |
| Allocation donut chart + protocol breakdown cards | Beefy/Sommelier | Strategy section with recharts PieChart + protocol cards |
| P&L tracking with USD/Underlying toggle | Pendle Finance | Portfolio analytics page for premium users |
| Dark theme with warm accent color | StackingDAO/Zest | Dark charcoal (#0a0a0f) bg, orange (#f97316) brand accent |
| Audit badges + security indicators | Zest Protocol | Footer section with trust signals |
| Multi-theme support (dark/midnight/light) | Yearn v3 | Start dark-only, add theme toggle later |

**Color System (derived from existing brand + Stacks ecosystem):**
```
Background:     #0a0a0f (near-black), #111118 (surface), #1a1a24 (elevated)
Brand:          #f97316 (orange-500) primary, #fb923c (orange-400) hover
Accent:         #3b82f6 (blue-500) for links/info
Success:        #22c55e (green-500) for positive APY/gains
Danger:         #ef4444 (red-500) for losses/errors
Text:           #f8fafc (primary), #94a3b8 (secondary), #64748b (muted)
Border:         #1e293b (subtle), #334155 (prominent)
```

### 3.1 Infrastructure

**3.1.1 Install Tailwind Properly**
- Remove CDN script + inline config from [index.html](frontend/index.html)
- Install `tailwindcss`, `postcss`, `autoprefixer` as dev deps
- Create `tailwind.config.ts` with the color system above + existing brand palette
- Update `index.css` with `@tailwind` directives
- Keep Google Fonts (Space Grotesk headings, Inter body)

**3.1.2 Environment Config**
- Create `.env` with `VITE_API_URL=http://localhost:4000/api`
- Replace hardcoded API URL in App.tsx

**3.1.3 Cleanup**
- Delete unused `App.css`, `assets/react.svg`
- Add `lucide-react` icons throughout (installed but unused)

### 3.2 Component Architecture — Decompose [App.tsx](frontend/src/App.tsx) (495 lines)

```
src/
  components/
    layout/
      Navbar.tsx              # Logo, nav links (Dashboard|Analytics|Yields), wallet button
      Footer.tsx              # Audit badges, social links, Stacks ecosystem links
      PageLayout.tsx          # Dark gradient bg wrapper + max-width container
    vault/
      StatCard.tsx            # Glassmorphism stat card with icon, value, label, trend arrow
      StatsGrid.tsx           # 4-card grid: TVL, Weighted APY, Active Strategies, Your Balance
      DepositWithdrawPanel.tsx # Tabbed panel (Deposit|Withdraw), asset selector, amount input, quick amounts, CTA
      VaultHero.tsx           # Hero banner: "AI-Powered sBTC Yield" + total balance + claimable yield
      HowItWorks.tsx          # 3-step horizontal cards with lucide icons
    strategy/
      AllocationPieChart.tsx  # recharts donut chart showing protocol %
      ProtocolCard.tsx        # Individual protocol: logo, name, allocation %, APY, status badge
      StrategyPanel.tsx       # Pie chart left + protocol card grid right
    yields/
      YieldTable.tsx          # Sortable table: Protocol, Asset, APY, TVL, Risk, Trend sparkline
      YieldFilters.tsx        # Filter bar: risk level, protocol, min APY slider
      RiskBadge.tsx           # Pill badge with icon + color (green/yellow/red)
    premium/
      PremiumBanner.tsx       # Upsell card: "Unlock AI Intelligence — 0.1 STX per query"
      ForecastCard.tsx        # 7-day APY forecast line chart + confidence bands
      SignalsPanel.tsx        # Strategy recommendations with risk indicators
    charts/
      ApyHistoryChart.tsx     # recharts AreaChart: 30-day APY history with gradient fill
      TvlChart.tsx            # recharts AreaChart: TVL over time
      MiniSparkline.tsx       # Tiny inline chart for table rows (APY trend)
    common/
      ErrorBoundary.tsx       # Catches React errors, shows friendly retry UI
      Toast.tsx               # Slide-in notifications (success/error/pending)
      LoadingSpinner.tsx      # Extracted spinner
      LoadingSkeleton.tsx     # Shimmer placeholder for cards/tables while loading
      EmptyState.tsx          # "No data" illustrations for empty tables/charts
      Badge.tsx               # Reusable pill badge (risk, status, asset type)
  hooks/
    useVaultData.ts           # Fetches vault stats, yields, allocations — polls every 30s
    useWallet.ts              # @stacks/connect: connect, disconnect, address, network
    useDeposit.ts             # openContractCall for vault-core.deposit
    useWithdraw.ts            # openContractCall for vault-core.withdraw
    usePremiumApi.ts          # x402 premium endpoint calls with payment flow
  context/
    WalletContext.tsx          # Wallet state provider with localStorage persistence
    VaultContext.tsx           # Vault data provider with loading/error states
  lib/
    api.ts                    # Axios instance with env-based URL + error interceptor
    format.ts                 # formatUsd(), formatApy(), formatAddress(), formatBtc()
    constants.ts              # Asset list, contract addresses per network, protocol metadata
  types/
    index.ts                  # YieldSource, StrategyAllocation, VaultStats, TransactionState
  pages/
    Dashboard.tsx             # Main: VaultHero + StatsGrid + DepositWithdrawPanel + StrategyPanel
    Yields.tsx                # Full yield table with filters + sort
    Analytics.tsx             # Premium: ApyHistoryChart + TvlChart + ForecastCard + SignalsPanel
  App.tsx                     # Slim: WalletProvider + VaultProvider + Router + Layout
  main.tsx                    # Entry point
```

### 3.3 Page Layouts (modeled after industry apps)

**Dashboard Page** (primary — what users see after connecting wallet)
```
┌─────────────────────────────────────────────────────────┐
│  Navbar: Logo | Dashboard | Yields | Analytics | [Connect Wallet] │
├─────────────────────────────────────────────────────────┤
│  VaultHero: "AI-Powered sBTC Yield Aggregator"          │
│  ┌──────────────────┐ ┌──────────────────┐              │
│  │ Your Balance      │ │ Claimable Yield  │              │
│  │ 2.45 sBTC ($XX)   │ │ 0.012 sBTC       │              │
│  └──────────────────┘ └──────────────────┘              │
├─────────────────────────────────────────────────────────┤
│  StatsGrid: [TVL] [Avg APY] [Active Strategies] [Users] │
├───────────────────────────────┬─────────────────────────┤
│  StrategyPanel                │  DepositWithdrawPanel   │
│  ┌─────────────┐             │  [Deposit] [Withdraw]   │
│  │  Donut Chart │             │  Asset: [sBTC ▼]        │
│  │  (allocation)│             │  Amount: [____] MAX     │
│  └─────────────┘             │  [25%][50%][75%][100%]  │
│  Protocol Cards:              │  Est. Shares: XXXX      │
│  • Zest sBTC (25%) 5.2%     │  [Deposit sBTC]         │
│  • Bitflow LP (20%) 8.1%    │                         │
│  • StackingDAO (30%) 6.5%   │  HowItWorks (3 steps)   │
│  • Hermetica (15%) 4.3%     │                         │
│  • Reserve (10%)             │                         │
├───────────────────────────────┴─────────────────────────┤
│  PremiumBanner: "Unlock AI yield intelligence — x402"   │
├─────────────────────────────────────────────────────────┤
│  Footer: Audit badges | Powered by Stacks | Social links│
└─────────────────────────────────────────────────────────┘
```

**Yields Page** (modeled after Beefy vault list)
```
┌─────────────────────────────────────────────────────────┐
│  YieldFilters: [All Protocols ▼] [Risk: All ▼] [Min APY]│
├─────────────────────────────────────────────────────────┤
│  YieldTable (sortable columns):                          │
│  Protocol    │ Asset  │ APY ↓  │ TVL      │ Risk │ Trend│
│  Zest        │ sBTC   │ 5.2%   │ $45M     │ 🟢   │ ↗   │
│  Bitflow     │ sBTC/x │ 8.1%   │ $23M     │ 🟡   │ →   │
│  StackingDAO │ stSTX  │ 6.5%   │ $112M    │ 🟢   │ ↗   │
│  Hermetica   │ sBTC   │ 4.3%   │ $18M     │ 🟢   │ ↘   │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

**Analytics Page** (premium, modeled after Pendle dashboard)
```
┌─────────────────────────────────────────────────────────┐
│  Portfolio Overview: Total Position | P&L | Claimable    │
│  [USD mode ○ | Underlying mode ●]                       │
├──────────────────────────┬──────────────────────────────┤
│  APY History Chart       │  TVL Chart                   │
│  (30-day area chart)     │  (30-day area chart)         │
├──────────────────────────┴──────────────────────────────┤
│  AI Forecast (7-day): line chart + confidence bands     │
├─────────────────────────────────────────────────────────┤
│  Strategy Signals: recommendation cards with risk level  │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Real Wallet Integration — New: `hooks/useWallet.ts`
- Use `showConnect` from `@stacks/connect` (installed but unused)
- Expose: `address`, `isConnected`, `connect()`, `disconnect()`, `network`
- Persist connection in localStorage
- Display real truncated address in Navbar (like StackingDAO: `ST1PQ...PGZGM`)
- Show network badge (testnet/mainnet)

### 3.5 Real Transaction Integration — New: `hooks/useDeposit.ts`, `hooks/useWithdraw.ts`
- Use `openContractCall` from `@stacks/connect` to call `vault-core.deposit` / `vault-core.withdraw`
- Transaction states: `idle → signing → pending → confirmed → failed`
- Toast notifications for each state transition (slide-in from bottom-right)
- Show estimated shares before confirming
- Disable button + show spinner during signing

### 3.6 Charts — New: `components/charts/`
- Use `recharts` (v3.8.0 installed but unused)
- `ApyHistoryChart`: AreaChart with orange gradient fill, 30-day history
- `TvlChart`: AreaChart with blue gradient fill
- `AllocationPieChart`: Donut chart with protocol colors, center text showing total %
- `MiniSparkline`: 50px inline chart for yield table rows (7-day APY trend)
- All charts responsive via `ResponsiveContainer`
- Custom tooltip with dark theme styling

### 3.7 Data Fetching — New: `hooks/useVaultData.ts`, `lib/api.ts`
- Axios instance with env-based URL + response interceptor for error normalization
- Polling every 30s for live data (configurable)
- Explicit error states shown to user (not silent mock fallback)
- `{ data, loading, error, refetch }` pattern
- Loading skeletons (shimmer) while fetching — not just a spinner

### 3.8 Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation for buttons/forms (visible focus rings like Zest: `outline-2 outline-offset-2`)
- `aria-live="polite"` for dynamic content (stats, APY updates)
- Icons alongside color-coded badges using `lucide-react` (Shield, AlertTriangle, CheckCircle)
- Skip-to-content link in Navbar
- Semantic HTML: `<nav>`, `<main>`, `<section>`, `<table>` with proper headers

### 3.9 Phase 3 Verification
- `npm run build` in frontend: no errors
- `npm run lint`: clean
- Visual check: dark theme renders correctly, all components visible
- Wallet connect works with Hiro Wallet on testnet
- Deposit flow opens transaction signing dialog
- Charts render with backend data
- Table sorting/filtering works
- Responsive: mobile (375px), tablet (768px), desktop (1280px) all work
- Lighthouse accessibility > 90

---

## Verification Summary

| Phase | Gate | Command/Method |
|-------|------|----------------|
| 1 | 54 tests pass (28 new), no regressions | `npm test` from root |
| 1 | `clarinet check` passes on all modified contracts | `clarinet check` |
| 1 | Premium endpoints return 402 | `curl localhost:4000/api/premium/yield-forecast` |
| 1 | Invalid input returns 400 | `curl localhost:4000/api/premium/strategy-signals?risk=xyz` |
| 2 | 60 tests pass (6 new integration tests) | `npm test` from root |
| 2 | On-chain data flows when devnet running | `clarinet devnet start` + check `/api/vault/stats` |
| 2 | Rate limiting works | 101st request returns 429 |
| 3 | Frontend builds clean | `cd frontend && npm run build` |
| 3 | Wallet + deposit flow works | Manual test with Hiro Wallet on testnet |
| 3 | Accessibility audit | Lighthouse score > 90 |

---

## Dependency Order

```
Phase 1.1 (contract security) ─┐
Phase 1.2 (backend security)  ─┤
                                ├─► Phase 1.3 (verify) ─► Phase 2.1 + 2.2 ─► Phase 2.3 (verify)
                                │                                                       │
                                │                         Phase 3.1 (infra) ◄───────────┘
                                │                              │
                                │                         Phase 3.2 (components)
                                │                              │
                                │              ┌───────────────┼───────────────┐
                                │         3.3 wallet      3.5 charts     3.6 data layer
                                │              │
                                │         3.4 transactions
                                │              │
                                └──────── 3.7 a11y ─► 3.8 verify
```

Phase 3.3 (wallet) requires Phase 2.2.1 (real data) to be meaningful.
Phase 3.4 (transactions) requires Phase 1.1 contract fixes to be safe.
Phase 3.1 (Tailwind install) must happen before any other Phase 3 work.

---

## Principal Engineer Review — Loose Ends Tightened

### R1. Test State Isolation (CRITICAL)

Vitest runs with `singleFork: true` and `singleThread: true` ([vitest.config.js](vitest.config.js)). All tests within a `describe` block share simnet state — strategy IDs increment, balances accumulate, whitelist state persists.

**Resolution:** Tests that depend on sequence (deactivate then activate) are grouped intentionally. Tests that assume `id=0` must run first in their describe block, or query `get-strategy-count` to get the current ID. Integration tests in a separate file get a fresh simnet.

### R2. Existing Tests After Auth Fix (CRITICAL)

Current [yield-token.test.ts:30](tests/yield-token.test.ts#L30) "allows owner to mint tokens" calls `mint` directly as deployer. After fix 1.1.3, will this break?

**No.** The fix changes `(or (is-eq contract-caller minter) (is-eq tx-sender OWNER))` to `(is-eq contract-caller minter)`. The default `authorized-minter` is `tx-sender` (deployer at deploy time). When deployer calls `mint` directly, `contract-caller` IS the deployer, which matches the default `authorized-minter`. Existing test passes. Only after `set-authorized-minter` is called (to vault-core) would direct deployer mints fail — which is the behavior the NEW tests verify.

### R3. Circular Token Dependency in Tests (CRITICAL)

Tests deposit `yield-token` into the vault, which then mints more `yield-token` shares. For wallet_1 to deposit, it needs yield-tokens first. Simnet does NOT pre-fund wallets with SIP-010 tokens.

**Resolution — Required setup sequence for ALL deposit tests:**
```typescript
// 1. Mint tokens to wallet_1 (deployer is default authorized-minter)
simnet.callPublicFn("yield-token", "mint",
  [Cl.uint(100000), Cl.principal(wallet1)], deployer);
// 2. Set vault-core as authorized minter
simnet.callPublicFn("yield-token", "set-authorized-minter",
  [Cl.principal(`${deployer}.vault-core`)], deployer);
// 3. Whitelist yield-token in vault
simnet.callPublicFn("vault-core", "add-whitelisted-token",
  [Cl.principal(`${deployer}.yield-token`)], deployer);
// 4. Now wallet_1 can deposit (has tokens, token is whitelisted, vault can mint shares)
```

This applies to vault-core deposit tests, integration tests, and fee-collector token fee tests.

### R4. Missing Dependencies to Install

| Package | Directory | Phase | Why |
|---------|-----------|-------|-----|
| `zod` | `backend/` | 1.2.2 | Input validation |
| `pino` + `pino-http` | `backend/` | 2.2.2 | Structured logging |
| `express-rate-limit` | `backend/` | 2.2.3 | Rate limiting |
| `react-router-dom` | `frontend/` | 3.2 | Page routing (Dashboard/Yields/Analytics) |
| `tailwindcss` + `postcss` + `autoprefixer` | `frontend/` (dev) | 3.1.1 | Build-time CSS |

### R5. New Contract Constants to Add

**vault-core.clar** — add before public functions:
```clarity
(define-constant ERR-UNKNOWN-TARGET (err u406))
(define-constant MAX-ACTIONS-PER-BLOCK u10)
(define-data-var last-action-block uint u0)
(define-data-var actions-this-block uint u0)
(define-map whitelisted-targets principal bool)
```

**strategy-router.clar** — add:
```clarity
(define-map strategy-saved-allocation uint uint)
;; Reuse ERR-INVALID-INPUT (u405) for already-active/already-inactive errors
```

### R6. `@x402/express` API — Verify Before Using

The plan assumes `paymentMiddleware` as the export name. During implementation, verify:
```bash
cd backend && node -e "const x = require('@x402/express'); console.log(Object.keys(x))"
```
Adjust the import if the actual export name differs.

### R7. Fee-Collector Token Fee Test — Missing Mint Setup

The `collect-token-fee` test needs wallet_1 to have yield-tokens. Add mint step before the test:
```typescript
simnet.callPublicFn("yield-token", "mint",
  [Cl.uint(10000), Cl.principal(wallet1)], deployer);
```

### R8. Tailwind Version Compatibility

Current CDN (`<script src="https://cdn.tailwindcss.com">`) uses Tailwind v4 play CDN. Tailwind v4 uses CSS-based config (not JS). When installing:
- Check installed version: if v4, use CSS config with `@theme` blocks
- If v3, use traditional `tailwind.config.ts`
- Must match to preserve existing class names and color system

### R9. Frontend Router — No Current Routing

The current [App.tsx](frontend/src/App.tsx) has zero routing. Adding `react-router-dom` requires:
- `BrowserRouter` wrapper in `main.tsx` or `App.tsx`
- `Routes` + `Route` for Dashboard, Yields, Analytics
- Navbar links become `<Link to="/yields">` instead of `<a href>`
- Default route `/` renders Dashboard
