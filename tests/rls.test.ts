import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real migration on in-process Postgres (PGlite) with minimal Supabase stubs
 * (auth.uid(), roles, storage, publication) and checks the RLS policies as `authenticated`.
 */
const U = {
  ada: "00000000-0000-0000-0000-0000000000a1",
  chidi: "00000000-0000-0000-0000-0000000000c1",
  ngozi: "00000000-0000-0000-0000-0000000000d1",
  eve: "00000000-0000-0000-0000-0000000000e1", // not in the circle
};
const M = { ada: "10000000-0000-0000-0000-0000000000a1", chidi: "10000000-0000-0000-0000-0000000000c1", ngozi: "10000000-0000-0000-0000-0000000000d1" };
const CIRCLE = "20000000-0000-0000-0000-000000000001";
const REQ = "30000000-0000-0000-0000-000000000001";
const CONF = "40000000-0000-0000-0000-000000000001";

let db: PGlite;

async function as<T>(user: keyof typeof U | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user ? U[user] : ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create publication supabase_realtime;
  `);
  await db.exec(readFileSync(path.join(import.meta.dirname, "../supabase/migrations/0001_init.sql"), "utf8"));
  await db.exec(`grant usage on schema public to authenticated; grant select, insert, update, delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  const users = Object.entries(U).map(([k, id]) => `('${id}','${k}@x.example','{"display_name":"${k}"}')`).join(",");
  await db.exec(`insert into auth.users (id,email,raw_user_meta_data) values ${users};`); // trigger creates profiles
  await db.exec(`
    insert into circles (id,name,created_by,invite_code) values ('${CIRCLE}','Okafors','${U.ada}','OKAFOR');
    insert into circle_members (id,circle_id,user_id,relationship_label,role,paypal_email,paypal_verified_at) values
      ('${M.ada}','${CIRCLE}','${U.ada}','Mum','owner','ada@p.example',now()),
      ('${M.chidi}','${CIRCLE}','${U.chidi}','Son','member','chidi@p.example',now()),
      ('${M.ngozi}','${CIRCLE}','${U.ngozi}','Daughter','member','ngozi@p.example',now());
    insert into transfer_requests (id,circle_id,sender_member_id,claimed_requester_member_id,channel,amount,payee_email,payee_kind,status,confirm_expires_at)
      values ('${REQ}','${CIRCLE}','${M.ada}','${M.chidi}','text',800,'x@evil.example','other','awaiting_confirmation', now() + interval '10 minutes');
    insert into confirmations (id,transfer_request_id,asked_member_id) values ('${CONF}','${REQ}','${M.chidi}');
  `);
});
afterAll(() => db.close());

const respond = (response: string) => db.query(`update confirmations set response='${response}', responded_at=now() where id='${CONF}' returning id`);

describe("RLS: confirmation authorization", () => {
  it("the new-user trigger created profiles", async () => {
    expect((await db.query(`select count(*)::int as n from profiles`)).rows[0]).toEqual({ n: 4 });
  });
  it("the sender cannot confirm their own request", async () => {
    expect((await as("ada", () => respond("confirmed"))).rows).toHaveLength(0);
  });
  it("another circle member cannot confirm", async () => {
    expect((await as("ngozi", () => respond("confirmed"))).rows).toHaveLength(0);
  });
  it("an outsider cannot confirm", async () => {
    expect((await as("eve", () => respond("confirmed"))).rows).toHaveLength(0);
  });
  it("an unauthenticated caller cannot confirm", async () => {
    expect((await as(null, () => respond("confirmed"))).rows).toHaveLength(0);
  });
  it("the asked member cannot write 'vouched' or 'expired' for himself", async () => {
    await expect(as("chidi", () => respond("vouched"))).rejects.toThrow();
    await expect(as("chidi", () => respond("expired"))).rejects.toThrow();
  });
  it("after expiry even the asked member is rejected", async () => {
    await db.exec(`update transfer_requests set confirm_expires_at = now() - interval '1 minute' where id='${REQ}'`);
    await expect(as("chidi", () => respond("confirmed"))).rejects.toThrow();
    await db.exec(`update transfer_requests set confirm_expires_at = now() + interval '10 minutes' where id='${REQ}'`);
  });
  it("the asked member can answer once; the answer can't be changed", async () => {
    expect((await as("chidi", () => respond("denied"))).rows).toHaveLength(1);
    expect((await as("chidi", () => respond("confirmed"))).rows).toHaveLength(0);
    await db.exec(`update confirmations set response=null, responded_at=null where id='${CONF}'`);
  });
});

describe("RLS: reads, writes and identity", () => {
  it("members can read their circle's requests; outsiders cannot", async () => {
    expect((await as("ngozi", () => db.query(`select id from transfer_requests`))).rows).toHaveLength(1);
    expect((await as("eve", () => db.query(`select id from transfer_requests`))).rows).toHaveLength(0);
    expect((await as("eve", () => db.query(`select id from circle_members`))).rows).toHaveLength(0);
    expect((await as("eve", () => db.query(`select id from events`))).rows).toHaveLength(0);
  });
  it("only the sender can create a request, and only as a draft", async () => {
    const ins = (member: string, status = "draft") =>
      db.query(`insert into transfer_requests (circle_id,sender_member_id,channel,amount,payee_email,payee_kind,status) values ('${CIRCLE}','${member}','text',5,'a@b.example','other','${status}')`);
    await expect(as("chidi", () => ins(M.ada))).rejects.toThrow(); // posing as Ada
    await expect(as("eve", () => ins(M.ada))).rejects.toThrow();
    await expect(as("ada", () => ins(M.ada, "released"))).rejects.toThrow(); // can't self-release
    await as("ada", () => ins(M.ada));
  });
  it("users cannot forge PayPal identity or join circles directly", async () => {
    expect((await as("chidi", () => db.query(`update circle_members set paypal_email='me@evil.example' where id='${M.chidi}' returning id`))).rows).toHaveLength(0);
    await expect(as("eve", () => db.query(`insert into circle_members (circle_id,user_id) values ('${CIRCLE}','${U.eve}')`))).rejects.toThrow();
  });
  it("users cannot change request state or the directory", async () => {
    expect((await as("ada", () => db.query(`update transfer_requests set status='released' where id='${REQ}' returning id`))).rows).toHaveLength(0);
    await expect(as("ada", () => db.query(`insert into institutions (name,kind,paypal_email,verified) values ('Fake Hospital','hospital','x@y.example',true)`))).rejects.toThrow();
  });
  it("events are append-only", async () => {
    await db.exec(`insert into events (transfer_request_id,type) values ('${REQ}','x')`);
    await expect(db.exec(`update events set type='y'`)).rejects.toThrow(/append-only/);
    await expect(db.exec(`delete from events`)).rejects.toThrow(/append-only/);
  });
  it("institutions are readable by signed-in users", async () => {
    await db.exec(`insert into institutions (name,kind,paypal_email,verified) values ('H','hospital','h@b.example',true)`);
    expect((await as("ada", () => db.query(`select id from institutions`))).rows.length).toBeGreaterThan(0);
  });
});
