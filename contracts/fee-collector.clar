;; title: fee-collector
;; version: 1.0.0
;; summary: Collects performance fees and x402 API revenue for CashFlow
;; description: Accumulates fees from vault yield and x402 micropayments, allows owner withdrawal

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
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u402))
(define-constant ERR-INVALID-AMOUNT (err u403))

;; data vars
(define-data-var total-fees-collected uint u0)
(define-data-var performance-fee-bps uint u1000) ;; 10% = 1000 basis points
(define-data-var total-performance-fees uint u0)  ;; accumulated performance fees from yield reports
(define-data-var authorized-vault principal tx-sender) ;; set to vault-core-v2 after deploy

;; data maps
(define-map fee-balances principal uint)
(define-map token-fee-balances {source: principal, token: principal} uint)
(define-map total-token-fees principal uint)

;; public functions

;; Collect STX fee deposit
(define-public (collect-fee (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set fee-balances tx-sender
      (+ (default-to u0 (map-get? fee-balances tx-sender)) amount))
    (var-set total-fees-collected (+ (var-get total-fees-collected) amount))
    (print {event: "fee-collected", payer: tx-sender, amount: amount})
    (ok amount)
  )
)

;; Collect SIP-010 token fee (for sBTC/USDCx fees)
(define-public (collect-token-fee (token <sip-010-trait>) (amount uint))
  (let (
    (token-principal (contract-of token))
  )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
    (map-set token-fee-balances
      {source: tx-sender, token: token-principal}
      (+ (default-to u0 (map-get? token-fee-balances {source: tx-sender, token: token-principal})) amount))
    (map-set total-token-fees token-principal
      (+ (default-to u0 (map-get? total-token-fees token-principal)) amount))
    (ok amount)
  )
)

;; Owner: withdraw collected STX fees
(define-public (withdraw-fees (amount uint))
  (let (
    (owner CONTRACT-OWNER)
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= amount (var-get total-fees-collected)) ERR-INSUFFICIENT-BALANCE)
    (try! (as-contract (stx-transfer? amount tx-sender owner)))
    (var-set total-fees-collected (- (var-get total-fees-collected) amount))
    (print {event: "fees-withdrawn", recipient: tx-sender, amount: amount})
    (ok amount)
  )
)

;; Owner: withdraw collected token fees
(define-public (withdraw-token-fees (token <sip-010-trait>) (amount uint))
  (let (
    (owner CONTRACT-OWNER)
    (token-principal (contract-of token))
    (current-total (default-to u0 (map-get? total-token-fees token-principal)))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= amount current-total) ERR-INSUFFICIENT-BALANCE)
    (try! (as-contract (contract-call? token transfer amount tx-sender owner none)))
    (map-set total-token-fees token-principal (- current-total amount))
    (ok amount)
  )
)

;; Owner: update performance fee percentage
(define-public (update-fee-bps (new-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-bps u5000) ERR-INVALID-AMOUNT) ;; max 50%
    (var-set performance-fee-bps new-bps)
    (print {event: "fee-updated", new-bps: new-bps})
    (ok new-bps)
  )
)

;; Record performance fee from vault-core-v2 yield reports (no token transfer, just accounting)
;; Called by vault-core-v2 during report-yield; the fee is kept inside the vault as unredeemed
(define-public (record-performance-fee (fee-amount uint))
  (begin
    (asserts! (is-eq contract-caller (var-get authorized-vault)) ERR-NOT-AUTHORIZED)
    (asserts! (> fee-amount u0) ERR-INVALID-AMOUNT)
    (var-set total-performance-fees (+ (var-get total-performance-fees) fee-amount))
    (print {event: "performance-fee-recorded", amount: fee-amount, caller: contract-caller})
    (ok fee-amount)
  )
)

;; Owner: set the authorized vault contract
(define-public (set-authorized-vault (vault principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set authorized-vault vault)
    (print {event: "authorized-vault-updated", vault: vault})
    (ok true)
  )
)

;; read only functions

(define-read-only (get-total-fees)
  (ok (var-get total-fees-collected))
)

(define-read-only (get-fee-balance (who principal))
  (ok (default-to u0 (map-get? fee-balances who)))
)

(define-read-only (get-total-token-fees (token principal))
  (ok (default-to u0 (map-get? total-token-fees token)))
)

(define-read-only (get-performance-fee-bps)
  (ok (var-get performance-fee-bps))
)

;; Helper: calculate fee amount from a yield amount
(define-read-only (calculate-fee (yield-amount uint))
  (ok (/ (* yield-amount (var-get performance-fee-bps)) u10000))
)

(define-read-only (get-total-performance-fees)
  (ok (var-get total-performance-fees))
)

(define-read-only (get-authorized-vault)
  (ok (var-get authorized-vault))
)
