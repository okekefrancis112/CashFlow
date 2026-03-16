;; title: vault-core-v2
;; version: 2.0.0
;; summary: NAV-based single-asset vault with inflation attack mitigation
;; description: Accepts a single token type, uses NAV-based share pricing with virtual offset
;;   (OpenZeppelin ERC-4626 pattern), slippage-protected withdrawals, yield/loss reporting,
;;   and automatic fee collection via fee-collector.

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
(define-constant ERR-SLIPPAGE (err u410))
(define-constant ERR-YIELD-CAP-EXCEEDED (err u411))
(define-constant ERR-COOLDOWN-ACTIVE (err u412))
(define-constant ERR-LOSS-CAP-EXCEEDED (err u413))
(define-constant ERR-TIMELOCK-NOT-READY (err u414))
(define-constant ERR-NO-PENDING-ACTION (err u415))
(define-constant ERR-ACTION-EXPIRED (err u416))

;; Virtual offset for inflation attack mitigation (1 token at 6 decimals)
(define-constant VIRTUAL-OFFSET u1000000)

;; data vars
(define-data-var contract-owner principal tx-sender)
(define-data-var proposed-owner (optional principal) none)
(define-data-var vault-paused bool false)

;; NAV tracking
(define-data-var total-assets uint u0)
(define-data-var total-shares uint u0)

;; Deposit caps
(define-data-var deposit-cap-per-user uint u1000000000000)  ;; 1M tokens default
(define-data-var total-deposit-cap uint u10000000000000)    ;; 10M tokens default

;; Rebalance cap
(define-data-var max-rebalance-per-tx uint u1000000000000)  ;; 1M tokens default

;; Yield reporting controls
(define-data-var max-yield-per-report uint u100000000000)   ;; 100K tokens default
(define-data-var min-blocks-between-reports uint u10)       ;; ~100 min on Stacks
(define-data-var last-report-block uint u0)

;; Loss reporting cap (max % of total-assets in basis points)
(define-data-var max-loss-bps uint u2000) ;; 20% max loss per report

;; Timelock for governance actions
(define-data-var timelock-delay uint u144)  ;; ~24h at 10min blocks
(define-data-var timelock-expiry uint u864) ;; ~6 days to execute before expiry

;; data maps
(define-map user-deposits principal uint)         ;; user -> total deposited (for cap tracking)
(define-map whitelisted-tokens principal bool)
(define-map whitelisted-targets principal bool)

;; Timelock: pending governance actions
;; action-id is a sequential counter; payload encoded as action-type + uint param
(define-data-var next-action-id uint u0)

(define-map pending-actions uint
  {
    action-type: (string-ascii 32),
    param-uint: uint,
    param-principal: (optional principal),
    created-at: uint,
    executed: bool
  }
)

;; private functions

(define-private (is-owner)
  (is-eq tx-sender (var-get contract-owner))
)

(define-private (not-paused)
  (not (var-get vault-paused))
)

(define-private (min (a uint) (b uint))
  (if (<= a b) a b)
)

;; Convert assets to shares: shares = (assets * (totalShares + OFFSET)) / (totalAssets + OFFSET)
(define-private (assets-to-shares (assets uint))
  (let (
    (ts (+ (var-get total-shares) VIRTUAL-OFFSET))
    (ta (+ (var-get total-assets) VIRTUAL-OFFSET))
  )
    (/ (* assets ts) ta)
  )
)

;; Convert shares to assets: assets = (shares * (totalAssets + OFFSET)) / (totalShares + OFFSET)
(define-private (shares-to-assets (shares uint))
  (let (
    (ts (+ (var-get total-shares) VIRTUAL-OFFSET))
    (ta (+ (var-get total-assets) VIRTUAL-OFFSET))
  )
    (/ (* shares ta) ts)
  )
)

;; public functions

