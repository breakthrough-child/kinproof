import { requireUserOrRedirect } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { CircleClient } from "./CircleClient";

export const metadata = { title: "My circle · Kinproof" };

export default async function CirclePage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const userId = await requireUserOrRedirect();
  const store = getStore();
  const memberships = await store.membershipsForUser(userId);
  const circles = await Promise.all(
    memberships.map(async (m) => ({
      circle: m.circle,
      myMemberId: m.id,
      members: (await store.circleMembers(m.circle_id)).map((x) => ({
        id: x.id, name: x.display_name, label: x.relationship_label, role: x.role, verified: !!x.paypal_verified_at, email: x.paypal_email, mine: x.user_id === userId,
      })),
    })),
  );
  const { link } = await searchParams;
  return <CircleClient circles={circles} linkResult={link ?? null} />;
}
