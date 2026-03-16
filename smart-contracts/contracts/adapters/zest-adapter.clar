;; title: zest-adapter
;; version: 1.0.0
;; summary: Adapter for Zest Protocol sBTC lending
;; description: Deposits sBTC into Zest lending pools and harvests interest yield.
;;   On simnet/testnet this is a mock that tracks balances internally.

;; constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u402))
(define-constant ERR-INVALID-AMOUNT (err u403))

;; Simulated APY: 5.2% annualized, but harvest returns a configurable yield amount
(define-data-var deposited-balance uint u0)
(define-data-var pending-yield uint u0)
(define-data-var authorized-caller principal tx-sender) ;; vault-core-v2

;; Owner: set authorized caller (vault-core-v2)
(define-public (set-authorized-caller (caller principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set authorized-caller caller)
    (ok true)
  )
)

;; Owner: simulate yield accrual (for testing - in production this comes from Zest)
(define-public (simulate-yield (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set pending-yield (+ (var-get pending-yield) amount))
    (ok amount)
  )
)

;; Adapter trait: deposit
(define-public (adapter-deposit (amount uint))
  (begin
    (asserts! (or (is-eq contract-caller (var-get authorized-caller))
                  (is-eq tx-sender CONTRACT-OWNER)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (var-set deposited-balance (+ (var-get deposited-balance) amount))
    (print {event: "zest-deposit", amount: amount, new-balance: (var-get deposited-balance)})
    (ok amount)
  )
)

;; Adapter trait: withdraw
(define-public (adapter-withdraw (amount uint))
  (begin
    (asserts! (or (is-eq contract-caller (var-get authorized-caller))
                  (is-eq tx-sender CONTRACT-OWNER)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= amount (var-get deposited-balance)) ERR-INSUFFICIENT-BALANCE)
    (var-set deposited-balance (- (var-get deposited-balance) amount))
    (print {event: "zest-withdraw", amount: amount, new-balance: (var-get deposited-balance)})
    (ok amount)
  )
)

;; Adapter trait: get-balance
(define-read-only (get-balance)
  (ok (var-get deposited-balance))
)

;; Adapter trait: harvest
(define-public (harvest)
  (let (
    (yield-amount (var-get pending-yield))
  )
    (asserts! (or (is-eq contract-caller (var-get authorized-caller))
                  (is-eq tx-sender CONTRACT-OWNER)) ERR-NOT-AUTHORIZED)
    (var-set pending-yield u0)
    (print {event: "zest-harvest", yield: yield-amount})
    (ok yield-amount)
  )
)

;; Read-only helpers
(define-read-only (get-pending-yield)
  (ok (var-get pending-yield))
)

(define-read-only (get-authorized-caller)
  (ok (var-get authorized-caller))
)
