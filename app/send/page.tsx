import { requireUserOrRedirect } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { config } from "@/lib/config";
import { SendForm } from "./SendForm";
import { Card, LinkButton } from "@/components/ui";

export const metadata = { title: "Send money safely · Kinproof" };

export default async function SendPage() {
  const userId = await requireUserOrRedirect();
  const store = getStore();
  const memberships = await store.membershipsForUser(userId);
  if (memberships.length === 0) {
    return (
      <Card>
        <h1 className="text-2xl font-bold">First, join or start a circle</h1>
        <p className="mt-2 text-muted">Kinproof protects payments between people in a family circle, so we need to know who&apos;s in yours.</p>
        <LinkButton href="/circle" className="mt-4">Go to my circle</LinkButton>
      </Card>
    );
  }
  const circles = await Promise.all(
    memberships.map(async (m) => ({
      id: m.circle_id,
      name: m.circle.name,
      members: (await store.circleMembers(m.circle_id))
        .filter((x) => x.id !== m.id)
        .map((x) => ({ id: x.id, name: x.display_name, label: x.relationship_label, email: x.paypal_verified_at ? x.paypal_email : null })),
    })),
  );
  return <SendForm circles={circles} ngnRate={config().ngnRate} />;
}
