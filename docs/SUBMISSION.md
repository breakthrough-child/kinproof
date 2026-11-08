# Devpost submission text (ready to paste)

## Project name
Kinproof

## Tagline
Proof of person, not proof of voice.

## Inspiration
A relative's voice can now be cloned from a few seconds of audio. A frightened parent hears their child say "I've had an accident, don't tell Dad, send money now," and sends it. Detecting fake voices is an arms race detectors lose, and "agree a family codeword" almost never happens. We asked a different question: what does a scammer *not* have? The real family member's own signed-in account, on their own phone.

## What it does
Kinproof sits between a payer and a payment. A family forms a circle and each member links their PayPal with Log in with PayPal. When someone asks Mum for money, she tells Kinproof who is asking, pastes the message or uploads the voice note, and approves the payment in PayPal, where it is **authorized, not captured**. Rules plus an LLM (Google Gemini) score the message for scam pressure (urgency, secrecy, new numbers, mismatched payees, gift cards and crypto, third-party hand-offs, fake celebrities and prompt-injection attempts), in English and Nigerian Pidgin. If the risk is high, the **real** Chidi gets a full-screen confirmation on his own signed-in session: "Did you just ask Mum for $800?" **Yes** captures the payment in seconds. **No**, or silence, voids it and Mum's money is released. If he has lost his phone, another family member can vouch, or Mum can pay the verified hospital or school directly, which a scammer can't receive. Low-risk requests to a verified account go straight through, so normal use isn't slowed.

## How we built it
Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres with Row Level Security on every table, Auth, Realtime, private Storage), deployed on Vercel with a Render blueprint. PayPal is the heart of it: Orders v2 with `intent: AUTHORIZE`, the JS SDK for approval, Payments v2 capture and void, Log in with PayPal for identity, and signature-verified idempotent webhooks. Google Gemini (via the official `@google/genai` SDK) returns a structured, schema-constrained, zod-validated analysis, including a one-line question for the real person and a calm explanation for the sender, and a deterministic rules engine sets a floor the AI can't lower. The AI layer is provider-agnostic: Claude is supported too, with one environment switch (`LLM_PROVIDER=anthropic`). Gemini also transcribes voice notes (verbatim, English or Pidgin), including WhatsApp `.opus`. A pure, fully tested state machine drives every request.

## Built with
Next.js · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Realtime, Storage, RLS) · PayPal REST APIs (Orders v2, Payments v2, Log in with PayPal, Webhooks, JS SDK) · Google Gemini API (`@google/genai`; Anthropic Claude optional via `LLM_PROVIDER`) · Zod · Vitest · Playwright · Vercel · Render · GitHub Actions

## PayPal tools used and how
- **Orders v2 (AUTHORIZE)** creates the payment as a hold with the payee's email and our request id as `custom_id`.
- **PayPal JS SDK** gets the payer's approval; the server then authorizes the order.
- **Payments v2 capture / void** are the two outcomes: "Yes, it was me" captures; "No", expiry or redirect voids.
- **Log in with PayPal** proves each member's real PayPal identity, the thing the payee check compares against.
- **Webhooks** (signature verified, idempotent) for audit and recovery. The app is correct without them.
- All calls use `PayPal-Request-Id` idempotency keys.

## AI tools used and how
Gemini analyzes untrusted message text with JSON-mode structured output (response schema generated from our zod schema, then re-validated with zod): score, signals with short quotes, claimed identity, the confirmation question, and a plain-language explanation in English or Pidgin. The message is delimited as data, and instruction-like text inside it is treated as a high-risk signal. If the AI fails or refuses, we fall back to rules and never auto-release. Gemini also transcribes voice notes from inline audio. Swapping to Claude is a one-line env change; both providers share the same safety layer and tests.

## Challenges
- Making "hold, then decide" safe under races: confirm and deny at the same moment, expiry racing a tap, retries after a capture failure. We used compare-and-set transitions, first-answer-wins confirmations and idempotency keys, and tested them.
- Guarding the guard: the message is attacker-controlled, so it has to be treated as data. A model that has been "convinced" still can't lower the rules floor.
- Designing for an older user: large tap targets, plain words, calm tone, large-text mode, and an explanation that never blames the victim.
- Honest limits: PayPal sandbox has no NGN, so USD with a display-only naira estimate.

## Accomplishments we're proud of
A real-money-shaped flow with the money never moving until a verified human says so; redirecting to a verified institution so a real emergency still gets paid; the security property (only the asked person can confirm) enforced in both RLS and server code and tested; and Pidgin support in both detection and explanations.

## What we learned
PayPal's authorize/capture split is a natural fit for "pause money while we verify a person." And the right way to defeat voice cloning is to stop trusting voices at all.

## What's next
Verified payee identities for public figures and brands, Xoom for production cross-border payouts, a push/SMS/WhatsApp fallback for confirmation, trusted-contact escalation, and more languages.

## Try it
- Demo: https://kinproof-nine.vercel.app (one-click demo sign-in as Ada and Chidi; use the sandbox buyer account in the PayPal popup, see README)
- Code: https://github.com/breakthrough-child/kinproof (MIT licensed)
- Video: _YouTube/Vimeo URL_

## Screenshots
Phone and desktop, light and dark, are in `docs/screenshots/` (verdict, Chidi's confirmation card, the stamp, landing, send flow, inbox, circle, payees, settings). Live demo: https://kinproof-nine.vercel.app · Code: https://github.com/breakthrough-child/kinproof
