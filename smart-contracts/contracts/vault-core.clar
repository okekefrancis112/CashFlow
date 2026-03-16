;; title: vault-core
;; version: 2.0.0
;; summary: Core vault contract for CashFlow AI yield aggregator
;; description: Accepts sBTC/USDCx deposits, mints yield tokens, handles withdrawals and rebalancing
;; Changes v2.0: dynamic share pricing (ERC-4626 style) - shares appreciate as yield accrues

;; traits
(define-trait sip-010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 32) uint))
    (get-decimals () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

;; constants
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u402))
(define-constant ERR-INVALID-AMOUNT (err u403))
(define-constant ERR-UNKNOWN-TOKEN (err u404))
(define-constant ERR-VAULT-PAUSED (err u405))
(define-constant ERR-UNKNOWN-TARGET (err u406))
(define-constant ERR-DEPOSIT-CAP-EXCEEDED (err u407))
(define-constant ERR-REBALANCE-CAP-EXCEEDED (err u408))
(define-constant ERR-NO-PENDING-OWNER (err u409))
(define-constant PRECISION u1000000) ;; 6 decimal precision for share price math

;; data vars
(define-data-var contract-owner principal tx-sender)
(define-data-var proposed-owner (optional principal) none)
(define-data-var total-shares uint u0)
(define-data-var total-assets uint u0)            ;; total assets under management (deposits + yield)
(define-data-var vault-paused bool false)
(define-data-var deposit-cap-per-user uint u1000000000000) ;; 1M tokens (6 decimals) default
(define-data-var total-deposit-cap uint u10000000000000)   ;; 10M tokens default
(define-data-var max-rebalance-per-tx uint u1000000000000)  ;; 1M tokens default
(define-data-var current-total-deposited uint u0)           ;; global deposit counter
(define-data-var authorized-harvester principal tx-sender)  ;; can call report-yield

;; data maps
(define-map total-deposits principal uint)        ;; token principal -> total deposited
(define-map user-deposits                          ;; per-user per-token balance
  {user: principal, token: principal}
  uint
)
(define-map user-shares principal uint)            ;; user -> share balance
(define-map whitelisted-tokens principal bool)
(define-map whitelisted-targets principal bool)    ;; approved rebalance targets

;; private functions

(define-private (is-owner)
  (is-eq tx-sender (var-get contract-owner))
)

(define-private (not-paused)
  (not (var-get vault-paused))
)

;; Convert asset amount to shares: shares = (amount * totalShares) / totalAssets
;; First deposit is 1:1
(define-private (assets-to-shares (amount uint))
  (let (
    (ts (var-get total-shares))
    (ta (var-get total-assets))
  )
    (if (is-eq ts u0)
      amount
      (/ (* amount ts) ta)
    )
  )
)

;; Convert shares to asset amount: assets = (shares * totalAssets) / totalShares
(define-private (shares-to-assets (shares uint))
  (let (
    (ts (var-get total-shares))
    (ta (var-get total-assets))
  )
    (if (is-eq ts u0)
      shares
      (/ (* shares ta) ts)
    )
  )
)

;; public functions

