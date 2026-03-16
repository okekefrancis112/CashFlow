;; title: strategy-router
;; version: 1.0.0
;; summary: Manages yield strategy allocations for CashFlow
;; description: AI agent recommends allocations, owner/agent executes rebalances through this router

;; constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant MAX-ALLOCATION u10000) ;; 100% = 10000 basis points
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INVALID-ALLOCATION (err u402))
(define-constant ERR-UNKNOWN-STRATEGY (err u403))
(define-constant ERR-ALLOCATION-OVERFLOW (err u404))
(define-constant ERR-INVALID-INPUT (err u405))

;; data vars
(define-data-var strategy-count uint u0)
(define-data-var total-allocation-bps uint u0)

;; data maps
(define-map strategies uint
  {
    name: (string-ascii 64),
    protocol-address: principal,
    allocation-bps: uint,
    is-active: bool
  }
)

(define-map strategy-saved-allocation uint uint)  ;; preserved allocation on deactivation
(define-map authorized-agents principal bool)

;; private functions

(define-private (is-owner-or-agent)
  (or (is-eq tx-sender CONTRACT-OWNER)
      (default-to false (map-get? authorized-agents tx-sender)))
)

;; public functions

;; Add a new yield strategy (owner only)
(define-public (add-strategy (name (string-ascii 64)) (protocol-address principal) (allocation-bps uint))
  (let (
    (new-id (var-get strategy-count))
    (new-total (+ (var-get total-allocation-bps) allocation-bps))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-total MAX-ALLOCATION) ERR-ALLOCATION-OVERFLOW)
    (asserts! (<= allocation-bps MAX-ALLOCATION) ERR-INVALID-ALLOCATION)
    (map-set strategies new-id {
      name: name,
      protocol-address: protocol-address,
      allocation-bps: allocation-bps,
      is-active: true
    })
    (var-set strategy-count (+ new-id u1))
    (var-set total-allocation-bps new-total)
    (print {event: "strategy-added", id: new-id, name: name, target: protocol-address, allocation: allocation-bps})
    (ok new-id)
  )
)

;; Update a strategy's allocation weight (owner or authorized agent)
(define-public (update-allocation (strategy-id uint) (new-allocation-bps uint))
  (let (
    (strategy (unwrap! (map-get? strategies strategy-id) ERR-UNKNOWN-STRATEGY))
    (old-bps (get allocation-bps strategy))
    (new-total (+ (- (var-get total-allocation-bps) old-bps) new-allocation-bps))
  )
    (asserts! (is-owner-or-agent) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-total MAX-ALLOCATION) ERR-ALLOCATION-OVERFLOW)
    (asserts! (<= new-allocation-bps MAX-ALLOCATION) ERR-INVALID-ALLOCATION)
    (map-set strategies strategy-id (merge strategy {allocation-bps: new-allocation-bps}))
    (var-set total-allocation-bps new-total)
    (print {event: "allocation-updated", id: strategy-id, new-allocation: new-allocation-bps})
    (ok new-total)
  )
)

;; Deactivate a strategy - saves allocation before zeroing (owner only)
(define-public (deactivate-strategy (strategy-id uint))
  (let (
    (strategy (unwrap! (map-get? strategies strategy-id) ERR-UNKNOWN-STRATEGY))
    (alloc (get allocation-bps strategy))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (get is-active strategy) ERR-INVALID-INPUT)
    ;; Save allocation for later restoration
    (map-set strategy-saved-allocation strategy-id alloc)
    ;; Zero out and deactivate
    (var-set total-allocation-bps (- (var-get total-allocation-bps) alloc))
    (map-set strategies strategy-id (merge strategy {is-active: false, allocation-bps: u0}))
    (print {event: "strategy-deactivated", id: strategy-id, saved-allocation: alloc})
    (ok false)
  )
)

;; Activate a strategy - restores saved allocation (owner only)
(define-public (activate-strategy (strategy-id uint))
  (let (
    (strategy (unwrap! (map-get? strategies strategy-id) ERR-UNKNOWN-STRATEGY))
    (saved-alloc (default-to u0 (map-get? strategy-saved-allocation strategy-id)))
    (new-total (+ (var-get total-allocation-bps) saved-alloc))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (get is-active strategy)) ERR-INVALID-INPUT)
    (asserts! (<= new-total MAX-ALLOCATION) ERR-ALLOCATION-OVERFLOW)
    ;; Restore allocation and activate
    (map-set strategies strategy-id (merge strategy {is-active: true, allocation-bps: saved-alloc}))
    (var-set total-allocation-bps new-total)
    (print {event: "strategy-activated", id: strategy-id, restored-allocation: saved-alloc})
    (ok true)
  )
)

;; Authorize an AI agent address (owner only)
(define-public (add-agent (agent principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set authorized-agents agent true)
    (print {event: "agent-added", agent: agent})
    (ok true)
  )
)

;; Remove an AI agent (owner only)
(define-public (remove-agent (agent principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-delete authorized-agents agent)
    (print {event: "agent-removed", agent: agent})
    (ok true)
  )
)

;; Rotate an agent key: remove old, add new in one atomic call (owner only)
;; Use when a backend agent key is compromised or needs rotation
(define-public (rotate-agent (old-agent principal) (new-agent principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (default-to false (map-get? authorized-agents old-agent)) ERR-INVALID-INPUT)
    (map-delete authorized-agents old-agent)
    (map-set authorized-agents new-agent true)
    (print {event: "agent-rotated", old-agent: old-agent, new-agent: new-agent})
    (ok true)
  )
)

;; read only functions

(define-read-only (get-strategy (strategy-id uint))
  (ok (map-get? strategies strategy-id))
)

(define-read-only (get-strategy-count)
  (ok (var-get strategy-count))
)

(define-read-only (get-total-allocation)
  (ok (var-get total-allocation-bps))
)

(define-read-only (is-authorized-agent (agent principal))
  (ok (default-to false (map-get? authorized-agents agent)))
)

(define-read-only (get-allocation (strategy-id uint))
  (match (map-get? strategies strategy-id)
    strategy (ok (get allocation-bps strategy))
    ERR-UNKNOWN-STRATEGY
  )
)
