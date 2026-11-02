import { config } from "@/lib/config";

/**
 * Optional SMS via Twilio. The SMS contains ONLY a sign-in-protected link; there is
 * deliberately no reply-to-approve mechanism. Silent no-op when Twilio is not configured.
 */
export async function notifyConfirmationSms(phone: string | null | undefined, requestId: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from || !phone) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: from,
        Body: `Kinproof: someone needs you to confirm a payment request. Open and sign in: ${config().appUrl}/inbox?r=${requestId}`,
      }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