;; Deposit a whitelisted SIP-010 token into the vault
(define-public (deposit (token <sip-010-trait>) (amount uint))
  (let (
    (token-principal (contract-of token))
    (current-user-deposit (default-to u0
      (map-get? user-deposits {user: tx-sender, token: token-principal})))
    (current-total (default-to u0
      (map-get? total-deposits token-principal)))
    (shares-minted (assets-to-shares amount))
  )
    ;; Guards
    (asserts! (not-paused) ERR-VAULT-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> shares-minted u0) ERR-INVALID-AMOUNT)
    (asserts! (default-to false (map-get? whitelisted-tokens token-principal))
              ERR-UNKNOWN-TOKEN)
    ;; Deposit cap checks
    (asserts! (<= (+ current-user-deposit amount) (var-get deposit-cap-per-user))
              ERR-DEPOSIT-CAP-EXCEEDED)
    (asserts! (<= (+ (var-get current-total-deposited) amount) (var-get total-deposit-cap))
              ERR-DEPOSIT-CAP-EXCEEDED)

    ;; Transfer token from user to vault
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

    ;; Update deposit tracking
    (map-set user-deposits
      {user: tx-sender, token: token-principal}
      (+ current-user-deposit amount))
    (map-set total-deposits token-principal (+ current-total amount))
    (var-set current-total-deposited (+ (var-get current-total-deposited) amount))

    ;; Mint proportional shares (dynamic pricing)
    (try! (contract-call? .yield-token mint shares-minted tx-sender))
    (map-set user-shares tx-sender
      (+ (default-to u0 (map-get? user-shares tx-sender)) shares-minted))
    (var-set total-shares (+ (var-get total-shares) shares-minted))
    (var-set total-assets (+ (var-get total-assets) amount))

    (print {event: "deposit", user: tx-sender, token: token-principal, amount: amount, shares: shares-minted})
    (ok shares-minted)
  )
)

;; Withdraw tokens by burning shares - user specifies share amount to burn
(define-public (withdraw (token <sip-010-trait>) (share-amount uint))
  (let (
    (user tx-sender)
    (token-principal (contract-of token))
    (current-shares (default-to u0 (map-get? user-shares tx-sender)))
    (asset-amount (shares-to-assets share-amount))
    (current-user-deposit (default-to u0
      (map-get? user-deposits {user: tx-sender, token: token-principal})))
    (current-total (default-to u0
      (map-get? total-deposits token-principal)))
    ;; Withdraw the lesser of computed asset value and tracked deposit (safety)
    (withdraw-amount (min asset-amount current-user-deposit))
  )
    ;; Guards
    (asserts! (not-paused) ERR-VAULT-PAUSED)
    (asserts! (> share-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= share-amount current-shares) ERR-INSUFFICIENT-BALANCE)
    (asserts! (> withdraw-amount u0) ERR-INSUFFICIENT-BALANCE)

    ;; Burn shares
    (try! (contract-call? .yield-token burn share-amount user))
    (map-set user-shares user (- current-shares share-amount))
    (var-set total-shares (- (var-get total-shares) share-amount))
    (var-set total-assets (- (var-get total-assets) withdraw-amount))

    ;; Transfer tokens back to user
    (try! (as-contract (contract-call? token transfer withdraw-amount tx-sender user none)))

    ;; Update deposit tracking
    (map-set user-deposits
      {user: user, token: token-principal}
      (- current-user-deposit withdraw-amount))
    (map-set total-deposits token-principal (- current-total withdraw-amount))
    (var-set current-total-deposited (- (var-get current-total-deposited) withdraw-amount))

    (print {event: "withdraw", user: tx-sender, token: token-principal, amount: withdraw-amount, shares-burned: share-amount})
    (ok withdraw-amount)
  )
)

;; Emergency withdraw - bypasses pause, share-based
(define-public (emergency-withdraw (token <sip-010-trait>) (share-amount uint))
  (let (
    (user tx-sender)
    (token-principal (contract-of token))
    (current-shares (default-to u0 (map-get? user-shares tx-sender)))
    (actual-shares (min share-amount current-shares))
    (asset-amount (shares-to-assets actual-shares))
    (current-user-deposit (default-to u0
      (map-get? user-deposits {user: tx-sender, token: token-principal})))
    (current-total (default-to u0
      (map-get? total-deposits token-principal)))
    (withdraw-amount (min asset-amount current-user-deposit))
  )
    ;; No pause check - this is the point of emergency-withdraw
    (asserts! (> share-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> withdraw-amount u0) ERR-INSUFFICIENT-BALANCE)

    ;; Burn shares
    (try! (contract-call? .yield-token burn actual-shares user))
    (map-set user-shares user (- current-shares actual-shares))
    (var-set total-shares (- (var-get total-shares) actual-shares))
    (var-set total-assets (- (var-get total-assets) withdraw-amount))

    ;; Transfer tokens back to user
    (try! (as-contract (contract-call? token transfer withdraw-amount tx-sender user none)))

    ;; Update deposit tracking
    (map-set user-deposits
      {user: user, token: token-principal}
      (- current-user-deposit withdraw-amount))
    (map-set total-deposits token-principal (- current-total withdraw-amount))
    (var-set current-total-deposited (- (var-get current-total-deposited) withdraw-amount))

    (print {event: "emergency-withdraw", user: user, token: token-principal, amount: withdraw-amount, shares-burned: actual-shares})
    (ok withdraw-amount)
  )
)

