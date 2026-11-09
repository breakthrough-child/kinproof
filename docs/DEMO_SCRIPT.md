# Demo video script (final: 2:27, hard limit 2:55)

The video is produced by `pnpm record:demo`, `pnpm voiceover` and `pnpm compose:demo` (see "Recording the demo" in the README). The narration and captions live in [`scripts/demo-beats.ts`](../scripts/demo-beats.ts), which is the single source of truth: this table mirrors it. No music.

Layout: Ada's laptop on the left, Chidi's phone (in a phone frame) on the right, captions under the laptop. Title cards at the start and end.

| Beat | On screen | Narration |
|---|---|---|
| **Opening card** (0:00) | **"Americans reported losing $3.5 billion to imposter scams in 2025."** Source: FTC, June 2026. Then: *You can't tell by listening. Kinproof verifies the person.* | "Americans reported losing three and a half billion dollars to imposter scams in 2025. And now a scammer can clone a voice from a few seconds of audio. You can't tell by listening. So Kinproof doesn't listen. It verifies the person." |
| **A scam: send 1** | Ada pastes the "new number, don't tell Dad, the lawyer will call, send $800 right now" message as text. | "A message arrives from a new number. It sounds just like her son. Ada pastes it into Kinproof." |
| **A scam: send 2** | Amount $800, payee typed as `scammer@mail.example`; the warning *This isn't Chidi's verified PayPal account.* appears. | "She says who it claims to be, and the amount. Kinproof already knows Chidi's real PayPal, and this isn't it." |
| **A scam: verdict** | "Please don't send this money." The flagged words are marked inside the message. | "Kinproof reads the message and says so plainly: please don't send this money. The words that match scam pressure are marked in the message itself." |
| **A scam: safer option** | The "Pay a verified organisation directly" card. | "If the real person can't be reached, Kinproof can pay the hospital, or another verified organisation, directly. A scammer can't receive money that way." |
| **A scam: hold** | PayPal popup (not recorded), then "We are asking Chidi right now". | "Ada approves a hold in PayPal. It's a hold, not a payment. The money doesn't move." |
| **A scam: Chidi's card** | Chidi's phone: full-screen card with the AI's question and the original message, countdown ticking. | "On Chidi's own phone, in his own signed-in account, comes one question … A scammer has a voice. They don't have Chidi's phone." |
| **A scam: blocked** | Chidi taps No. The blocked stamp lands on both screens. | "He taps no. The hold is released, and Ada's money never left." |
| **A real emergency: send** | Ada sends $350 to Chidi's own verified account (prefilled). | "Now a real emergency. Same flow, but this time it really is Chidi, so his verified account is already filled in." |
| **A real emergency: hold** | Second PayPal approval, then Chidi gets the same question. | "Ada approves the hold, and Chidi gets the same question." |
| **A real emergency: confirm** | Chidi taps Yes. The sent stamp lands. | "He taps yes. The hold is captured, and the money reaches him in seconds." |
| **Closing card** | PayPal separates authorizing from capturing: Hold, Check, Send or send back. Then **"Proof of person, not proof of voice."** with the live URL and repo URL. | "Kinproof works because PayPal separates authorizing from capturing. We can hold the money, check the person, then send it, or send it back. Proof of person, not proof of voice." |

Checklist before upload: under 3:00 · no music · the statistic and its source re-checked on ftc.gov (the opening card shows the figure supplied for this project, which has **not** been independently verified) · only sandbox accounts visible · no keys or secrets on screen.
