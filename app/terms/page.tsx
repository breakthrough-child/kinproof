import { LegalPage } from "@/components/Legal";

export const metadata = { title: "Terms · Kinproof", description: "Terms of use for the Kinproof sandbox prototype." };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="8 November 2026">
      <p className="rounded-[14px] bg-cautionsoft p-4 font-semibold text-caution">Kinproof is a hackathon prototype. It runs on PayPal Sandbox, so no real money moves, ever.</p>

      <h2>What this is</h2>
      <p>Kinproof is a demonstration of one idea: before a payment leaves, ask the real family member, on their own signed-in phone, whether they asked for it. It exists to show that idea working end to end.</p>

      <h2>No real money</h2>
      <ul>
        <li>All payments use PayPal Sandbox accounts and test funds. Nothing you do here moves real money.</li>
        <li>Do not enter real card numbers, bank details, passwords or identity documents anywhere in the app.</li>
        <li>Naira amounts are approximate display values only.</li>
      </ul>

      <h2>No guarantees</h2>
      <ul>
        <li>The scam checks are a rules engine plus an AI model. They can be wrong. A &ldquo;looks normal&rdquo; result is not a promise that a request is safe.</li>
        <li>The service is provided as it is, may be reset or taken down at any time, and comes with no warranty.</li>
        <li>This is not financial, legal or security advice.</li>
      </ul>

      <h2>Using it fairly</h2>
      <ul>
        <li>Use it only with people who agreed to take part, and only with demo data.</li>
        <li>Do not use it to harass, deceive or impersonate anyone, and do not try to break or overload it.</li>
      </ul>

      <h2>PayPal</h2>
      <p>Signing in with PayPal and approving payments is governed by PayPal&apos;s own terms. See our <a href="/privacy">privacy page</a> for what we keep.</p>

      <h2>Open source</h2>
      <p>The code is MIT licensed. Find it on the <a href="https://github.com/breakthrough-child/kinproof">project repository</a>.</p>
    </LegalPage>
  );
}
