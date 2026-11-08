import { requireUserOrRedirect } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Seal } from "@/components/Seal";
import { IconBuilding } from "@/components/icons";

export const metadata = { title: "Verified payees · Kinproof" };

export default async function Institutions() {
  await requireUserOrRedirect();
  const list = await getStore().listInstitutions();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Safe to pay" title="Verified payees">
        Hospitals, schools and other organisations we&apos;ve checked. Paying one of these directly is the safest way to help when you can&apos;t reach your family member: a scammer can&apos;t receive money this way. Anyone claiming to be a public figure or brand who is <em>not</em> listed here is flagged as high risk.
      </PageHeader>
      {list.length === 0 ? (
        <EmptyState icon={IconBuilding} title="No verified payees yet.">Organisations will appear here once they have been checked.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((i) => (
            <li key={i.id}>
              <Card className="h-full">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold">{i.name}</h2>
                    <p className="mt-0.5 text-muted capitalize">{i.kind.replace("_", " ")}{i.city ? ` · ${i.city}` : ""}</p>
                  </div>
                  {i.verified && <Seal kind="verified" size={52} />}
                </div>
                <p className="mt-3 break-all text-sm text-muted">PayPal: {i.paypal_email}</p>
                {i.notes && <p className="mt-1 text-sm text-muted">{i.notes}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
