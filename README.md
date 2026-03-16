# CashFlow - AI-Powered sBTC Yield Aggregator

> Maximize your Bitcoin yield with AI-optimized DeFi strategies on Stacks. Pay-per-request intelligence via x402 micropayments.

Built for **BUIDL Battle #2 | The Bitcoin Builders Tournament** on [DoraHacks](https://dorahacks.io/hackathon/buidlbattle2).

---

## What is CashFlow?

CashFlow is an AI-powered yield aggregator that accepts **sBTC** and **USDCx** deposits, then automatically allocates capital across Stacks DeFi protocols (Zest, Bitflow, StackingDAO, Hermetica) to maximize yield. An OpenAI-powered agent continuously monitors APYs and rebalances positions based on user risk tolerance.

Premium yield intelligence — forecasts, strategy signals, and portfolio analytics — is available as a **paid API** via the **x402** HTTP payment protocol. No API keys needed; just micropay with STX.

### Key Features

- **AI Yield Optimization** — GPT-4o-mini analyzes 7 yield sources and recommends allocations tuned to conservative, balanced, or aggressive risk profiles
- **sBTC Vault** — Deposit sBTC, receive cfYIELD share tokens (SIP-010), withdraw anytime
- **Emergency Withdrawals** — Users can always withdraw funds, even when the vault is paused
- **x402 Micropayments** — Premium API endpoints gated by HTTP 402 payments, no API keys or subscriptions
- **On-Chain Strategy Management** — Basis-point allocation system with AI agent authorization for autonomous rebalancing
- **Real Wallet Integration** — Connect Hiro/Leather wallet via @stacks/connect for deposits and withdrawals
- **62 Smart Contract Tests** — Full coverage across 5 test suites with Clarinet SDK

---

## Bounty Coverage

| Bounty | Integration |
|--------|------------|
| **Best Use of USDCx** | First-class vault deposit asset, yield displayed in USD terms, USDCx lending strategy via Zest |
| **Most Innovative Use of sBTC** | AI-optimized yield aggregation across the entire sBTC DeFi ecosystem — Zest lending, Bitflow LPs, StackingDAO stacking, Hermetica vaults |
| **Best x402 Integration** | Paid AI yield intelligence API — developers and agents pay per-request for yield forecasts, strategy signals, and portfolio analytics |

---

## Architecture Overview

```
                    +---------------------------+
                    |     React Frontend        |
                    |  (Vite + Tailwind v4)     |
                    +------+--------+-----------+
                           |        |
              @stacks/connect    Axios + x402
              (wallet + tx)      (API calls)
                           |        |
                    +------+--------+-----------+
                    |     Express Backend       |
                    |  (x402, OpenAI, Stacks)   |
                    +------+--------+-----------+
                           |        |
                   Contract calls   OpenAI GPT-4o-mini
                   (read-only)      (yield analysis)
                           |
                    +------+--------------------+
                    |   Clarity Smart Contracts  |
                    |   (Stacks L2, Clarity 3)   |
                    +---------------------------+
                    | vault-core    | yield-token    |
                    | strategy-router | fee-collector |
                    +---------------------------+
```

For a deep dive, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Smart Contracts

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| `vault-core` | Deposit/withdraw sBTC, mint cfYIELD shares, emergency withdraw, rebalance to whitelisted targets | `deposit`, `withdraw`, `emergency-withdraw`, `rebalance` |
| `strategy-router` | Manage yield strategies with basis-point allocations, authorize AI agents | `add-strategy`, `update-allocation`, `deactivate-strategy`, `activate-strategy` |
| `yield-token` | SIP-010 fungible token (cfYIELD, 6 decimals) representing vault shares | `transfer`, `mint`, `burn` |
| `fee-collector` | Collect 10% performance fees on yield + x402 API revenue | `collect-fee`, `collect-token-fee`, `withdraw-fees` |

### Security Features

- **Emergency Withdrawal** — Users can withdraw even when the vault is paused (funds never trapped)
- **Rebalance Target Whitelist** — Owner must whitelist addresses before funds can be transferred
- **Single Authorized Minter** — Only vault-core can mint/burn cfYIELD (no dual-auth vulnerability)
- **Deactivate/Activate with Saved Allocation** — Strategy allocations are preserved across deactivation cycles
- **Rate Limiting** — Per-block action limits to prevent spam
- **Event Emissions** — All state-changing functions emit `(print {...})` events for audit trail

---

## x402 Premium API

