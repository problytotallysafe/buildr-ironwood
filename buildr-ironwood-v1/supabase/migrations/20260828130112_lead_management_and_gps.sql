-- Lead organization, notification badges, and opt-in GPS-assisted time tracking.

alter table public.leads
  add column if not exists category text not null default 'uncategorized',
  add column if not exists priority text not null default 'normal',
  add column if not exists notes text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_priority_check'
  ) then
    alter table public.leads
      add constraint leads_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;
end
$$;

create index if not exists leads_owner_active_idx
  on public.leads (owner_id, status, category, priority, created_at desc)
  where archived_at is null and deleted_at is null;

create index if not exists leads_owner_archived_idx
  on public.leads (owner_id, archived_at desc)
  where archived_at is not null and deleted_at is null;

alter table public.projects
  add column if not exists jobsite_latitude double precision,
  add column if not exists jobsite_longitude double precision,
  add column if not exists geofence_radius_meters integer not null default 150,
  add column if not exists gps_clock_in_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_geofence_radius_check'
  ) then
    alter table public.projects
      add constraint projects_geofence_radius_check
      check (geofence_radius_meters between 50 and 1000);
  end if;
end
$$;

alter table public.time_entries
  add column if not exists clock_in_method text not null default 'manual',
  add column if not exists clock_in_latitude double precision,
  add column if not exists clock_in_longitude double precision,
  add column if not exists clock_in_accuracy_meters double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_clock_in_method_check'
  ) then
    alter table public.time_entries
      add constraint time_entries_clock_in_method_check
      check (clock_in_method in ('manual', 'gps'));
  end if;
end
$$;