;; Report yield earned from strategies - increases total-assets, making shares worth more
;; Takes performance fee via fee-collector before adding to pool
(define-public (report-yield (yield-amount uint))
  (let (
    (fee-bps (unwrap-panic (contract-call? .fee-collector get-performance-fee-bps)))
    (fee (/ (* yield-amount fee-bps) u10000))
    (net-yield (- yield-amount fee))
  )
    (asserts! (or (is-owner) (is-eq tx-sender (var-get authorized-harvester))) ERR-NOT-AUTHORIZED)
    (asserts! (> yield-amount u0) ERR-INVALID-AMOUNT)

    ;; Record fee in fee-collector (accounting only, tokens stay in vault)
    (if (> fee u0)
      (begin (try! (contract-call? .fee-collector record-performance-fee fee)) true)
      true
    )

    ;; Increase total assets by net yield - share price goes up
    (var-set total-assets (+ (var-get total-assets) net-yield))

    (print {event: "yield-reported", gross: yield-amount, fee: fee, net: net-yield,
            new-total-assets: (var-get total-assets), total-shares: (var-get total-shares)})
    (ok net-yield)
  )
)

;; Owner: set authorized harvester (strategy-router or keeper bot)
(define-public (set-authorized-harvester (harvester principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (var-set authorized-harvester harvester)
    (print {event: "harvester-updated", harvester: harvester})
    (ok true)
  )
)

;; Owner/Agent: rebalance funds to a whitelisted yield protocol
(define-public (rebalance (token <sip-010-trait>) (amount uint) (target principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= amount (var-get max-rebalance-per-tx)) ERR-REBALANCE-CAP-EXCEEDED)
    (asserts! (default-to false (map-get? whitelisted-targets target)) ERR-UNKNOWN-TARGET)
    (try! (as-contract (contract-call? token transfer amount tx-sender target none)))
    (print {event: "rebalance", token: (contract-of token), amount: amount, target: target})
    (ok amount)
  )
)

;; Owner: whitelist a token for deposits
(define-public (add-whitelisted-token (token principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (map-set whitelisted-tokens token true)
    (print {event: "token-whitelisted", token: token})
    (ok true)
  )
)

;; Owner: remove a token from whitelist
(define-public (remove-whitelisted-token (token principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (map-delete whitelisted-tokens token)
    (ok true)
  )
)

;; Owner: whitelist a rebalance target
(define-public (add-whitelisted-target (target principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (map-set whitelisted-targets target true)
    (print {event: "target-whitelisted", target: target})
    (ok true)
  )
)

;; Owner: remove a rebalance target
(define-public (remove-whitelisted-target (target principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (map-delete whitelisted-targets target)
    (print {event: "target-removed", target: target})
    (ok true)
  )
)

;; Owner: emergency pause
(define-public (pause-vault)
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (var-set vault-paused true)
    (print {event: "vault-paused", caller: tx-sender})
    (ok true)
  )
)

;; Owner: unpause
(define-public (unpause-vault)
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (var-set vault-paused false)
    (print {event: "vault-unpaused", caller: tx-sender})
    (ok true)
  )
)

;; Owner: set deposit cap per user
(define-public (set-deposit-cap-per-user (cap uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> cap u0) ERR-INVALID-AMOUNT)
    (var-set deposit-cap-per-user cap)
    (print {event: "deposit-cap-per-user-updated", cap: cap})
    (ok true)
  )
)

;; Owner: set total deposit cap
(define-public (set-total-deposit-cap (cap uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> cap u0) ERR-INVALID-AMOUNT)
    (var-set total-deposit-cap cap)
    (print {event: "total-deposit-cap-updated", cap: cap})
    (ok true)
  )
)

