import { LegalPage } from "@/components/Legal";

export const metadata = { title: "Privacy · Kinproof", description: "What the Kinproof sandbox prototype stores, and what it does not." };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="8 November 2026">
      <p className="rounded-[14px] bg-cautionsoft p-4 font-semibold text-caution">Kinproof is a hackathon prototype running on PayPal Sandbox. No real money moves, and you should not enter real personal or financial details.</p>

      <h2>What we store</h2>
      <ul>
        <li><strong>Your account:</strong> the email you sign in with (or a seeded demo email), your display name, language and text-size preferences, and an optional mobile number if you add one.</li>
        <li><strong>Your circle:</strong> the circle name, who is in it, what each person is called (for example &ldquo;Mum&rdquo;), and the PayPal sandbox email and payer ID each person linked with Log in with PayPal.</li>
        <li><strong>Each payment request:</strong> the message or voice-note transcript you submit, the amount, the payee email, the checks we ran, the PayPal sandbox order and authorization IDs, and a timeline of what happened.</li>
        <li><strong>Voice notes:</strong> if you upload or record one, the audio is kept in a private storage bucket so the request can be shown back to you.</li>
      </ul>

      <h2>Who else sees it</h2>
      <ul>
        <li><strong>Your circle:</strong> members of your circle can see requests inside that circle. That is how the real person can be asked to confirm.</li>
        <li><strong>PayPal:</strong> sign-in and payments go through PayPal Sandbox, under PayPal&apos;s own terms and privacy policy.</li>
        <li><strong>AI and speech-to-text providers:</strong> the message text (and audio, for transcription) is sent to the model provider that checks it for scam pressure. Treat anything you type as shared with that provider.</li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>We never store passwords for PayPal. Linking uses PayPal&apos;s own sign-in page.</li>
        <li>We do not sell data or show ads.</li>
        <li>We never approve a payment from a text message reply. Confirmations only happen inside a signed-in session.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>Because this is a prototype, ask the maintainer to delete your account and its requests. Sandbox demo data may be reset at any time.</p>

      <h2>Questions</h2>
      <p>Open an issue on the <a href="https://github.com/breakthrough-child/kinproof">project repository</a>.</p>
    </LegalPage>
  );
}
