import { LinkButton, Card } from "@/components/ui";
import { getUserId } from "@/lib/auth/session";

const steps = [
  { n: "1", t: "Ask", d: "Someone asks you for money by voice note or message. Paste or upload it into Kinproof and say who it claims to be from." },
  { n: "2", t: "Hold", d: "Kinproof checks the message for scam pressure, then you approve in PayPal. The money is held, not sent." },
  { n: "3", t: "Prove", d: "The real person gets a confirmation on their own phone. Only their “Yes, it was me” releases the money. A scammer can’t press it." },
];

export default async function Home() {
  const signedIn = !!(await getUserId());
  return (
    <div className="space-y-12">
      <section className="py-6 sm:py-12">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Voice-clone scam protection for families</p>
        <h1 className="max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-6xl">Proof of person, not proof of voice.</h1>
        <p className="mt-5 max-w-2xl text-xl text-muted">
          A cloned voice can say anything. It can&apos;t sign in as your son. Kinproof holds the payment and asks the real family member, on their own phone, before any money moves.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href={signedIn ? "/send" : "/login"} className="min-h-14 px-7 text-lg">{signedIn ? "Send money safely" : "Try the demo"}</LinkButton>
          <LinkButton href="#how" variant="secondary" className="min-h-14 px-7 text-lg">How it works</LinkButton>
        </div>
      </section>

      <section id="how" aria-labelledby="how-h">
        <h2 id="how-h" className="mb-5 text-2xl font-bold">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n}>
              <Card className="h-full">
                <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-full bg-primary text-lg font-bold text-primaryink">{s.n}</span>
                <h3 className="text-xl font-bold">{s.t}</h3>
                <p className="mt-2 text-muted">{s.d}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card tone="danger">
          <h3 className="text-xl font-bold">&ldquo;Mum, it&apos;s me. New number. Don&apos;t tell Dad.&rdquo;</h3>
          <p className="mt-2">The payment is held. Chidi gets a card on his own phone: <em>&ldquo;Did you just ask Mum for $800 for a lawyer?&rdquo;</em> He taps <strong>No</strong>. Mum&apos;s money goes straight back.</p>
        </Card>
        <Card tone="ok">
          <h3 className="text-xl font-bold">A real emergency still gets through.</h3>
          <p className="mt-2">Chidi taps <strong>Yes</strong> and the money arrives in seconds. If he&apos;s lost his phone, Kinproof can pay the hospital directly instead. A scammer can&apos;t receive money that way.</p>
        </Card>
      </section>
    </div>
  );
}
