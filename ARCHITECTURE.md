# CashFlow Architecture

This document describes the technical architecture of CashFlow — an AI-powered sBTC yield aggregator on the Stacks blockchain.

---

## Table of Contents

- [System Overview](#system-overview)
- [Smart Contracts](#smart-contracts)
- [Backend](#backend)
- [Frontend](#frontend)
- [Data Flow](#data-flow)
- [Security Model](#security-model)
- [Testing Architecture](#testing-architecture)
- [Deployment](#deployment)

---

## System Overview

CashFlow is composed of three independent layers that share no build pipeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                      │
│              React 19 + Vite 7 + Tailwind CSS v4                       │
│                                                                         │
│   Pages:  Dashboard  |  Yields  |  Analytics                           │
│   Wallet: @stacks/connect (Hiro/Leather)                               │
│   Charts: recharts (Pie, Area, Line)                                   │
│   Data:   Polling (30s) → Backend API → Mock fallback                  │
├────────────────────┬────────────────────────────────────────────────────┤
│                    │  HTTP (Axios)                                      │
│                    │  + x402 payment headers                           │
│                    ▼                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                           BACKEND                                       │
│              Express + TypeScript (CommonJS)                            │
│                                                                         │
│   Middleware: CORS → Pino Logging → Rate Limiter → Routes → Error      │
│   Endpoints: 4 public + 3 x402-gated premium                          │
│   AI Agent:  OpenAI GPT-4o-mini → deterministic fallback               │
│   Services:  Stacks read-only calls, Yield monitor (7 sources)         │
├────────────────────┬────────────────────────────────────────────────────┤
│                    │  @stacks/transactions (read-only)                  │
│                    ▼                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                      SMART CONTRACTS                                    │
│              Clarity 3 on Stacks L2 (Epoch 3.2)                        │
│                                                                         │
│   vault-core ──────► yield-token (mint/burn shares)                    │
│       │                                                                 │
│       ├──────────► fee-collector (performance fees)                     │
│       │                                                                 │
│   strategy-router ── AI agent authorization                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Layer Independence

Each layer can be developed, tested, and deployed independently:

| Layer | Build | Test | Deploy |
|-------|-------|------|--------|
| Contracts | `clarinet check` | `npm test` (root) | `clarinet deployments apply` |
| Backend | `npm run build` | Manual / integration | `node dist/index.js` |
| Frontend | `npm run build` | `npm run lint` | Static hosting (Vite output) |

---

## Smart Contracts

Four Clarity 3 contracts deployed as a batch. All contracts use HTTP-style error codes (401-406) and emit `(print {...})` events on every state change.

### Contract Dependency Graph

```
                    ┌──────────────────┐
                    │   vault-core     │
                    │  (deposit/vault) │
                    └───┬──────┬───────┘
                        │      │
            mint/burn   │      │  stx-transfer
            via         │      │  (rebalance)
            contract-   │      │
            caller      │      │
                        ▼      ▼
            ┌──────────────┐  ┌──────────────────┐
            │ yield-token  │  │  fee-collector    │
            │  (cfYIELD)   │  │  (10% perf fee)  │
            └──────────────┘  └──────────────────┘

            ┌──────────────────┐
            │ strategy-router  │    (standalone — no inter-contract calls)
            │ (allocations)    │
            └──────────────────┘
```

### vault-core.clar

The central vault contract. Accepts deposits, mints share tokens, handles withdrawals, and manages fund rebalancing.

**State:**

| Data | Type | Purpose |
|------|------|---------|
| `total-shares` | `uint` | Total cfYIELD in circulation |
| `vault-paused` | `bool` | Emergency pause flag |
| `user-deposits` | `map {user, token} → uint` | Per-user per-token deposit balance |
| `user-shares` | `map user → uint` | Per-user share balance |
| `whitelisted-tokens` | `map principal → bool` | Allowed deposit tokens |
| `whitelisted-targets` | `map principal → bool` | Allowed rebalance destinations |
| `last-action-block` | `uint` | Rate limiting: last block with action |
| `actions-this-block` | `uint` | Rate limiting: count in current block |

**Public Functions:**

| Function | Auth | Description |
|----------|------|-------------|
| `deposit(token, amount)` | Any user | Deposit whitelisted token, mint cfYIELD 1:1 |
| `withdraw(token, amount)` | Any user | Burn shares, return tokens (blocked when paused) |
| `emergency-withdraw(token, amount)` | Any user | Withdraw even when paused (safety net) |
| `rebalance(token, amount, target)` | Owner | Transfer funds to whitelisted DeFi protocol |
| `add-whitelisted-token(token)` | Owner | Allow a SIP-010 token for deposits |
| `remove-whitelisted-token(token)` | Owner | Disallow a token |
| `add-whitelisted-target(target)` | Owner | Approve a rebalance destination |
| `remove-whitelisted-target(target)` | Owner | Remove a rebalance destination |
| `pause-vault()` | Owner | Emergency pause (blocks deposits + withdrawals) |
| `unpause-vault()` | Owner | Resume normal operations |

**Deposit Flow:**

```
User calls deposit(yield-token, 1000)
  │
  ├─ Assert: vault not paused
  ├─ Assert: amount > 0
  ├─ Assert: token is whitelisted
  ├─ Assert: rate limit not exceeded
  │
  ├─ Transfer token from user → vault contract
  ├─ Mint cfYIELD shares to user (1:1 ratio)
  ├─ Update user-deposits map
  ├─ Update user-shares map
  ├─ Increment total-shares
  ├─ Emit (print {event: "deposit", user, token, amount, shares})
  │
  └─ Return (ok amount)
```

**Emergency Withdraw Flow:**

```
User calls emergency-withdraw(yield-token, 500)
  │
  ├─ NO pause check (intentional — this is the safety net)
  ├─ Assert: amount > 0
  ├─ Assert: user has sufficient shares
  │
  ├─ Burn cfYIELD shares from user
  ├─ Transfer token from vault → user
  ├─ Update user-deposits, user-shares, total-shares
  ├─ Emit (print {event: "emergency-withdraw", ...})
  │
  └─ Return (ok amount)
```

### strategy-router.clar

Manages yield strategy allocations using basis points (10,000 bps = 100%). Supports authorized AI agents for autonomous rebalancing.

**State:**

| Data | Type | Purpose |
|------|------|---------|
| `strategy-count` | `uint` | Number of registered strategies |
| `total-allocation-bps` | `uint` | Sum of all allocations (max 10,000) |
| `strategies` | `map id → {name, protocol, bps, active}` | Strategy registry |
| `strategy-saved-allocation` | `map id → uint` | Preserved allocation on deactivate |
| `authorized-agents` | `map principal → bool` | AI agents allowed to update allocations |

**Key Design Decisions:**

1. **Basis Points** — All allocations in bps (100 bps = 1%). Prevents floating-point issues in Clarity.
2. **Deactivate/Activate** — Replaced simple toggle with save/restore pattern. Deactivation zeros the allocation and saves it; activation restores the saved value. Prevents allocation state bugs.
3. **Dual Authorization** — `is-owner-or-agent` check allows both the contract owner and whitelisted AI agents to update allocations. Other admin functions are owner-only.
4. **Overflow Protection** — `update-allocation` checks that new total won't exceed 10,000 bps before applying.

### yield-token.clar (cfYIELD)

SIP-010 compliant fungible token representing vault shares.

**Token Metadata:**

| Property | Value |
|----------|-------|
| Name | CashFlow Yield Token |
| Symbol | cfYIELD |
| Decimals | 6 |
| URI | `https://cashflow.stx/token-metadata.json` |

**Authorization Model:**

```
                    ┌─────────────────┐
                    │  Contract Owner  │
                    │   (deployer)     │
                    └────────┬────────┘
                             │
                   set-authorized-minter()
                             │
                             ▼
                    ┌─────────────────┐
                    │ Authorized Minter│
                    │  (vault-core)    │◄─── ONLY this contract can mint/burn
                    └─────────────────┘

  Default minter = tx-sender (deployer) at deploy time
  After set-authorized-minter(vault-core), only vault-core can mint/burn
  Owner can still transfer, but CANNOT mint/burn directly
```

**Critical Security Fix:** The original implementation had `(or (is-eq contract-caller minter) (is-eq tx-sender OWNER))` in mint/burn. This allowed any contract called by the owner to mint tokens. Fixed to check ONLY `contract-caller` against the authorized minter.

**Transfer Auth Note:** Transfer uses `(is-eq tx-sender sender)` rather than `contract-caller` to allow vault-core (as `contract-caller`) to transfer tokens on behalf of users during deposit/withdraw. This is the standard SIP-010 pattern where the user is `tx-sender` in the call chain.

### fee-collector.clar

Collects performance fees (10% default) and x402 API revenue. Supports both STX and SIP-010 token fees.

**Fee Calculation:**

```
fee = (amount * performance-fee-bps) / 10000
```

At 1000 bps (10%): fee on 100 units = 10 units. Amounts below 10 units round to 0 (floor behavior).

**Fee Limits:** Owner can update `performance-fee-bps` up to a maximum of 5000 (50%).

---

## Backend

Express + TypeScript backend providing a REST API with AI yield optimization and x402 payment gating.

### Request Lifecycle

```
Request
  │
  ├─ CORS check (origin: localhost:5173)
  ├─ Pino HTTP logging (request ID, method, URL, duration)
  ├─ Global rate limiter (100 req / 15 min)
  │
  ├─ Route matching
  │   ├─ Public routes → handler → response
  │   └─ Premium routes
  │       ├─ x402 payment middleware (checks payment header)
  │       │   ├─ Payment valid → continue to handler
  │       │   └─ Payment missing → 402 Payment Required
  │       ├─ Zod input validation (risk profile enum)
  │       │   ├─ Valid → continue
  │       │   └─ Invalid → 400 Bad Request
  │       ├─ Premium rate limiter (10 req / min)
  │       └─ Handler → response
  │
  ├─ Response envelope: { success, data, timestamp }
  │
  └─ Global error handler (catches unhandled errors → 500)
```

### Middleware Stack

| Order | Middleware | File | Purpose |
|-------|-----------|------|---------|
| 1 | CORS | `index.ts` | Origin whitelist (`localhost:5173`) |
| 2 | Pino HTTP | `index.ts` | Structured request logging |
| 3 | JSON parser | `index.ts` | `express.json()` |
| 4 | Global rate limiter | `middleware/rate-limiter.ts` | 100 req / 15 min |
| 5 | x402 payment | `@x402/express` (on premium routes) | Micropayment verification |
| 6 | Zod validation | `middleware/validation.ts` | Input schema enforcement |
| 7 | Route handlers | `api/routes.ts` | Business logic |
| 8 | Error handler | `middleware/error-handler.ts` | Catch-all error normalization |

### API Endpoints

**Public:**

```
GET /api/health
  → { status: "healthy"|"degraded"|"unhealthy", checks: {...}, uptime }

GET /api/yields
  → { sources: YieldSource[] }  (7 sources with jittered APY/TVL)

GET /api/vault/stats
  → { tvl, totalShares, weightedApy, isVaultPaused }

GET /api/strategy/current
  → { allocations: StrategyAllocation[], weightedApy }
```

**Premium (x402-gated):**

```
GET /api/premium/yield-forecast         (0.10 STX)
  → { forecast: DayForecast[], summary }

GET /api/premium/strategy-signals       (0.15 STX)
  ?risk=conservative|balanced|aggressive
  → { allocations[], weightedApy, riskScore, reasoning }

GET /api/premium/portfolio-analytics    (0.20 STX)
  → { history: DaySnapshot[], sharpeRatio, maxDrawdown, topPerformers }
```

### AI Agent (yield-optimizer.ts)

The AI agent uses OpenAI GPT-4o-mini to analyze yield sources and recommend allocations.

```
                  ┌────────────────────┐
                  │  7 Yield Sources   │
                  │  (protocol, APY,   │
                  │   TVL, risk)       │
                  └────────┬───────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │  OpenAI GPT-4o-mini │
                  │  Temperature: 0.3  │
                  │  Max tokens: 1000  │
                  └────────┬───────────┘
                           │
                  ┌────────┴───────────┐
                  │                    │
               Success              Failure
                  │                    │
                  ▼                    ▼
         ┌──────────────┐    ┌──────────────────┐
         │ AI Allocation │    │ Deterministic    │
         │ (JSON parsed) │    │ Fallback         │
         └──────────────┘    │ (rule-based)     │
                              └──────────────────┘
```

**Risk Profiles (deterministic fallback):**

| Profile | Max High-Risk | Strategy |
|---------|--------------|----------|
| Conservative | 20% | Favor lending protocols (Zest, StackingDAO) |
| Balanced | 40% | Diversified across all protocol types |
| Aggressive | 60% | Maximize APY, heavier LP/vault allocation |

### Rate Limiting

Three tiers applied via `express-rate-limit`:

| Tier | Window | Max Requests | Applied To |
|------|--------|-------------|------------|
| Global | 15 min | 100 | All routes |
| Premium | 1 min | 10 | `/premium/*` |
| AI | 1 min | 5 | AI-intensive endpoints |

### Graceful Shutdown

```
SIGTERM/SIGINT received
  │
  ├─ Log "Shutting down gracefully..."
  ├─ Stop accepting new connections
  ├─ Wait up to 10s for in-flight requests to drain
  ├─ Close server
  └─ Exit process
```

---

## Frontend

React 19 single-page application with three pages, real wallet integration, and data polling.

### Page Architecture

```
App.tsx (Router)
  │
  ├─ PageLayout (dark gradient bg, skip-to-content)
  │   ├─ Navbar (logo, nav links, wallet button)
  │   │
  │   ├─ Routes
  │   │   ├─ /           → Dashboard.tsx
  │   │   ├─ /yields     → Yields.tsx
  │   │   └─ /analytics  → Analytics.tsx
  │   │
  │   └─ Footer
  │
  └─ Providers: BrowserRouter (main.tsx)
```

### Component Tree — Dashboard

```
Dashboard
  ├─ StatsGrid
  │   └─ StatCard × 4 (TVL, Total Shares, Weighted APY, Active Strategies)
  │
  ├─ StrategyPanel
  │   └─ AllocationPieChart (recharts PieChart, donut style)
  │
  ├─ DepositWithdrawPanel
  │   ├─ Tab: Deposit | Withdraw
  │   ├─ Asset selector dropdown
  │   ├─ Amount input + quick-select buttons (25%, 50%, 75%, MAX)
  │   └─ Submit button (opens Stacks wallet for signing)
  │
  ├─ YieldTable (sortable: protocol, asset, APY, TVL, risk)
  │   └─ RiskBadge (green/yellow/red pill)
  │
  ├─ HowItWorks (3-step cards)
  │
  └─ PremiumSection (x402 pricing cards)
```

### Data Flow

```
                    ┌─────────────────────┐
                    │  useVaultData hook   │
                    │  (polls every 30s)   │
                    └─────┬───────────────┘
                          │
              ┌───────────┼───────────────┐
              ▼           ▼               ▼
       GET /yields   GET /vault/stats  GET /strategy/current
              │           │               │
              └───────────┼───────────────┘
                          │
                   ┌──────┴──────┐
                   │             │
                Success       Failure
                   │             │
                   ▼             ▼
              API data      Mock data
              (source:       (fallback)
               "chain")
                   │             │
                   └──────┬──────┘
                          │
                          ▼
               { vaultStats, yields,
                 allocations, weightedApy,
                 loading, error, refetch }
                          │
                          ▼
                    Components render
```

### Wallet Integration

```
useWallet hook
  │
  ├─ connect()
  │   └─ showConnect({
  │        appDetails: { name, icon },
  │        onFinish: (data) → save address to localStorage
  │      })
  │
  ├─ disconnect()
  │   └─ Clear localStorage + reset state
  │
  ├─ State
  │   ├─ address: string | null
  │   ├─ isConnected: boolean
  │   └─ displayAddress: "ST1PQ...PGZGM" (truncated)
  │
  └─ Persistence: localStorage key "stacks-wallet-address"
```

### Transaction Flow (Deposit/Withdraw)

```
User clicks "Deposit 1000 sBTC"
  │
  ├─ DepositWithdrawPanel validates amount
  ├─ openContractCall({
  │     contractAddress: deployer,
  │     contractName: "vault-core",
  │     functionName: "deposit",
  │     functionArgs: [token-principal, uint(1000)]
  │   })
  │
  ├─ Hiro/Leather wallet opens signing dialog
  │   ├─ User approves → tx broadcast
  │   └─ User rejects → cancel
  │
  └─ UI updates after polling detects new balance
```

### Design System

**Color Palette:**

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0f` | Page background |
| Surface | `#111118` | Card backgrounds |
| Elevated | `#1a1a24` | Hover states, modals |
| Brand | `#f97316` (orange-500) | Primary buttons, accents |
| Brand Hover | `#fb923c` (orange-400) | Button hover states |
| Info | `#3b82f6` (blue-500) | Links, informational badges |
| Success | `#22c55e` (green-500) | Positive APY, gains |
| Danger | `#ef4444` (red-500) | Losses, errors, high risk |
| Text Primary | `#f8fafc` | Headings, important text |
| Text Secondary | `#94a3b8` | Body text, descriptions |
| Text Muted | `#64748b` | Labels, timestamps |
| Border | `#1e293b` | Card borders, dividers |

**Typography:**
- Headings: Space Grotesk (Google Fonts)
- Body: Inter (Google Fonts)

**Component Patterns:**
- Glassmorphism cards: `bg-white/5 backdrop-blur border border-white/10`
- Gradient orbs: Decorative background circles with brand color blur
- Risk badges: Color-coded pills (green/yellow/red) with Lucide icons

---

## Security Model

### Smart Contract Security

| Threat | Mitigation |
|--------|-----------|
| Funds trapped during emergency | `emergency-withdraw` bypasses pause guard |
| Unauthorized fund transfer | Rebalance targets must be whitelisted by owner |
| Token minting exploit | Single authorized minter (vault-core only), no dual-auth |
| Allocation state corruption | Deactivate saves allocation; activate restores it |
| Spam / DoS | Per-block rate limiting (MAX_ACTIONS_PER_BLOCK = 10) |
| Replay / audit gap | All state changes emit `(print)` events |

### Backend Security

| Threat | Mitigation |
|--------|-----------|
| Unauthorized premium access | x402 payment middleware on all premium routes |
| Input injection | Zod validation on all user inputs |
| API abuse | 3-tier rate limiting (global, premium, AI) |
| CORS abuse | Origin whitelist (localhost:5173 only) |
| Unhandled errors leaking internals | Global error handler returns sanitized responses |
| Unclean shutdown | Graceful shutdown with connection draining |

### Authorization Summary

```
Smart Contracts:
  Owner (deployer)  ─── Full admin: pause, whitelist, rebalance, add agents
  AI Agents         ─── update-allocation only (via authorized-agents map)
  Users             ─── deposit, withdraw, emergency-withdraw, transfer cfYIELD

Backend:
  Public            ─── /health, /yields, /vault/stats, /strategy/current
  x402 Paid         ─── /premium/* (requires payment header)

Frontend:
  Unauthenticated   ─── View dashboard, yields, analytics
  Wallet Connected  ─── Deposit, withdraw (opens wallet for signing)
```

---

## Testing Architecture

### Test Environment

```
vitest.config.js
  │
  ├─ environment: "clarinet"        (Clarinet SDK simnet)
  ├─ singleFork: true               (required for simnet)
  ├─ singleThread: true             (required for simnet)
  └─ reporter: ["verbose"]
```

Each `it()` block receives a fresh simnet instance with:
- 9 pre-funded wallets (100B STX + 1B sBTC each)
- All 4 contracts deployed in genesis batch
- Clean state (no prior transactions)

### Test Categories

```
Unit Tests (52 tests)
  ├─ vault-core.test.ts     (16) — deposit, withdraw, emergency, pause, whitelist, rebalance
  ├─ strategy-router.test.ts (15) — add, update, deactivate, activate, agents, overflow
  ├─ yield-token.test.ts    (11) — transfer, mint/burn auth, minter management
  └─ fee-collector.test.ts  (14) — STX fees, token fees, withdrawal, precision

Integration Tests (6 tests)
  └─ integration.test.ts    — full lifecycle, multi-user, cross-contract flows
```

### Test Setup Pattern

Most tests follow this setup sequence:

```typescript
// 1. Get accounts
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

// 2. Mint tokens to test user (deployer is default minter)
simnet.callPublicFn("yield-token", "mint",
  [Cl.uint(100000), Cl.principal(wallet1)], deployer);

// 3. Set vault-core as authorized minter
simnet.callPublicFn("yield-token", "set-authorized-minter",
  [Cl.principal(`${deployer}.vault-core`)], deployer);

// 4. Whitelist token in vault
simnet.callPublicFn("vault-core", "add-whitelisted-token",
  [Cl.principal(`${deployer}.yield-token`)], deployer);

// 5. Now test operations (deposit, withdraw, etc.)
```

---

## Deployment

### Network Configuration

| Network | Config | Node | Purpose |
|---------|--------|------|---------|
| Simnet | `deployments/default.simnet-plan.yaml` | In-memory (Vitest) | Testing |
| Devnet | `settings/Devnet.toml` | Local Bitcoin + Stacks | Development |
| Testnet | `settings/Testnet.toml` | Public testnet | Staging |
| Mainnet | `settings/Mainnet.toml` | Public mainnet | Production |

### Contract Deployment Order

All 4 contracts deploy in a single batch (no inter-contract deployment dependencies):

```
Batch 0 (genesis / single deployment):
  ├─ fee-collector.clar
  ├─ strategy-router.clar
  ├─ vault-core.clar
  └─ yield-token.clar
```

### Post-Deployment Setup

After deploying contracts, these on-chain transactions are required:

```
1. yield-token::set-authorized-minter(vault-core)
   → Allows vault to mint/burn shares

2. vault-core::add-whitelisted-token(yield-token)
   → Allows cfYIELD deposits

3. vault-core::add-whitelisted-token(sBTC-contract)
   → Allows sBTC deposits

4. vault-core::add-whitelisted-target(zest-protocol)
   vault-core::add-whitelisted-target(bitflow-protocol)
   vault-core::add-whitelisted-target(stackingdao-protocol)
   vault-core::add-whitelisted-target(hermetica-protocol)
   → Whitelist rebalance destinations

5. strategy-router::add-strategy("Zest sBTC", zest-addr, 2500)
   strategy-router::add-strategy("Bitflow LP", bitflow-addr, 2000)
   strategy-router::add-strategy("StackingDAO", stackingdao-addr, 3000)
   strategy-router::add-strategy("Hermetica", hermetica-addr, 1500)
   strategy-router::add-strategy("Reserve", vault-addr, 1000)
   → Initialize strategies (total = 10,000 bps)

6. strategy-router::add-agent(ai-agent-address)
   → Authorize the AI backend to update allocations

7. Update backend/.env with deployed contract addresses
   Update frontend constants with contract addresses
```

### Infrastructure

```
Production deployment:

  Frontend:  Static site (Vercel, Netlify, or IPFS)
             └─ VITE_API_URL → backend URL

  Backend:   Node.js process (Railway, Render, or VPS)
             └─ .env with production keys
             └─ STACKS_NETWORK=mainnet

  Contracts: On-chain (Stacks mainnet)
             └─ Deployed via Clarinet
```
