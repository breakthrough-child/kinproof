import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { getRequestView } from "@/lib/services/transfers";
import { ServiceError } from "@/lib/services/errors";
import { config } from "@/lib/config";
import { RequestView } from "./RequestView";

export const metadata = { title: "Payment request · Kinproof" };

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserOrRedirect();
  const { id } = await params;
  try {
    await getRequestView(userId, id);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  }
  return <RequestView id={id} paypalMode={config().paypalMode} paypalClientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ""} ngnRate={config().ngnRate} />;
}
