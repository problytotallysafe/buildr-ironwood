create table if not exists public.android_tracking_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  label text not null default 'Android phone',
  username text not null unique,
  secret_hash text not null,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint android_tracking_devices_identity_unique unique (id, owner_id),
  constraint android_tracking_devices_label_check check (char_length(label) between 1 and 80),
  constraint android_tracking_devices_username_check check (username ~ '^iw_[a-z0-9_-]{12,64}$'),
  constraint android_tracking_devices_secret_hash_check check (secret_hash ~ '^[a-f0-9]{64}$')
);

create table if not exists public.android_tracking_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null,
  external_key text not null unique,
  status text not null default 'pending',
  paired_event_id uuid references public.android_tracking_events(id) on delete set null,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  received_at timestamptz not null default now(),
  constraint android_tracking_events_device_owner_fkey
    foreign key (device_id, owner_id)
    references public.android_tracking_devices(id, owner_id)
    on delete cascade,
  constraint android_tracking_events_type_check
    check (event_type in ('enter', 'leave')),
  constraint android_tracking_events_status_check
    check (status in (
      'pending',
      'processing',
      'paired',
      'unmatched',
      'review_duration',
      'overlap',
      'error'
    )),
  constraint android_tracking_events_external_key_check
    check (external_key ~ '^[a-f0-9]{64}$')
);

create index if not exists android_tracking_events_pairing_idx
  on public.android_tracking_events (device_id, project_id, event_type, status, occurred_at desc);

create index if not exists android_tracking_events_owner_received_idx
  on public.android_tracking_events (owner_id, received_at desc);

create index if not exists android_tracking_events_device_owner_idx
  on public.android_tracking_events (device_id, owner_id);

create index if not exists android_tracking_events_project_idx
  on public.android_tracking_events (project_id);

create index if not exists android_tracking_events_paired_event_idx
  on public.android_tracking_events (paired_event_id);

create index if not exists android_tracking_events_time_entry_idx
  on public.android_tracking_events (time_entry_id);

alter table public.android_tracking_devices enable row level security;
alter table public.android_tracking_devices force row level security;
alter table public.android_tracking_events enable row level security;
alter table public.android_tracking_events force row level security;

revoke all on table public.android_tracking_devices from public, anon, authenticated;
revoke all on table public.android_tracking_events from public, anon, authenticated;
grant select, insert, update, delete on table public.android_tracking_devices to service_role;
grant select, insert, update, delete on table public.android_tracking_events to service_role;

create policy android_tracking_devices_service_only
  on public.android_tracking_devices
  for all
  to service_role
  using (true)
  with check (true);

create policy android_tracking_events_service_only
  on public.android_tracking_events
  for all
  to service_role
  using (true)
  with check (true);

alter table public.time_entries
  add column if not exists external_source_key text;

create unique index if not exists time_entries_owner_external_source_key_idx
  on public.time_entries (owner_id, external_source_key)
  where external_source_key is not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.time_entries'::regclass
      and conname = 'time_entries_clock_in_method_check'
  ) then
    alter table public.time_entries
      drop constraint time_entries_clock_in_method_check;
  end if;

  alter table public.time_entries
    add constraint time_entries_clock_in_method_check
    check (clock_in_method in ('manual', 'gps', 'android_geofence'));
exception
  when duplicate_object then null;
end
$$;

comment on table public.android_tracking_devices is
  'OwnTracks Android connections. Secrets are stored only as SHA-256 hashes and accessed by server-side service-role code.';

comment on table public.android_tracking_events is
  'Duplicate-safe Android jobsite arrival/departure metadata. Raw coordinates are not retained.';

comment on column public.time_entries.external_source_key is
  'Idempotency key for externally generated time entries.';
