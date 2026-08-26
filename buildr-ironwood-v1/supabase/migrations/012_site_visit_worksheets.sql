create table if not exists public.site_visit_worksheets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  visit_date date not null default current_date,
  project_type text,
  people_present text,
  client_goals text,
  measurements text,
  existing_conditions text,
  plumbing_notes text,
  electrical_notes text,
  hvac_notes text,
  access_protection text,
  selections_discussed text,
  unanswered_questions text,
  follow_up_items text,
  photo_notes text,
  status text not null default 'draft' check (status in ('draft','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_visit_worksheets enable row level security;
create policy site_visit_owner_select on public.site_visit_worksheets for select to authenticated using ((select auth.uid()) = owner_id);
create policy site_visit_owner_insert on public.site_visit_worksheets for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy site_visit_owner_update on public.site_visit_worksheets for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy site_visit_owner_delete on public.site_visit_worksheets for delete to authenticated using ((select auth.uid()) = owner_id);
create trigger site_visit_worksheets_touch before update on public.site_visit_worksheets for each row execute function public.touch_updated_at();
create index site_visit_owner_date_idx on public.site_visit_worksheets (owner_id, visit_date desc);
create index site_visit_customer_idx on public.site_visit_worksheets (customer_id, visit_date desc);
create index site_visit_project_idx on public.site_visit_worksheets (project_id) where project_id is not null;
create index site_visit_estimate_idx on public.site_visit_worksheets (estimate_id) where estimate_id is not null;