;; Deposit a whitelisted SIP-010 token into the vault
(define-public (deposit (token <sip-010-trait>) (amount uint))
  (let (
    (token-principal (contract-of token))
    (current-user-deposit (default-to u0 (map-get? user-deposits tx-sender)))
    (shares (assets-to-shares amount))
  )
    ;; Guards
    (asserts! (not-paused) ERR-VAULT-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> shares u0) ERR-INVALID-AMOUNT)
    (asserts! (default-to false (map-get? whitelisted-tokens token-principal))
              ERR-UNKNOWN-TOKEN)
    ;; Deposit cap checks
    (asserts! (<= (+ current-user-deposit amount) (var-get deposit-cap-per-user))
              ERR-DEPOSIT-CAP-EXCEEDED)
    (asserts! (<= (+ (var-get total-assets) amount) (var-get total-deposit-cap))
              ERR-DEPOSIT-CAP-EXCEEDED)

    ;; Transfer token from user to vault
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

    ;; Update deposit tracking (for caps only)
    (map-set user-deposits tx-sender (+ current-user-deposit amount))

    ;; Mint proportional shares
    (try! (contract-call? .yield-token-v2 mint shares tx-sender))
    (var-set total-shares (+ (var-get total-shares) shares))
    (var-set total-assets (+ (var-get total-assets) amount))

    (print {event: "deposit", user: tx-sender, token: token-principal,
            amount: amount, shares: shares, share-price: (get-share-price-internal)})
    (ok shares)
  )
)

;; Withdraw tokens by burning shares, with slippage protection
(define-public (withdraw (token <sip-010-trait>) (shares uint) (min-amount uint))
  (let (
    (user tx-sender)
    (token-principal (contract-of token))
    (withdraw-amount (shares-to-assets shares))
    (current-user-deposit (default-to u0 (map-get? user-deposits user)))
  )
    ;; Guards
    (asserts! (not-paused) ERR-VAULT-PAUSED)
    (asserts! (> shares u0) ERR-INVALID-AMOUNT)
    (asserts! (>= withdraw-amount min-amount) ERR-SLIPPAGE)
    (asserts! (default-to false (map-get? whitelisted-tokens token-principal))
              ERR-UNKNOWN-TOKEN)

    ;; Burn shares
    (try! (contract-call? .yield-token-v2 burn shares user))
    (var-set total-shares (- (var-get total-shares) shares))

    ;; Transfer tokens back to user
    (try! (as-contract (contract-call? token transfer withdraw-amount tx-sender user none)))

    ;; Update tracking
    (var-set total-assets (- (var-get total-assets) withdraw-amount))
    (map-set user-deposits user
      (if (> current-user-deposit withdraw-amount)
        (- current-user-deposit withdraw-amount)
        u0))

    (print {event: "withdraw", user: user, token: token-principal,
            shares: shares, amount: withdraw-amount, share-price: (get-share-price-internal)})
    (ok withdraw-amount)
  )
)

;; Emergency withdraw - bypasses pause, no slippage check
(define-public (emergency-withdraw (token <sip-010-trait>) (shares uint))
  (let (
    (user tx-sender)
    (token-principal (contract-of token))
    (user-share-balance (unwrap! (contract-call? .yield-token-v2 get-balance user) ERR-INVALID-AMOUNT))
    (actual-shares (min shares user-share-balance))
    (withdraw-amount (shares-to-assets actual-shares))
    (current-user-deposit (default-to u0 (map-get? user-deposits user)))
  )
    ;; No pause check - that is the point
    (asserts! (> shares u0) ERR-INVALID-AMOUNT)
    (asserts! (> actual-shares u0) ERR-INSUFFICIENT-BALANCE)

    ;; Burn shares
    (try! (contract-call? .yield-token-v2 burn actual-shares user))
    (var-set total-shares (- (var-get total-shares) actual-shares))

    ;; Transfer tokens back to user
    (try! (as-contract (contract-call? token transfer withdraw-amount tx-sender user none)))

    ;; Update tracking
    (var-set total-assets (- (var-get total-assets) withdraw-amount))
    (map-set user-deposits user
      (if (> current-user-deposit withdraw-amount)
        (- current-user-deposit withdraw-amount)
        u0))

    (print {event: "emergency-withdraw", user: user, token: token-principal,
            shares: actual-shares, amount: withdraw-amount})
    (ok withdraw-amount)
  )
)

