;; title: usdcx-token
;; version: 1.0.0
;; summary: Mock USDCx SIP-010 token for testnet
;; description: Testnet-only mock of USDCx stablecoin for CashFlow vault deposits. Owner can mint to any address.

(define-fungible-token usdcx)

;; constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INVALID-AMOUNT (err u403))

;; data vars
(define-data-var token-uri (optional (string-utf8 256)) none)

;; SIP-010: transfer
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (try! (ft-transfer? usdcx amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

;; Owner: mint tokens (testnet faucet)
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (ft-mint? usdcx amount recipient)
  )
)

;; Public faucet: anyone can mint 10,000 USDCx to themselves (once per address)
(define-map faucet-claimed principal bool)
(define-constant FAUCET-AMOUNT u10000000000) ;; 10,000 USDCx (6 decimals)
(define-constant ERR-ALREADY-CLAIMED (err u409))

(define-public (faucet)
  (begin
    (asserts! (is-none (map-get? faucet-claimed tx-sender)) ERR-ALREADY-CLAIMED)
    (map-set faucet-claimed tx-sender true)
    (ft-mint? usdcx FAUCET-AMOUNT tx-sender)
  )
)

;; SIP-010: read-only functions
(define-read-only (get-balance (who principal))
  (ok (ft-get-balance usdcx who))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply usdcx))
)

(define-read-only (get-name)
  (ok "USDCx Stablecoin (Testnet)")
)

(define-read-only (get-symbol)
  (ok "USDCx")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)
