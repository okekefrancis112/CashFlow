# CashFlow Contract Invariants

Formal invariants for external audit. Each invariant should hold at all times unless explicitly noted.

## Scope

- `vault-core-v2.clar` (~550 lines) - NAV-based single-asset vault
- `yield-token-v2.clar` (~90 lines) - SIP-010 share token
- `fee-collector.clar` (~160 lines) - Performance fee + x402 revenue
- `strategy-router.clar` (~170 lines) - Allocation management + agent authorization
- `contracts/adapters/zest-adapter.clar` (~70 lines) - Zest lending adapter
- `contracts/adapters/stackingdao-adapter.clar` (~70 lines) - StackingDAO adapter

---

## vault-core-v2.clar

### INV-1: Share/Token Supply Sync
```
total-shares == yield-token-v2.get-total-supply()
```
Every `deposit` mints shares and increments `total-shares`. Every `withdraw`/`emergency-withdraw` burns shares and decrements `total-shares`. No other path creates or destroys shares.

### INV-2: Total Assets Accounting
```
total-assets >= 0
total-assets == sum(deposits) + sum(net-yields) - sum(withdrawals) - sum(losses)
```
`total-assets` is modified only by: `deposit` (+amount), `withdraw` (-amount), `emergency-withdraw` (-amount), `report-yield` (+(yield - fee)), `report-loss` (-loss). No other function changes `total-assets`.

### INV-3: Share Price Monotonicity
```
share-price only increases between report-loss calls
```
Between any two `report-loss` invocations, `get-share-price` is monotonically non-decreasing. Deposits and withdrawals do not change share price (they change both numerator and denominator proportionally). Only `report-yield` increases it, and `report-loss` decreases it.

### INV-4: Inflation Attack Mitigation
```
VIRTUAL-OFFSET = 1,000,000
shares = (assets * (total-shares + VIRTUAL-OFFSET)) / (total-assets + VIRTUAL-OFFSET)
```
The virtual offset ensures the denominator is never near zero, preventing an attacker from manipulating share price by front-running the first depositor. An attacker donating tokens to inflate share price gains at most dust-level advantage.

### INV-5: Slippage Protection
```
For withdraw(token, shares, min-amount):
  withdraw-amount >= min-amount OR transaction reverts
```
Users specify a minimum acceptable withdrawal amount. If share price has moved unfavorably since the transaction was signed, the withdrawal reverts with ERR-SLIPPAGE (u410).

### INV-6: Deposit Cap Enforcement
```
user-deposits[user] + amount <= deposit-cap-per-user
total-assets + amount <= total-deposit-cap
```
Both per-user and total deposit caps are checked on every deposit. No deposit can exceed either cap.

### INV-7: Yield Report Safeguards
```
yield-amount <= max-yield-per-report
stacks-block-height >= last-report-block + min-blocks-between-reports
```
Yield reports are bounded by a maximum amount and a cooldown period. These are enforced on-chain to limit damage from a compromised agent key.

### INV-8: Loss Report Safeguard
```
loss-amount <= (total-assets * max-loss-bps) / 10000
```
Loss reports are capped at a percentage of total assets to prevent griefing.

### INV-9: Rebalance Cap
```
amount <= max-rebalance-per-tx
target must be in whitelisted-targets
```
Each rebalance transaction is capped and only sends to whitelisted protocol addresses.

### INV-10: Emergency Withdraw Availability
```
emergency-withdraw is NOT gated by vault-paused
```
Users can always exit via `emergency-withdraw`, even when the vault is paused. This is the core safety guarantee.

### INV-11: Ownership Transfer Safety
```
propose-owner sets proposed-owner
accept-ownership requires tx-sender == proposed-owner
No single transaction can change the owner
```
Two-step ownership transfer prevents accidental ownership loss to a wrong address.

### INV-12: Timelock Governance
```
For timelocked actions:
  stacks-block-height >= action.created-at + timelock-delay
  stacks-block-height <= action.created-at + timelock-delay + timelock-expiry
  action.executed == false
```
Governance actions (cap changes, whitelist changes) must wait `timelock-delay` blocks after being queued. Actions expire after `timelock-expiry` blocks if not executed.

