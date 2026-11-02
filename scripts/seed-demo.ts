/**
 * Seeds a Supabase project with the demo: auth users, The Okafors circle, verified institutions
 * (sandbox business emails from env) and a little transfer history.
 *
 *   pnpm seed:demo        (reads .env.local; needs SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD)
 *
 * Demo members are pre-marked as PayPal-verified with their sandbox emails so the demo works
 * immediately. In real use each member links through "Log in with PayPal" on /circle.
 */
import { createClient } from "@supabase/supabase-js";
import { DEMO, demoEmail } from "../lib/store/seed.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !key || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD (sandbox-only demo password).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const ok = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

const userIds: Record<string, string> = {};
for (const u of DEMO.users) {
  const created = await db.auth.admin.createUser({ email: u.login, password, email_confirm: true, user_metadata: { display_name: u.name } });
  if (created.error) {
    const list = await db.auth.admin.listUsers({ perPage: 200 });
    const existing = list.data.users.find((x) => x.email === u.login);
    if (!existing) throw new Error(`createUser ${u.login}: ${created.error.message}`);
    await db.auth.admin.updateUserById(existing.id, { password });
    userIds[u.key] = existing.id;
  } else userIds[u.key] = created.data.user.id;
  ok(await db.from("profiles").upsert({ id: userIds[u.key], display_name: u.name, large_text: u.key === "ada" }), "profile");
}

let circle = ok(await db.from("circles").select("*").eq("invite_code", DEMO.inviteCode).maybeSingle(), "circle") as { id: string } | null;
if (!circle) circle = ok(await db.from("circles").insert({ name: DEMO.circleName, created_by: userIds.ada, invite_code: DEMO.inviteCode }).select().single(), "circle") as { id: string };

const memberIds: Record<string, string> = {};
for (const u of DEMO.users) {
  const row = ok(
    await db.from("circle_members").upsert(
      { circle_id: circle.id, user_id: userIds[u.key], relationship_label: u.label, role: u.role, paypal_payer_id: process.env[`DEMO_${u.key.toUpperCase()}_PAYER_ID`] ?? `DEMO_${u.key.toUpperCase()}`, paypal_email: demoEmail(u), paypal_verified_at: new Date().toISOString() },
      { onConflict: "circle_id,user_id" },
    ).select().single(),
    "member",
  ) as { id: string };
  memberIds[u.key] = row.id;
}

ok(await db.from("institutions").delete().in("name", DEMO.institutions.map((i) => i.name)), "clear institutions");
ok(await db.from("institutions").insert(DEMO.institutions.map((i) => ({ name: i.name, kind: i.kind, city: i.city, country: "NG", paypal_email: demoEmail(i), aliases: i.aliases, verified: true, notes: "Demo sandbox business account" }))), "institutions");

const existing = ok(await db.from("transfer_requests").select("id").eq("sender_member_id", memberIds.ada).eq("status", "released").limit(1), "history") as unknown[];
if (existing.length === 0) {
  ok(await db.from("transfer_requests").insert(DEMO.historyAmounts.map((amount, i) => ({
    circle_id: circle.id, sender_member_id: memberIds.ada, claimed_requester_member_id: memberIds.chidi, claimed_requester_name: "Chidi",
    channel: "text", raw_message: "Mum, small help for textbooks please.", amount, currency: "USD", payee_email: demoEmail(DEMO.users[1]),
    payee_kind: "claimed_member", status: "released", created_at: new Date(Date.now() - (i + 2) * 86400_000).toISOString(),
  }))), "history rows");
}
console.log("Seeded. Demo logins:", DEMO.users.map((u) => u.login).join(", "));
