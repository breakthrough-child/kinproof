# Sandbox verification log

**Status: NOT YET RUN.** The build environment could not reach `developer.paypal.com` or `api-m.sandbox.paypal.com`, so everything below is a checklist to complete against real PayPal Sandbox before submitting. All automated tests (Vitest + Playwright) run against the mock PayPal client, which mirrors the same interface.

Setup: `PAYPAL_MODE=sandbox`, `LLM_PROVIDER=gemini` + `GEMINI_API_KEY`, Supabase configured, `pnpm seed:demo` done. Ada pays from her sandbox personal account.

## Flow A: scam is blocked
| Step | Expected | Observed |
|---|---|---|
| Log in with PayPal links Ada/Chidi (`/circle`) | member shows "PayPal verified" with sandbox email | |
| Ada submits scam text, $800 to a non-Chidi email | risk high | |
| PayPal popup, approve | order id: ____ ; authorization id: ____ ; status CREATED | |
| Chidi taps "No, that wasn't me" | `void` returns 204/200; request `blocked` | |
| PayPal dashboard shows authorization | VOIDED | |
| **Final status** | blocked / VOIDED | |

## Flow B: genuine request is paid
| Step | Expected | Observed |
|---|---|---|
| Ada requests $350 to Chidi's verified email | analyzed, `awaiting_confirmation` after approval | |
| PayPal order id / authorization id | ____ / ____ | |
| Chidi taps "Yes, it was me" | capture id: ____ ; status COMPLETED | |
| Chidi's sandbox balance | +$350 | |
| **Final status** | released / capture COMPLETED | |

## Flow C: redirect to hospital
Original authorization voided, new order to the hospital's business account captured. Order ids: ____ → ____

## Extras
- [ ] Live Gemini run: analysis returns valid structured output (check the request page shows no "AI check was unavailable" note) and a voice note transcribes (record in the browser and upload a WhatsApp `.opus`)
- [ ] Webhook delivered + signature verified (`PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED`); duplicate delivery ignored
- [ ] Expiry: no answer for 15 min → authorization voided by cron
- [ ] Any PayPal debug ids for failures: ____

**Known things to double-check against the live docs:** Log in with PayPal scopes/userinfo `schema`, `Prefer: return=representation` on authorize, `final_capture` on capture, and the void response shape.
