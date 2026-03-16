;; title: adapter-trait
;; version: 1.0.0
;; summary: Standard interface for CashFlow yield protocol adapters
;; description: All yield adapters (Zest, StackingDAO, Bitflow, etc.) implement this trait

(define-trait adapter-trait
  (
    ;; Deposit tokens into the protocol. Returns amount actually deposited.
    (adapter-deposit (uint) (response uint uint))

    ;; Withdraw tokens from the protocol. Returns amount actually withdrawn.
    (adapter-withdraw (uint) (response uint uint))

    ;; Get the current balance held by this adapter in the protocol.
    (get-balance () (response uint uint))

    ;; Harvest earned yield. Returns yield amount harvested.
    (harvest () (response uint uint))
  )
)
