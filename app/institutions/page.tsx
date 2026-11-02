import { requireUserOrRedirect } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Verified payees · Kinproof" };

export default async function Institutions() {
  await requireUserOrRedirect();
  const list = await getStore().listInstitutions();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Verified payees</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">Hospitals, schools and other organisations we&apos;ve checked. Paying one of these directly is the safest way to help when you can&apos;t reach your family member. A scammer can&apos;t receive money this way. Anyone claiming to be a public figure or brand who is <em>not</em> listed here is flagged as high risk.</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((i) => (
          <li key={i.id}>
            <Card className="h-full">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold">{i.name}</h2>
                {i.verified && <Badge tone="ok">Verified</Badge>}
              </div>
              <p className="mt-1 text-muted capitalize">{i.kind.replace("_", " ")}{i.city ? ` · ${i.city}` : ""}</p>
              <p className="mt-2 break-all text-sm text-muted">PayPal: {i.paypal_email}</p>
              {i.notes && <p className="mt-1 text-sm text-muted">{i.notes}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
