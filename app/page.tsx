import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui";
import { Seal } from "@/components/Seal";
import { Phone, Waveform } from "@/components/Phone";
import { Avatar } from "@/components/ui";
import { IconArrowRight, IconCheck, IconPause, IconRedirect, IconX } from "@/components/icons";
import { getUserId } from "@/lib/auth/session";

function Beat({ n, title, children, visual }: { n: string; title: string; children: ReactNode; visual: ReactNode }) {
  return (
    <li className="grid gap-5 md:grid-cols-[1fr_20rem] md:items-center md:gap-12">
      <div>
        <p className="font-serif text-5xl font-semibold leading-none text-primary/40" aria-hidden="true">{n}</p>
        <h3 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h3>
        <p className="mt-2 max-w-md text-lg text-muted">{children}</p>
      </div>
      {visual}
    </li>
  );
}

const bubble = "rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-snug";

export default async function Home() {
  const signedIn = !!(await getUserId());
  return (
    <div className="space-y-24 sm:space-y-32">
      {/* Hero: left-aligned, with the scam already on screen */}
      <section className="grid items-center gap-10 py-4 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-10">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-primary"><Seal kind="verified" size={28} label="" />For families who send money across borders</p>
          <h1 className="text-[2.6rem] font-semibold leading-[1.05] sm:text-6xl lg:text-[4.25rem]">
            Proof of person,<br />not proof of voice.
          </h1>
          <p className="mt-6 max-w-xl text-xl text-muted">
            A cloned voice can say anything. It can&apos;t sign in as your son. Kinproof holds the payment and asks the real family member, on their own phone, before any money moves.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href={signedIn ? "/send" : "/login"} className="min-h-14 px-7 text-lg">{signedIn ? "Send money safely" : "Try the demo"}<IconArrowRight size={20} /></LinkButton>
            <LinkButton href="#story" variant="secondary" className="min-h-14 px-7 text-lg">See a scam stopped</LinkButton>
          </div>
          <p className="mt-5 max-w-md text-base text-muted">Built on PayPal&apos;s authorize-then-capture. Sandbox demo: no real money moves.</p>
        </div>
        <Phone label="Mum’s phone, 9:41 pm">
          <div className={`${bubble} bg-surface2`}>
            <p className="mb-1 text-xs font-bold text-muted">Chidi · new number</p>
            <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primaryink"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg></span><Waveform /><span className="text-xs text-muted">0:19</span></div>
          </div>
          <div className={`${bubble} bg-surface2`}>“Mum, it&apos;s me. My phone fell, this is my new number. Please <mark className="quote">don&apos;t tell Dad</mark>. Send $800 <mark className="quote">right now</mark>.”</div>
          <div className="rounded-2xl border border-caution/40 bg-cautionsoft p-3.5 text-caution">
            <p className="flex items-center gap-1.5 text-sm font-bold"><IconPause size={16} />Held, not sent</p>
            <p className="mt-1 text-[0.95rem] leading-snug text-ink">Kinproof is asking the real Chidi. Your $800 is safe.</p>
          </div>
        </Phone>
      </section>

      {/* The story, as a conversation */}
      <section id="story" aria-labelledby="story-h" className="scroll-mt-20">
        <h2 id="story-h" className="max-w-2xl text-4xl font-semibold sm:text-5xl">How a scam plays out, and where it stops.</h2>
        <p className="mt-3 max-w-xl text-lg text-muted">It is nine in the evening. Ada&apos;s phone buzzes with a voice note from a number she doesn&apos;t know.</p>
        <ol className="mt-12 space-y-16 sm:space-y-20">
          <Beat n="1" title="The message arrives" visual={
            <Phone label="WhatsApp">
              <div className={`${bubble} bg-surface2`}><p className="mb-1 text-xs font-bold text-muted">+234 8•• ••• •••</p>Mum it&apos;s Chidi. New number. I&apos;ve had an accident. The lawyer will call you.</div>
              <div className={`${bubble} bg-surface2`}>Don&apos;t tell Dad. Send $800 now please.</div>
            </Phone>
          }>
            It sounds exactly like him. That is the point: voice-cloning needs only a few seconds of someone talking online. Ada&apos;s heart is racing.
          </Beat>
          <Beat n="2" title="She checks it in Kinproof" visual={
            <Phone label="Kinproof · Send money safely">
              <div className="rounded-2xl border border-line bg-surface p-3.5 text-[0.95rem]">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Who is asking</p>
                <div className="mt-1.5 flex items-center gap-2.5"><Avatar name="Chidi" size={34} /><span className="font-semibold">Chidi · Son</span></div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Paying</p>
                <p className="font-semibold">scammer@mail.example</p>
                <p className="mt-1 rounded-lg bg-cautionsoft px-2 py-1 text-sm text-caution">This isn&apos;t Chidi&apos;s verified PayPal account.</p>
              </div>
            </Phone>
          }>
            She pastes the message and says who it claims to be from. Kinproof already knows Chidi&apos;s real PayPal, and this isn&apos;t it.
          </Beat>
          <Beat n="3" title="Kinproof reads it, and says so plainly" visual={
            <Phone label="The verdict">
              <div className="rounded-2xl border border-danger/40 bg-dangersoft p-3.5">
                <p className="font-serif text-xl font-semibold leading-tight">Please don&apos;t send this money.</p>
                <p className="mt-2 text-[0.95rem] leading-snug">“<mark className="quote">New number</mark>… <mark className="quote">don&apos;t tell Dad</mark>… <mark className="quote">lawyer will call</mark>.” These match known scams.</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-3 text-[0.95rem]"><strong>Held, not sent.</strong> Ada approves a hold in PayPal. The money doesn&apos;t move.</div>
            </Phone>
          }>
            Words that match scam pressure are marked in the message itself, with a calm explanation. Ada approves a hold in PayPal. It is a hold, not a payment.
          </Beat>
          <Beat n="4" title="The real Chidi gets one question" visual={
            <Phone label="Chidi’s phone · his own account">
              <div className="rounded-2xl border border-line bg-surface p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-caution">Money on hold · this needs you</p>
                <p className="mt-2 font-serif text-xl font-semibold leading-tight">Did you just ask Mum for $800?</p>
                <div className="mt-3 grid gap-2">
                  <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primaryink"><IconCheck size={18} />Yes, it was me</div>
                  <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-danger font-semibold text-dangerink ring-4 ring-danger/25"><IconX size={18} />No, that wasn&apos;t me</div>
                </div>
              </div>
            </Phone>
          }>
            It appears on his own phone, in his own signed-in session. A scammer has a voice. They don&apos;t have Chidi&apos;s phone, so they can&apos;t press the button.
          </Beat>
          <Beat n="5" title="The stamp lands" visual={
            <div className="flex flex-col items-center gap-3 rounded-[28px] border border-danger/30 bg-dangersoft p-8 text-center">
              <Seal kind="blocked" size={132} />
              <p className="font-serif text-xl font-semibold">Stopped. Mum&apos;s money is back.</p>
            </div>
          }>
            He taps No. The hold is released and Ada&apos;s money goes straight back. If nobody answers in fifteen minutes, it goes back too.
          </Beat>
        </ol>
      </section>

      {/* A real emergency still gets through */}
      <section aria-labelledby="real-h" className="grid gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <h2 id="real-h" className="text-4xl font-semibold sm:text-5xl">A real emergency still gets paid.</h2>
          <p className="mt-4 text-lg text-muted">Kinproof is built so the worst case for the real Chidi is one extra tap, not a refused payment.</p>
        </div>
        <dl className="space-y-7">
          <div className="flex gap-4"><Seal kind="released" size={64} /><div><dt className="text-xl font-semibold">He says Yes.</dt><dd className="mt-1 text-lg text-muted">The hold is captured and the money arrives in seconds. Small, low-risk payments to someone&apos;s own verified account skip the question entirely.</dd></div></div>
          <div className="flex gap-4"><Seal kind="redirected" size={64} /><div><dt className="text-xl font-semibold">He lost his phone.</dt><dd className="mt-1 text-lg text-muted">Another family member can vouch, saying how they checked. Or Ada pays <strong className="text-ink">St. Luke&apos;s Hospital</strong> directly. A scammer can&apos;t receive money that way.</dd></div></div>
        </dl>
      </section>

      {/* Why PayPal */}
      <section aria-labelledby="why-h" className="rounded-[28px] border border-line bg-surface p-7 shadow-card sm:p-12">
        <h2 id="why-h" className="max-w-xl text-4xl font-semibold">Why PayPal.</h2>
        <div className="mt-6 grid gap-8 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4 text-lg text-muted">
            <p>The whole idea rests on one capability: <strong className="text-ink">authorize first, capture later.</strong> PayPal can hold the money without moving it, so the decision can wait for the real person.</p>
            <p>Log in with PayPal ties each family member to a real account, so &ldquo;Chidi&rdquo; is something a scammer can&apos;t type in. And PayPal reaches family wherever they are, so the same protection works across borders.</p>
          </div>
          <ol className="flex flex-col justify-center gap-2 text-lg font-semibold" aria-label="How the money moves">
            {[["Authorize", "money held, not sent"], ["Confirm", "the real person answers"], ["Capture or void", "sent, or sent back"]].map(([a, b], i) => (
              <li key={a} className="flex items-center gap-3 rounded-[14px] bg-bg p-3.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-base text-primaryink">{i + 1}</span><span>{a}<span className="block text-base font-normal text-muted">{b}</span></span></li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing call */}
      <section className="flex flex-col items-start gap-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold sm:text-4xl">See it with the Okafors.</h2>
          <p className="mt-2 text-lg text-muted">Sign in as Ada in one window and Chidi in another. It takes about two minutes.</p>
        </div>
        <LinkButton href={signedIn ? "/send" : "/login"} className="min-h-14 px-7 text-lg">{signedIn ? "Send money safely" : "Try the demo"}<IconRedirect size={20} /></LinkButton>
      </section>
    </div>
  );
}
