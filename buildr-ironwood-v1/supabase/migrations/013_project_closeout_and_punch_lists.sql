create table if not exists public.project_closeouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  final_cleanup_complete boolean not null default false,
  customer_walkthrough_complete boolean not null default false,
  keys_access_returned boolean not null default false,
  manuals_delivered boolean not null default false,
  warranty_information_delivered boolean not null default false,
  subcontractor_documents_complete boolean not null default false,
  final_photos_complete boolean not null default false,
  final_payment_complete boolean not null default false,
  walkthrough_date date,
  customer_notes text,
  warranty_notes text,
  internal_notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_punch_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  room_location text,
  responsible_party text not null default 'ironwood' check (responsible_party in ('ironwood','customer','subcontractor')),
  due_date date,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','complete')),
  customer_visible boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_closeouts enable row level security;
alter table public.project_punch_items enable row level security;

create policy project_closeouts_owner_select on public.project_closeouts for select to authenticated using ((select auth.uid()) = owner_id);
create policy project_closeouts_owner_insert on public.project_closeouts for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy project_closeouts_owner_update on public.project_closeouts for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy project_closeouts_owner_delete on public.project_closeouts for delete to authenticated using ((select auth.uid()) = owner_id);

create policy project_punch_items_owner_select on public.project_punch_items for select to authenticated using ((select auth.uid()) = owner_id);
create policy project_punch_items_owner_insert on public.project_punch_items for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy project_punch_items_owner_update on public.project_punch_items for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy project_punch_items_owner_delete on public.project_punch_items for delete to authenticated using ((select auth.uid()) = owner_id);

create trigger project_closeouts_touch before update on public.project_closeouts for each row execute function public.touch_updated_at();
create trigger project_punch_items_touch before update on public.project_punch_items for each row execute function public.touch_updated_at();

create index project_closeouts_owner_idx on public.project_closeouts (owner_id, project_id);
create index project_punch_items_project_idx on public.project_punch_items (project_id, status, due_date);
create index project_punch_items_owner_idx on public.project_punch_items (owner_id, status);
