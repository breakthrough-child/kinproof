# Sandbox verification log

Run against the live deployment (https://kinproof-nine.vercel.app) and the real PayPal Sandbox on **9 Nov 2026** (UTC). PayPal ids are sandbox ids. Everything here was observed, either in the app or by reading the object back from the PayPal API with the app's credentials.

**Setup:** `PAYPAL_MODE=sandbox`, `LLM_PROVIDER=gemini` (live), Supabase store, one sandbox REST app (`APP-3SM039454P022833H`) under a business account that holds the money (merchant `CR8GUUJPNZLEJ`) and has Payouts enabled. Ada pays from her sandbox personal buyer account. The hold is placed on Kinproof's own merchant account, and the recipient is paid with Payouts after confirmation.

## Money model check
| Check | Result |
|---|---|
| Orders created with no `payee` default to the app's own merchant | Order `8GU06765UL9516216` and `5H231646B07112833` both show payee merchant `CR8GUUJPNZLEJ` |
| Payouts enabled and funded | Probe batch `TC28X7B6XRS6N`, $1.00 to Chidi: `PENDING` → `PROCESSING` → **`SUCCESS`** |

## Flow A: scam is blocked (PASS)
Request `46173463-a5e4-468a-a615-2dc8073dea86`: the "new number, don't tell Dad, lawyer will call" message, $800 to `scammer@example.com` (not Chidi's account).

| Step | Observed |
|---|---|
| Live Gemini analysis | risk **high**; signals with quotes shown; payee mismatch flagged |
| Ada approves in the PayPal popup | order `8GU06765UL9516216` → authorization `0W083640SN6262923`; PayPal shows **`CREATED`**, $800.00, merchant `CR8GUUJPNZLEJ`; request `awaiting_confirmation` |
| Ada tries to confirm her own request | **HTTP 403** "Only the person being asked can answer this." |
| Chidi taps "No, that wasn't me" | request `blocked`; timeline `denied`, `voided` |
| PayPal authorization afterwards | **`VOIDED`** |
| **Final status** | blocked / authorization VOIDED |

## Flow B: genuine request is paid (PASS)
Request `ef8f06d1-c755-4061-bfed-0bbb06ceeb35`: St. Luke's deposit message, $350 to Chidi's verified PayPal (medium risk, so Chidi's confirmation is required).

| Step | Observed |
|---|---|
| Ada approves in PayPal | order `5H231646B07112833` → authorization `8RY409115A609293G`; PayPal shows **`CREATED`**, $350.00 |
| Chidi taps "Yes, it was me" | HTTP 200; request `released` |
| Capture | `6NJ5547700907413S`, PayPal shows **`COMPLETED`**, $350.00 |
| Payout to Chidi | batch `TS7MUUR9SCX9E`, one item, $350.00: **`SUCCESS`** (a single batch, so no double payment) |
| **Final status** | released / captured / paid out |

Not checked: Chidi's sandbox balance in the PayPal dashboard.

**A bug this run found, now fixed.** Chidi's confirmation and the page's reconcile-on-read both ran capture-then-payout within a second. The timeline showed `captured` twice and a spurious `payout_failed` ("User business error"), which was PayPal rejecting the duplicate payout batch id. No money was duplicated. The second caller now backs off when the request is already released (`lib/services/transfers.ts`), with a test for overlapping confirm and reconcile.

## Earlier failures that shaped the design (old sandbox app, kept for the record)
| PayPal debug id | What happened | What we learned |
|---|---|---|
| `f950542c179ac` | `TRANSACTION_REFUSED` authorizing an order whose payee was `scammer@example.com` | A payee that is not a real PayPal account cannot be authorized, so the recipient must not be the order payee |
| `f1977575ff6e6` | `PERMISSION_DENIED` voiding an authorization whose payee was another merchant account | Only the owning merchant can void or capture, so Kinproof holds the money itself and pays out afterwards |
| payout batch `RGMCTMRLUK9L4` | `PENDING`, then `DENIED` | The first app belonged to a locked or closed business account; a new app under a healthy account fixed it |

## Not run (be honest about these)
- [ ] **Flow C, redirect to a hospital:** void the original hold and pay a verified institution through a new order and payout. Covered by automated tests in mock mode only.
- [ ] **Expiry:** no answer for 15 minutes, with the cron voiding the hold. Covered in mock mode only; the cron runs daily on Vercel Hobby, and expiry also happens lazily on read.
- [ ] **Webhooks:** delivery and signature verification (`PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED`) against the new app. Handlers are tested for idempotency in mock mode.
- [ ] **Log in with PayPal linking:** the demo members are seeded as verified. A real link through the OAuth popup was not exercised.
- [ ] **Voice notes:** recording in the browser and uploading a WhatsApp `.opus` for transcription.