Note: `pause-vault`, `unpause-vault`, and ownership transfer are NOT timelocked (emergency operations must be instant).

---

## yield-token-v2.clar

### INV-13: Single Authorized Minter
```
Only authorized-minter can call mint() and burn()
authorized-minter is set to vault-core-v2 at deployment
```
No entity other than vault-core-v2 can create or destroy shares.

### INV-14: SIP-010 Compliance
```
transfer, get-balance, get-total-supply, get-name, get-symbol, get-decimals, get-token-uri
all conform to SIP-010 specification
```

---

## fee-collector.clar

### INV-15: Fee Calculation Precision
```
fee = (yield-amount * performance-fee-bps) / 10000
performance-fee-bps <= 5000 (max 50%)
```
Integer division truncates toward zero (conservative: vault keeps the remainder).

### INV-16: Performance Fee Recording
```
record-performance-fee is only callable by authorized-vault
total-performance-fees is monotonically non-decreasing
```
Only vault-core-v2 (set via `set-authorized-vault`) can record performance fees. No function decreases `total-performance-fees`.

### INV-17: Fee Withdrawal Authorization
```
Only CONTRACT-OWNER can call withdraw-fees and withdraw-token-fees
Withdrawn amount <= total-fees-collected (STX) or total-token-fees[token] (SIP-010)
```

---

## strategy-router.clar

### INV-18: Allocation Bounds
```
total-allocation-bps <= 10000 (100%)
For each strategy: allocation-bps <= 10000
```
No combination of allocations can exceed 100%.

### INV-19: Agent Authorization
```
Only CONTRACT-OWNER can add-agent, remove-agent, rotate-agent
update-allocation requires owner OR authorized agent
add-strategy, deactivate-strategy, activate-strategy require owner only
```

### INV-20: Agent Rotation Atomicity
```
rotate-agent(old, new):
  pre: authorized-agents[old] == true
  post: authorized-agents[old] == deleted AND authorized-agents[new] == true
```
Key rotation is atomic - no window where both or neither key is valid.

### INV-21: Strategy Deactivation Conservation
```
deactivate-strategy saves allocation to strategy-saved-allocation
activate-strategy restores saved allocation
Deactivated strategy has allocation-bps == 0 and is-active == false
```

---

## Adapter Contracts (zest-adapter, stackingdao-adapter)

### INV-22: Authorized Caller
```
adapter-deposit, adapter-withdraw, harvest are only callable by authorized-caller
Only CONTRACT-OWNER can set-authorized-caller
```

### INV-23: Balance Tracking
```
deposited-balance tracks cumulative deposits minus withdrawals
adapter-withdraw reverts if amount > deposited-balance
```

### INV-24: Harvest Idempotency
```
harvest returns pending-yield and resets it to 0
Calling harvest with pending-yield == 0 returns 0 (no-op, does not revert)
```

---

## Cross-Contract Invariants

### INV-25: Fee Auto-Collection During Yield
```
vault-core-v2.report-yield calls fee-collector.record-performance-fee
total-assets increases by (yield - fee), not by full yield
```
Fees are never double-counted or skipped.

### INV-26: Token Flow Conservation
```
For any token T at any time:
  T.balance(vault-core-v2) + sum(T.balance(adapters)) >= total-assets
```
The vault's on-chain token balance plus adapter balances should always cover the tracked `total-assets`. Discrepancies indicate a bug or exploit.

### INV-27: No Reentrancy via SIP-010
```
All state updates (total-shares, total-assets, user-deposits) occur
AFTER external contract calls (token transfers, fee recording)
```
Note: Clarity's execution model prevents reentrancy by design (no dynamic dispatch within a transaction). This invariant documents the intent for auditor reference.

---

## Priority for Audit

1. **Critical**: INV-1, INV-2, INV-4, INV-25, INV-26 (NAV math, inflation attack, fee accounting)
2. **High**: INV-5, INV-6, INV-7, INV-8, INV-9 (safety caps and slippage)
3. **Medium**: INV-10, INV-11, INV-12 (emergency access, ownership, timelock)
4. **Standard**: INV-13 through INV-24 (token compliance, authorization, adapter behavior)
