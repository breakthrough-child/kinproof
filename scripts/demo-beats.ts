/**
 * The demo video, beat by beat. One source of truth for the recorder (which beats exist), the voiceover
 * (narration, spoken by Gemini TTS) and the composer (captions and scene labels). Mirrors docs/DEMO_SCRIPT.md.
 */
export interface Beat {
  id: string;
  /** "card" beats are title cards (no footage); "footage" beats use the recorded Ada and Chidi videos. */
  kind: "card" | "footage";
  scene?: string;
  narration: string;
  /** Burned-in caption (shorter than the narration). */
  caption: string;
}

export const STAT = "Americans reported losing $3.5 billion to imposter scams in 2025.";
export const STAT_SOURCE = "FTC, June 2026";
export const TAGLINE = "Proof of person, not proof of voice.";
export const LIVE_URL = "kinproof-nine.vercel.app";
export const REPO_URL = "github.com/breakthrough-child/kinproof";

export const BEATS: Beat[] = [
  { id: "open", kind: "card", narration: "Americans reported losing three and a half billion dollars to imposter scams in 2025. And now a scammer can clone a voice from a few seconds of audio. You can't tell by listening. So Kinproof doesn't listen. It verifies the person.", caption: "You can’t tell by listening. Kinproof verifies the person." },

  { id: "a-send1", kind: "footage", scene: "A scam", narration: "A message arrives from a new number. It sounds just like her son. Ada pastes it into Kinproof.", caption: "A message from a “new number” arrives. Ada pastes it in." },
  { id: "a-send2", kind: "footage", scene: "A scam", narration: "She says who it claims to be, and the amount. Kinproof already knows Chidi's real PayPal, and this isn't it.", caption: "Kinproof knows Chidi’s real PayPal. This isn’t it." },
  { id: "a-verdict", kind: "footage", scene: "A scam", narration: "Kinproof reads the message and says so plainly: please don't send this money. The words that match scam pressure are marked in the message itself.", caption: "The words that match scam pressure are marked in the message." },
  { id: "a-safer", kind: "footage", scene: "A scam", narration: "If the real person can't be reached, Kinproof can pay the hospital, or another verified organisation, directly. A scammer can't receive money that way.", caption: "Or pay a verified organisation, like the hospital, directly." },
  { id: "a-hold", kind: "footage", scene: "A scam", narration: "Ada approves a hold in PayPal. It's a hold, not a payment. The money doesn't move.", caption: "Ada approves a hold in PayPal. A hold, not a payment." },
  { id: "a-card", kind: "footage", scene: "A scam", narration: "On Chidi's own phone, in his own signed-in account, comes one question: did you just ask Mum for eight hundred dollars? A scammer has a voice. They don't have Chidi's phone.", caption: "Chidi’s own phone gets one question." },
  { id: "a-blocked", kind: "footage", scene: "A scam", narration: "He taps no. The hold is released, and Ada's money never left.", caption: "He taps No. Blocked. Ada’s money is back." },

  { id: "b-send", kind: "footage", scene: "A real emergency", narration: "Now a real emergency. Same flow, but this time it really is Chidi, so his verified account is already filled in.", caption: "A real emergency: $350, to Chidi’s own verified account." },
  { id: "b-hold", kind: "footage", scene: "A real emergency", narration: "Ada approves the hold, and Chidi gets the same question.", caption: "Same hold. Same question to the real Chidi." },
  { id: "b-confirm", kind: "footage", scene: "A real emergency", narration: "He taps yes. The hold is captured, and the money reaches him in seconds.", caption: "He taps Yes. Sent, in seconds." },

  { id: "close", kind: "card", narration: "Kinproof works because PayPal separates authorizing from capturing. We can hold the money, check the person, then send it, or send it back. Proof of person, not proof of voice.", caption: TAGLINE },
];
