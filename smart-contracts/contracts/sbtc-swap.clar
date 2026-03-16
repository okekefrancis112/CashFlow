;; title: sbtc-swap
;; version: 1.0.0
;; summary: Testnet swap - exchange STX for mock sBTC at a fixed rate
;; description: Users send STX and receive sBTC from the contract pool.
;;              Owner can set the rate and refill the pool.

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INVALID-AMOUNT (err u403))
(define-constant ERR-INSUFFICIENT-POOL (err u404))

;; Rate: how many micro-sBTC per 1 STX (1_000_000 micro-STX)
;; Default: 1 STX = 0.001 sBTC (1000 micro-sBTC)
(define-data-var swap-rate uint u1000)

;; Swap STX for sBTC
;; User sends `stx-amount` in micro-STX, receives sBTC based on the rate
(define-public (swap (stx-amount uint))
  (let (
    (sbtc-amount (/ (* stx-amount (var-get swap-rate)) u1000000))
    (pool-balance (unwrap-panic (contract-call? .sbtc-token get-balance (as-contract tx-sender))))
  )
    (asserts! (> stx-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= pool-balance sbtc-amount) ERR-INSUFFICIENT-POOL)

    ;; Take STX from user
    (try! (stx-transfer? stx-amount tx-sender (as-contract tx-sender)))

    ;; Send sBTC from pool to user
    (as-contract
      (contract-call? .sbtc-token transfer sbtc-amount tx-sender (unwrap-panic (get-user)) none)
    )
  )
)

;; Helper: get the original caller inside as-contract
(define-private (get-user)
  (ok contract-caller)
)

;; Owner: update the swap rate
(define-public (set-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set swap-rate new-rate)
    (ok true)
  )
)

;; Owner: withdraw collected STX
(define-public (withdraw-stx (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (as-contract (stx-transfer? amount tx-sender CONTRACT-OWNER))
  )
)

;; Read-only
(define-read-only (get-swap-rate)
  (ok (var-get swap-rate))
)

(define-read-only (get-pool-balance)
  (contract-call? .sbtc-token get-balance (as-contract tx-sender))
)
