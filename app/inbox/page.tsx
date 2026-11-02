import { requireUserOrRedirect } from "@/lib/auth/session";
import { InboxClient } from "./InboxClient";

export const metadata = { title: "Inbox · Kinproof" };

export default async function InboxPage() {
  await requireUserOrRedirect();
  return <InboxClient />;
}
