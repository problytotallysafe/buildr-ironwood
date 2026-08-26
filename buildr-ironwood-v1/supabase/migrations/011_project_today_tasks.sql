create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'complete')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_tasks enable row level security;

create policy project_tasks_owner_select on public.project_tasks for select
  to authenticated using ((select auth.uid()) = owner_id);
create policy project_tasks_owner_insert on public.project_tasks for insert
  to authenticated with check ((select auth.uid()) = owner_id);
create policy project_tasks_owner_update on public.project_tasks for update
  to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy project_tasks_owner_delete on public.project_tasks for delete
  to authenticated using ((select auth.uid()) = owner_id);

create trigger project_tasks_touch before update on public.project_tasks
  for each row execute function public.touch_updated_at();

create index project_tasks_owner_due_idx
  on public.project_tasks (owner_id, status, due_date);
create index project_tasks_project_idx
  on public.project_tasks (project_id, status, due_date);