;; Owner/Agent: report yield earned from strategies
;; Increases total-assets (minus performance fee), changing share price
(define-public (report-yield (yield-amount uint))
  (let (
    (fee-bps (unwrap! (contract-call? .fee-collector get-performance-fee-bps) ERR-INVALID-AMOUNT))
    (fee (/ (* yield-amount fee-bps) u10000))
    (net-yield (- yield-amount fee))
  )
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> yield-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= yield-amount (var-get max-yield-per-report)) ERR-YIELD-CAP-EXCEEDED)
    (asserts! (>= stacks-block-height (+ (var-get last-report-block) (var-get min-blocks-between-reports)))
              ERR-COOLDOWN-ACTIVE)

    ;; Record fee in fee-collector
    (try! (contract-call? .fee-collector record-performance-fee fee))

    ;; Increase total-assets by net yield (fee excluded)
    (var-set total-assets (+ (var-get total-assets) net-yield))
    (var-set last-report-block stacks-block-height)

    (print {event: "yield-reported", yield: yield-amount, fee: fee,
            net-yield: net-yield, new-total-assets: (var-get total-assets),
            share-price: (get-share-price-internal)})
    (ok net-yield)
  )
)

;; Owner/Agent: report a loss (e.g. protocol exploit, IL)
;; Decreases total-assets, reducing share price
(define-public (report-loss (loss-amount uint))
  (let (
    (current-assets (var-get total-assets))
    (max-loss (/ (* current-assets (var-get max-loss-bps)) u10000))
    (actual-loss (min loss-amount current-assets))
  )
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> loss-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= loss-amount max-loss) ERR-LOSS-CAP-EXCEEDED)

    (var-set total-assets (- current-assets actual-loss))

    (print {event: "loss-reported", loss: actual-loss,
            new-total-assets: (var-get total-assets),
            share-price: (get-share-price-internal)})
    (ok actual-loss)
  )
)

;; Owner: rebalance funds to a whitelisted yield protocol
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
    (ok true)
  )
)

;; Owner: set total deposit cap
(define-public (set-total-deposit-cap (cap uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> cap u0) ERR-INVALID-AMOUNT)
    (var-set total-deposit-cap cap)
    (ok true)
  )
)

;; Owner: set max rebalance per tx
(define-public (set-max-rebalance-per-tx (cap uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> cap u0) ERR-INVALID-AMOUNT)
    (var-set max-rebalance-per-tx cap)
    (ok true)
  )
)

;; Owner: set max yield per report
(define-public (set-max-yield-per-report (cap uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> cap u0) ERR-INVALID-AMOUNT)
    (var-set max-yield-per-report cap)
    (ok true)
  )
)

;; Owner: set min blocks between yield reports
(define-public (set-min-blocks-between-reports (blocks uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (var-set min-blocks-between-reports blocks)
    (ok true)
  )
)

;; Owner: set max loss basis points per report
(define-public (set-max-loss-bps (bps uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (<= bps u10000) ERR-INVALID-AMOUNT)
    (var-set max-loss-bps bps)
    (ok true)
  )
)

;; --- Timelock governance ---

;; Queue a governance action (owner only). Returns action-id.
;; Supported action-types:
;;   "set-deposit-cap-user"    param-uint = cap
;;   "set-deposit-cap-total"   param-uint = cap
;;   "set-max-rebalance"       param-uint = cap
;;   "set-max-yield"           param-uint = cap
;;   "set-min-report-blocks"   param-uint = blocks
;;   "set-max-loss-bps"        param-uint = bps
;;   "add-token"               param-principal = token
;;   "remove-token"            param-principal = token
;;   "add-target"              param-principal = target
;;   "remove-target"           param-principal = target
(define-public (queue-action
    (action-type (string-ascii 32))
    (param-uint uint)
    (param-principal (optional principal)))
  (let (
    (action-id (var-get next-action-id))
  )
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (map-set pending-actions action-id {
      action-type: action-type,
      param-uint: param-uint,
      param-principal: param-principal,
      created-at: stacks-block-height,
      executed: false
    })
    (var-set next-action-id (+ action-id u1))
    (print {event: "action-queued", id: action-id, action-type: action-type,
            param-uint: param-uint, param-principal: param-principal,
            executable-at: (+ stacks-block-height (var-get timelock-delay))})
    (ok action-id)
  )
)

;; Execute a queued action after timelock delay has passed
(define-public (execute-action (action-id uint))
  (let (
    (action (unwrap! (map-get? pending-actions action-id) ERR-NO-PENDING-ACTION))
    (delay (var-get timelock-delay))
    (expiry (var-get timelock-expiry))
    (created (get created-at action))
  )
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (not (get executed action)) ERR-NO-PENDING-ACTION)
    (asserts! (>= stacks-block-height (+ created delay)) ERR-TIMELOCK-NOT-READY)
    (asserts! (<= stacks-block-height (+ created delay expiry)) ERR-ACTION-EXPIRED)

    ;; Mark as executed
    (map-set pending-actions action-id (merge action {executed: true}))

    ;; Dispatch based on action-type
    (if (is-eq (get action-type action) "set-deposit-cap-user")
      (begin (var-set deposit-cap-per-user (get param-uint action)) (ok true))
    (if (is-eq (get action-type action) "set-deposit-cap-total")
      (begin (var-set total-deposit-cap (get param-uint action)) (ok true))
    (if (is-eq (get action-type action) "set-max-rebalance")
      (begin (var-set max-rebalance-per-tx (get param-uint action)) (ok true))
    (if (is-eq (get action-type action) "set-max-yield")
      (begin (var-set max-yield-per-report (get param-uint action)) (ok true))
    (if (is-eq (get action-type action) "set-min-report-blocks")
      (begin (var-set min-blocks-between-reports (get param-uint action)) (ok true))
    (if (is-eq (get action-type action) "set-max-loss-bps")
      (begin (var-set max-loss-bps (get param-uint action)) (ok true))
    (if (is-eq (get action-type action) "add-token")
      (begin
        (map-set whitelisted-tokens (unwrap! (get param-principal action) ERR-INVALID-AMOUNT) true)
        (ok true))
    (if (is-eq (get action-type action) "remove-token")
      (begin
        (map-delete whitelisted-tokens (unwrap! (get param-principal action) ERR-INVALID-AMOUNT))
        (ok true))
    (if (is-eq (get action-type action) "add-target")
      (begin
        (map-set whitelisted-targets (unwrap! (get param-principal action) ERR-INVALID-AMOUNT) true)
        (ok true))
    (if (is-eq (get action-type action) "remove-target")
      (begin
        (map-delete whitelisted-targets (unwrap! (get param-principal action) ERR-INVALID-AMOUNT))
        (ok true))
      ERR-INVALID-AMOUNT))))))))))
  )
)

