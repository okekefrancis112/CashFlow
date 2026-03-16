;; title: yield-token
;; version: 1.0.0
;; summary: SIP-010 compliant vault share token for CashFlow
;; description: Represents proportional ownership of vault deposits. Minted on deposit, burned on withdrawal.

;; SIP-010 trait definition
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

;; token definitions
(define-fungible-token cfyield)

;; constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INVALID-AMOUNT (err u403))

;; data vars
(define-data-var token-uri (optional (string-utf8 256)) none)
(define-data-var authorized-minter principal tx-sender) ;; will be set to vault-core

;; public functions

;; Transfer tokens (SIP-010)
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (try! (ft-transfer? cfyield amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (print {event: "transfer", amount: amount, sender: sender, recipient: recipient})
    (ok true)
  )
)

;; Mint new share tokens - only callable by authorized minter (vault-core)
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq contract-caller (var-get authorized-minter)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (ft-mint? cfyield amount recipient))
    (print {event: "mint", amount: amount, recipient: recipient})
    (ok true)
  )
)

;; Burn share tokens - only callable by authorized minter (vault-core)
(define-public (burn (amount uint) (owner principal))
  (begin
    (asserts! (is-eq contract-caller (var-get authorized-minter)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (ft-burn? cfyield amount owner))
    (print {event: "burn", amount: amount, owner: owner})
    (ok true)
  )
)

;; Owner: set the authorized minter (vault-core contract)
(define-public (set-authorized-minter (new-minter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set authorized-minter new-minter)
    (print {event: "minter-updated", new-minter: new-minter})
    (ok true)
  )
)

;; Owner: update token URI
(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set token-uri new-uri)
    (ok true)
  )
)

;; read only functions (SIP-010)

(define-read-only (get-balance (who principal))
  (ok (ft-get-balance cfyield who))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply cfyield))
)

(define-read-only (get-name)
  (ok "CashFlow Yield Token")
)

(define-read-only (get-symbol)
  (ok "cfYIELD")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

(define-read-only (get-authorized-minter)
  (ok (var-get authorized-minter))
)