Pay-per-request endpoints powered by the [x402 HTTP payment protocol](https://www.x402.org/). No API keys — just send a micropayment.

| Endpoint | Price | Description |
|----------|-------|------------|
| `GET /api/premium/yield-forecast` | 0.1 STX | AI-generated 7-day yield projections with confidence scores |
| `GET /api/premium/strategy-signals?risk=balanced` | 0.15 STX | Optimal allocation weights with AI reasoning per risk profile |
| `GET /api/premium/portfolio-analytics` | 0.2 STX | 30-day historical performance, Sharpe ratio, max drawdown |

### Free Public Endpoints

| Endpoint | Description |
|----------|------------|
| `GET /api/health` | Service health with dependency checks |
| `GET /api/yields` | Current yield sources across all protocols |
| `GET /api/vault/stats` | TVL, total shares, weighted APY |
| `GET /api/strategy/current` | Current strategy allocations |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Smart Contracts** | Clarity 3 on Stacks L2 (Epoch 3.2) |
| **Backend** | Node.js, Express, TypeScript, OpenAI GPT-4o-mini, @x402/express, Pino logging, Zod validation |
| **Frontend** | React 19, Vite 7, Tailwind CSS v4, recharts, @stacks/connect, react-router-dom |
| **Testing** | Vitest + Clarinet SDK (62 tests across 5 files) |
| **Tokens** | sBTC, USDCx (Circle xReserve), STX, cfYIELD (vault shares) |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Clarinet** ([install guide](https://docs.hiro.so/stacks/clarinet))
- **Hiro Wallet** or **Leather Wallet** (for frontend wallet connection)
- **OpenAI API key** (optional — AI agent falls back to deterministic allocation)

### 1. Clone & Install

```bash
git clone <repo-url> cashFlow
cd cashFlow
npm install           # Root: test dependencies (Clarinet SDK, Vitest)
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Smart Contracts

```bash
# Type-check all 4 contracts
clarinet check

# Run all 62 tests
npm test

# Run tests with coverage report
npm run test:report

# Watch mode (re-runs on .clar or .test.ts changes)
npm run test:watch

# Start local devnet (Bitcoin + Stacks nodes)
clarinet devnet start
```

### 3. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — at minimum set STACKS_NETWORK and WALLET_ADDRESS
npm run dev
# API running at http://localhost:4000
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env if backend is not on localhost:4000
npm run dev
# Dashboard at http://localhost:5173
```

### 5. Full Stack (all together)

Open three terminals:

```bash
# Terminal 1: Local devnet
clarinet devnet start

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

---

## Environment Variables

See [.env.example](.env.example) for the complete reference. Summary:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STACKS_NETWORK` | Yes | `testnet` | `devnet`, `testnet`, or `mainnet` |
| `WALLET_ADDRESS` | Yes | — | Deployer/owner STX address |
| `PRIVATE_KEY` | Mainnet | — | For on-chain writes |
| `OPENAI_API_KEY` | No | — | AI agent (falls back to deterministic) |
| `X402_FACILITATOR_URL` | No | `https://x402.aibtc.dev` | x402 payment facilitator |
| `PAYMENT_ADDRESS` | No | `WALLET_ADDRESS` | x402 payment recipient |
| `PORT` | No | `4000` | Backend server port |
| `VITE_API_URL` | No | `http://localhost:4000/api` | Frontend API base URL |

---

## Project Structure

```
cashFlow/
├── contracts/                        # Clarity 3 smart contracts
│   ├── vault-core.clar              # Core vault: deposit, withdraw, rebalance
│   ├── strategy-router.clar         # Strategy allocation management
│   ├── yield-token.clar             # SIP-010 share token (cfYIELD)
│   └── fee-collector.clar           # Performance fee collection
├── tests/                           # Vitest + Clarinet SDK (62 tests)
│   ├── vault-core.test.ts           # 16 tests
│   ├── strategy-router.test.ts      # 15 tests
│   ├── yield-token.test.ts          # 11 tests
│   ├── fee-collector.test.ts        # 14 tests
│   └── integration.test.ts          # 6 end-to-end tests
├── backend/
│   └── src/
│       ├── index.ts                 # Express server + graceful shutdown
│       ├── config/index.ts          # Environment config + validation
│       ├── api/routes.ts            # 4 public + 3 x402-protected endpoints
│       ├── agents/
│       │   └── yield-optimizer.ts   # GPT-4o-mini AI agent + fallback
│       ├── services/
│       │   ├── stacks.ts            # Contract read-only calls
│       │   └── yield-monitor.ts     # 7 yield sources with jitter
│       ├── middleware/
│       │   ├── validation.ts        # Zod input validation
│       │   ├── rate-limiter.ts      # 3-tier rate limiting
│       │   └── error-handler.ts     # Global error handler
│       └── lib/
│           ├── logger.ts            # Pino structured logging
│           └── response.ts          # Response envelope helper
├── frontend/
│   └── src/
│       ├── App.tsx                  # Router + layout wrapper
│       ├── main.tsx                 # React entry + BrowserRouter
│       ├── pages/
│       │   ├── Dashboard.tsx        # Main: stats, vault, strategies
│       │   ├── Yields.tsx           # Filterable yield table
│       │   └── Analytics.tsx        # Charts + premium upsell
│       ├── components/
│       │   ├── layout/              # Navbar, Footer, PageLayout
│       │   ├── vault/               # StatsGrid, DepositWithdrawPanel, HowItWorks
│       │   ├── strategy/            # StrategyPanel (pie chart + cards)
│       │   ├── yields/              # YieldTable (sortable)
│       │   ├── premium/             # PremiumSection (x402 pricing)
│       │   ├── charts/              # AllocationPieChart, ApyHistoryChart, TvlChart
│       │   └── common/              # LoadingSpinner, LoadingSkeleton, RiskBadge, StatCard
│       ├── hooks/
│       │   ├── useVaultData.ts      # Data polling (30s) with mock fallback
│       │   └── useWallet.ts         # @stacks/connect wallet integration
│       ├── lib/
│       │   ├── api.ts               # Axios instance
│       │   ├── format.ts            # Number/address formatters
│       │   ├── constants.ts         # Protocol metadata, contract addresses
│       │   ├── mock-data.ts         # Offline fallback data
│       │   └── utils.ts             # CSS utility (cn helper)
│       └── types/index.ts           # TypeScript interfaces
├── deployments/
│   └── default.simnet-plan.yaml     # Simnet genesis (9 wallets, 4 contracts)
├── settings/
│   ├── Devnet.toml                  # Local devnet config
│   ├── Testnet.toml                 # Testnet deployment config
│   └── Mainnet.toml                 # Mainnet deployment config
├── Clarinet.toml                    # Contract definitions (Clarity 3, Epoch 3.2)
├── CLAUDE.md                        # AI assistant instructions
├── ARCHITECTURE.md                  # Detailed architecture documentation
├── .env.example                     # All environment variables
├── package.json                     # Root: test scripts
├── vitest.config.js                 # Test config (single fork/thread)
└── tsconfig.json
```

---

## Testing

62 tests across 5 files, all using Vitest with the Clarinet SDK simnet environment.

```bash
npm test              # Run all tests
npm run test:report   # Tests with coverage
npm run test:watch    # Watch mode
```

### Test Breakdown

| File | Tests | Coverage |
|------|-------|----------|
| `vault-core.test.ts` | 16 | Deposit, withdraw, emergency withdraw, pause, whitelist, rebalance target validation |
| `strategy-router.test.ts` | 15 | Add/update strategies, deactivate/activate, AI agent auth, allocation overflow |
| `yield-token.test.ts` | 11 | SIP-010 transfer, mint/burn auth, minter management, supply tracking |
| `fee-collector.test.ts` | 14 | STX + token fee collection, withdrawal auth, fee precision, percentage updates |
| `integration.test.ts` | 6 | Full deposit-withdraw lifecycle, multi-user isolation, cross-contract flows |
| **Total** | **62** | |

Each `it()` block gets fresh simnet state — tests are fully self-contained.

---

## Deployment

### Testnet

```bash
# 1. Configure testnet deployer in settings/Testnet.toml
#    Add mnemonic for a funded STX testnet wallet

# 2. Generate deployment plan
clarinet deployments generate --testnet

# 3. Deploy all contracts
clarinet deployments apply -p deployments/default.testnet-plan.yaml

# 4. Update contract addresses in backend config
```

### Mainnet

```bash
# Same flow with --mainnet flag
clarinet deployments generate --mainnet
clarinet deployments apply -p deployments/default.mainnet-plan.yaml
```

---

## API Rate Limits

| Tier | Limit | Applies To |
|------|-------|------------|
| Global | 100 requests / 15 min | All endpoints |
| Premium | 10 requests / min | `/premium/*` |
| AI | 5 requests / min | AI-powered endpoints |

---

## Error Codes (Smart Contracts)

Error codes follow HTTP-style numbering:

| Code | Meaning | Example |
|------|---------|---------|
| `u401` | Not authorized | Non-owner calling admin function |
| `u402` | Insufficient balance | Withdrawing more than deposited |
| `u403` | Invalid amount | Zero-amount deposit |
| `u404` | Not found / unknown | Unwhitelisted token or strategy |
| `u405` | Invalid state | Vault paused, already active/inactive |
| `u406` | Unknown target | Non-whitelisted rebalance destination |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests to ensure nothing breaks (`npm test`)
4. Run `clarinet check` to validate contracts
5. Commit your changes
6. Push to the branch and open a Pull Request

---

## License

MIT
