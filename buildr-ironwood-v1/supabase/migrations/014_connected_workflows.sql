-- Buildr connected workflows: walkthrough media, website leads, notifications, and team access.

create table if not exists public.site_visit_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  worksheet_id uuid not null references public.site_visit_worksheets(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  caption text,
  created_at timestamptz not null default now()
);
alter table public.site_visit_media enable row level security;
create trigger site_visit_media_assign_owner before insert on public.site_visit_media
  for each row execute function private.assign_workspace_owner();
create policy site_visit_media_owner_all on public.site_visit_media for all to authenticated
  using (private.can_field_write_business(owner_id)) with check (private.can_field_write_business(owner_id));
create index site_visit_media_worksheet_idx on public.site_visit_media (worksheet_id, created_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-visit-media', 'site-visit-media', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy site_visit_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'site-visit-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy site_visit_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-visit-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy site_visit_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-visit-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  project_type text,
  message text,
  source text not null default 'website',
  status text not null default 'new' check (status in ('new','contacted','qualified','converted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy leads_owner_all on public.leads for all to authenticated
  using (private.can_manage_business(owner_id)) with check (private.can_manage_business(owner_id));
create index leads_owner_status_idx on public.leads (owner_id, status, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  href text,
  kind text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy notifications_owner_all on public.notifications for all to authenticated
  using (private.can_access_business(owner_id)) with check (private.can_manage_business(owner_id));
create index notifications_owner_unread_idx on public.notifications (owner_id, created_at desc) where read_at is null;

grant select, insert, update, delete on public.site_visit_media, public.leads, public.notifications to authenticated;
