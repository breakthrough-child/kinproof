-- Kinproof schema. All tables have RLS enabled.
-- Privileged writes (PayPal identity, state transitions, events) happen only via the
-- service role from server code; authenticated users get the narrow policies below.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  preferred_language text not null default 'en' check (preferred_language in ('en','pcm')),
  large_text boolean not null default false,
  phone text,
  created_at timestamptz not null default now()
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_label text not null default 'Family',
  role text not null default 'member' check (role in ('owner','member')),
  paypal_payer_id text,
  paypal_email text,
  paypal_verified_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (circle_id, user_id)
);

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('hospital','school','police','legal','utility','public_figure','brand','charity')),
  city text,
  country text,
  paypal_email text not null,
  aliases text[] not null default '{}',
  verified boolean not null default false,
  notes text
);

create table public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  sender_member_id uuid not null references public.circle_members(id),
  claimed_requester_member_id uuid references public.circle_members(id),
  claimed_requester_name text,
  channel text not null check (channel in ('voice_note','text','call_summary')),
  raw_message text not null default '',
  audio_path text,
  transcript text,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  payee_email text not null,
  payee_kind text not null check (payee_kind in ('claimed_member','institution','other')),
  institution_id uuid references public.institutions(id),
  rule_signals jsonb not null default '[]',
  ai_analysis jsonb,
  risk_score int not null default 0 check (risk_score between 0 and 100),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  status text not null default 'draft' check (status in
    ('draft','analyzed','awaiting_paypal_approval','held','awaiting_confirmation','released','blocked','expired','redirected')),
  paypal_order_id text,
  paypal_authorization_id text,
  paypal_capture_id text,
  confirm_expires_at timestamptz,
  override_available_at timestamptz,
  redirected_from_id uuid references public.transfer_requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.transfer_requests (circle_id, created_at desc);
create index on public.transfer_requests (status, confirm_expires_at);

create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  transfer_request_id uuid not null references public.transfer_requests(id) on delete cascade,
  asked_member_id uuid not null references public.circle_members(id),
  response text check (response in ('confirmed','denied','vouched','expired')),
  vouching_member_id uuid references public.circle_members(id),
  vouch_method text check (vouch_method in ('called_known_number','in_person','other')),
  vouch_note text,
  responded_at timestamptz
);
create index on public.confirmations (transfer_request_id);
create index on public.confirmations (asked_member_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  transfer_request_id uuid not null references public.transfer_requests(id) on delete cascade,
  actor_member_id uuid references public.circle_members(id),
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.events (transfer_request_id, created_at);

-- Idempotency for PayPal webhooks + mock PayPal state (service role only).
create table public.webhook_events (id text primary key, received_at timestamptz not null default now());
create table public.mock_kv (key text primary key, value jsonb not null);

-- Append-only audit log: nobody (even service role code paths) updates or deletes events.
create or replace function public.events_append_only() returns trigger language plpgsql as $$
begin raise exception 'events is append-only'; end $$;
create trigger events_no_update before update or delete on public.events
  for each row execute function public.events_append_only();

-- Helper functions (security definer avoids RLS recursion on circle_members).
create or replace function public.is_circle_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_members where circle_id = cid and user_id = auth.uid());
$$;

create or replace function public.my_member_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.circle_members where user_id = auth.uid();
$$;

-- RLS ------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.institutions enable row level security;
alter table public.transfer_requests enable row level security;
alter table public.confirmations enable row level security;
alter table public.events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.mock_kv enable row level security;

-- profiles: self + people who share a circle with me
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.circle_members a join public.circle_members b on a.circle_id = b.circle_id
    where a.user_id = auth.uid() and b.user_id = profiles.id)
);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- circles: members read; creator inserts. Joining by invite code is a server action.
create policy circles_select on public.circles for select to authenticated using (public.is_circle_member(id) or created_by = auth.uid());
create policy circles_insert on public.circles for insert to authenticated with check (created_by = auth.uid());

-- circle_members: read within my circles. NO insert/update policy for users:
-- PayPal identity fields are written only by the server after Log in with PayPal.
create policy members_select on public.circle_members for select to authenticated using (public.is_circle_member(circle_id));

-- institutions: readable by everyone signed in; writable only by service role (no write policy)
create policy institutions_select on public.institutions for select to authenticated using (true);

-- transfer_requests: members read; ONLY the sender creates, and only as a draft
create policy requests_select on public.transfer_requests for select to authenticated using (public.is_circle_member(circle_id));
create policy requests_insert on public.transfer_requests for insert to authenticated with check (
  status = 'draft'
  and sender_member_id in (select public.my_member_ids())
  and exists (select 1 from public.circle_members m where m.id = sender_member_id and m.circle_id = transfer_requests.circle_id)
);

-- confirmations: members of the circle read. CORE SECURITY PROPERTY:
-- only the asked member may write a response, only for themselves, only while the
-- request is awaiting_confirmation and the window is open, and never 'vouched'/'expired'.
create policy confirmations_select on public.confirmations for select to authenticated using (
  exists (select 1 from public.transfer_requests r where r.id = transfer_request_id and public.is_circle_member(r.circle_id))
);
create policy confirmations_respond on public.confirmations for update to authenticated
using (asked_member_id in (select public.my_member_ids()) and response is null)
with check (
  asked_member_id in (select public.my_member_ids())
  and response in ('confirmed','denied')
  and exists (
    select 1 from public.transfer_requests r
    where r.id = transfer_request_id and r.status = 'awaiting_confirmation'
      and (r.confirm_expires_at is null or r.confirm_expires_at > now()))
);
-- No insert policy: confirmation rows are created by the server when risk requires it.

-- events: read within circle; written only by the server
create policy events_select on public.events for select to authenticated using (
  exists (select 1 from public.transfer_requests r where r.id = transfer_request_id and public.is_circle_member(r.circle_id))
);

-- Realtime (confirmation cards + live timelines respect the same RLS)
alter publication supabase_realtime add table public.transfer_requests, public.confirmations, public.events;

-- Private bucket for voice notes (no policies: only the service role reads/writes)
insert into storage.buckets (id, name, public) values ('voice-notes', 'voice-notes', false) on conflict do nothing;