;; Owner: set max rebalance per transaction
(define-public (set-max-rebalance-per-tx (cap uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> cap u0) ERR-INVALID-AMOUNT)
    (var-set max-rebalance-per-tx cap)
    (print {event: "max-rebalance-updated", cap: cap})
    (ok true)
  )
)

;; Two-step ownership transfer: step 1 - propose new owner
(define-public (propose-owner (new-owner principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (var-set proposed-owner (some new-owner))
    (print {event: "owner-proposed", proposed: new-owner, by: tx-sender})
    (ok true)
  )
)

;; Two-step ownership transfer: step 2 - accept ownership
(define-public (accept-ownership)
  (let (
    (pending (unwrap! (var-get proposed-owner) ERR-NO-PENDING-OWNER))
  )
    (asserts! (is-eq tx-sender pending) ERR-NOT-AUTHORIZED)
    (var-set contract-owner tx-sender)
    (var-set proposed-owner none)
    (print {event: "ownership-transferred", new-owner: tx-sender})
    (ok true)
  )
)

;; read only functions

(define-read-only (get-user-deposit (user principal) (token principal))
  (ok (default-to u0 (map-get? user-deposits {user: user, token: token})))
)

(define-read-only (get-total-deposit (token principal))
  (ok (default-to u0 (map-get? total-deposits token)))
)

(define-read-only (get-total-shares)
  (ok (var-get total-shares))
)

(define-read-only (get-user-shares (user principal))
  (ok (default-to u0 (map-get? user-shares user)))
)

(define-read-only (get-total-assets)
  (ok (var-get total-assets))
)

;; Share price with PRECISION decimals: price = (totalAssets * PRECISION) / totalShares
(define-read-only (get-share-price)
  (let (
    (ts (var-get total-shares))
    (ta (var-get total-assets))
  )
    (ok (if (is-eq ts u0)
      PRECISION  ;; 1.0 when no shares exist
      (/ (* ta PRECISION) ts)
    ))
  )
)

;; How many assets a given number of shares is worth
(define-read-only (get-assets-for-shares (shares uint))
  (let (
    (ts (var-get total-shares))
    (ta (var-get total-assets))
  )
    (ok (if (is-eq ts u0)
      shares
      (/ (* shares ta) ts)
    ))
  )
)

;; How many shares a given asset deposit would mint
(define-read-only (get-shares-for-assets (amount uint))
  (let (
    (ts (var-get total-shares))
    (ta (var-get total-assets))
  )
    (ok (if (is-eq ts u0)
      amount
      (/ (* amount ts) ta)
    ))
  )
)

(define-read-only (is-whitelisted (token principal))
  (ok (default-to false (map-get? whitelisted-tokens token)))
)

(define-read-only (is-paused)
  (ok (var-get vault-paused))
)

(define-read-only (get-owner)
  (ok (var-get contract-owner))
)

(define-read-only (get-proposed-owner)
  (ok (var-get proposed-owner))
)

(define-read-only (get-deposit-cap-per-user)
  (ok (var-get deposit-cap-per-user))
)

(define-read-only (get-total-deposit-cap)
  (ok (var-get total-deposit-cap))
)

(define-read-only (get-max-rebalance-per-tx)
  (ok (var-get max-rebalance-per-tx))
)

(define-read-only (get-current-total-deposited)
  (ok (var-get current-total-deposited))
)

(define-read-only (get-authorized-harvester)
  (ok (var-get authorized-harvester))
)

;; Private helper
(define-private (min (a uint) (b uint))
  (if (<= a b) a b)
)