;; Cancel a queued action (owner only)
(define-public (cancel-action (action-id uint))
  (let (
    (action (unwrap! (map-get? pending-actions action-id) ERR-NO-PENDING-ACTION))
  )
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (not (get executed action)) ERR-NO-PENDING-ACTION)
    (map-set pending-actions action-id (merge action {executed: true}))
    (print {event: "action-cancelled", id: action-id})
    (ok true)
  )
)

;; Owner: set timelock delay (itself NOT timelocked - bootstrap only)
(define-public (set-timelock-delay (blocks uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (var-set timelock-delay blocks)
    (print {event: "timelock-delay-updated", blocks: blocks})
    (ok true)
  )
)

;; Two-step ownership transfer
(define-public (propose-owner (new-owner principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (var-set proposed-owner (some new-owner))
    (print {event: "owner-proposed", proposed: new-owner, by: tx-sender})
    (ok true)
  )
)

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

(define-private (get-share-price-internal)
  (/ (* (+ (var-get total-assets) VIRTUAL-OFFSET) u1000000)
     (+ (var-get total-shares) VIRTUAL-OFFSET))
)

(define-read-only (get-share-price)
  (ok (get-share-price-internal))
)

(define-read-only (get-total-assets)
  (ok (var-get total-assets))
)

(define-read-only (get-total-shares)
  (ok (var-get total-shares))
)

(define-read-only (get-user-deposit (user principal))
  (ok (default-to u0 (map-get? user-deposits user)))
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

(define-read-only (get-max-yield-per-report)
  (ok (var-get max-yield-per-report))
)

(define-read-only (get-min-blocks-between-reports)
  (ok (var-get min-blocks-between-reports))
)

(define-read-only (get-last-report-block)
  (ok (var-get last-report-block))
)

(define-read-only (get-max-loss-bps)
  (ok (var-get max-loss-bps))
)

(define-read-only (get-timelock-delay)
  (ok (var-get timelock-delay))
)

(define-read-only (get-pending-action (action-id uint))
  (ok (map-get? pending-actions action-id))
)

;; Preview functions for UI
(define-read-only (preview-deposit (amount uint))
  (ok (assets-to-shares amount))
)

(define-read-only (preview-withdraw (shares uint))
  (ok (shares-to-assets shares))
)
