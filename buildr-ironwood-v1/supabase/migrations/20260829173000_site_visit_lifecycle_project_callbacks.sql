alter table public.site_visit_worksheets
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists site_visit_active_owner_date_idx
  on public.site_visit_worksheets (owner_id, visit_date desc)
  where archived_at is null and deleted_at is null;

create index if not exists site_visit_archived_owner_date_idx
  on public.site_visit_worksheets (owner_id, archived_at desc)
  where archived_at is not null and deleted_at is null;

create index if not exists site_visit_deleted_owner_date_idx
  on public.site_visit_worksheets (owner_id, deleted_at desc)
  where deleted_at is not null;

create sequence if not exists public.project_callback_number_seq start 1;

create table if not exists public.project_callbacks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  callback_number text not null,
  title text not null,
  status text not null default 'draft',
  reported_at date not null default current_date,
  scheduled_for date,
  issue_description text not null,
  warranty_status text not null default 'under_review',
  repair_plan text,
  cost_responsibility text not null default 'undetermined',
  estimated_internal_cost numeric(12,2) not null default 0,
  actual_internal_cost numeric(12,2),
  homeowner_amount numeric(12,2) not null default 0,
  accepted_at timestamptz,
  accepted_by_name text,
  acceptance_note text,
  completed_at timestamptz,
  private_notes text,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_callbacks_owner_number_key unique (owner_id, callback_number),
  constraint project_callbacks_title_check check (char_length(trim(title)) between 1 and 160),
  constraint project_callbacks_issue_check check (char_length(trim(issue_description)) between 1 and 10000),
  constraint project_callbacks_status_check check (status in ('draft','accepted','completed')),
  constraint project_callbacks_warranty_check check (warranty_status in ('under_review','warranty','not_warranty')),
  constraint project_callbacks_responsibility_check check (cost_responsibility in ('undetermined','ironwood','homeowner','shared')),
  constraint project_callbacks_estimated_cost_check check (estimated_internal_cost >= 0),
  constraint project_callbacks_actual_cost_check check (actual_internal_cost is null or actual_internal_cost >= 0),
  constraint project_callbacks_homeowner_amount_check check (homeowner_amount >= 0)
);

create index if not exists project_callbacks_owner_idx
  on public.project_callbacks (owner_id);

create index if not exists project_callbacks_project_active_idx
  on public.project_callbacks (project_id, reported_at desc)
  where archived_at is null and deleted_at is null;

create index if not exists project_callbacks_project_financial_idx
  on public.project_callbacks (project_id, status)
  where deleted_at is null and status in ('accepted','completed');

create or replace function private.prepare_project_callback()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  resolved_owner uuid;
begin
  resolved_owner := private.current_business_owner();
  if resolved_owner is null then
    raise exception using errcode = '42501', message = 'A verified workspace is required.';
  end if;

  if tg_op = 'INSERT' then
    new.owner_id := resolved_owner;
    if not exists (
      select 1
      from public.projects p
      where p.id = new.project_id
        and p.owner_id = resolved_owner
        and p.status = 'complete'
    ) then
      raise exception using errcode = '23514', message = 'Callbacks can only be added to completed projects.';
    end if;
    if nullif(trim(new.callback_number), '') is null then
      new.callback_number := 'IW-CB-'
        || to_char(current_date, 'YYYY')
        || '-'
        || lpad(nextval('public.project_callback_number_seq'::regclass)::text, 4, '0');
    end if;
  else
    new.owner_id := old.owner_id;
    if new.project_id <> old.project_id then
      raise exception using errcode = '23514', message = 'A callback cannot be moved to another project.';
    end if;
    if resolved_owner <> old.owner_id then
      raise exception using errcode = '42501', message = 'This callback belongs to another workspace.';
    end if;
  end if;

  if new.status in ('accepted','completed') then
    new.accepted_at := coalesce(new.accepted_at, now());
  else
    new.accepted_at := null;
    new.completed_at := null;
  end if;

  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status = 'accepted' then
    new.completed_at := null;
  end if;

  return new;
end
$$;

create or replace function private.apply_project_callback_contract_delta()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  old_amount numeric(12,2) := 0;
  new_amount numeric(12,2) := 0;
  target_project uuid;
  target_owner uuid;
begin
  if tg_op <> 'INSERT'
    and old.deleted_at is null
    and old.status in ('accepted','completed') then
    old_amount := coalesce(old.homeowner_amount, 0);
  end if;

  if tg_op <> 'DELETE'
    and new.deleted_at is null
    and new.status in ('accepted','completed') then
    new_amount := coalesce(new.homeowner_amount, 0);
  end if;

  target_project := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
  target_owner := case when tg_op = 'DELETE' then old.owner_id else new.owner_id end;

  if new_amount <> old_amount then
    update public.projects
    set contract_total = greatest(0, coalesce(contract_total, 0) + new_amount - old_amount)
    where id = target_project
      and owner_id = target_owner;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists project_callbacks_prepare on public.project_callbacks;
create trigger project_callbacks_prepare
before insert or update on public.project_callbacks
for each row execute function private.prepare_project_callback();

drop trigger if exists project_callbacks_touch on public.project_callbacks;
create trigger project_callbacks_touch
before update on public.project_callbacks
for each row execute function public.touch_updated_at();

drop trigger if exists project_callbacks_contract_delta on public.project_callbacks;
create trigger project_callbacks_contract_delta
after insert or update or delete on public.project_callbacks
for each row execute function private.apply_project_callback_contract_delta();

alter table public.project_callbacks enable row level security;
alter table public.project_callbacks force row level security;

revoke all on table public.project_callbacks from public, anon;
grant select, insert, update, delete on table public.project_callbacks to authenticated;

drop policy if exists project_callbacks_team_select on public.project_callbacks;
create policy project_callbacks_team_select on public.project_callbacks
for select to authenticated
using (private.can_access_business(owner_id));

drop policy if exists project_callbacks_sales_write on public.project_callbacks;
create policy project_callbacks_sales_write on public.project_callbacks
for all to authenticated
using (private.can_sales_write_business(owner_id))
with check (private.can_sales_write_business(owner_id));

revoke execute on function private.prepare_project_callback() from public, anon, authenticated, service_role;
revoke execute on function private.apply_project_callback_contract_delta() from public, anon, authenticated, service_role;

comment on table public.project_callbacks is
  'Post-completion warranty and customer-paid callbacks. Accepted customer charges adjust the project contract; accepted costs feed profitability reporting.';

comment on column public.project_callbacks.actual_internal_cost is
  'Final Ironwood cost when known. A null value means reporting should use estimated_internal_cost.';

comment on column public.project_callbacks.homeowner_amount is
  'Additional customer revenue. It affects the project contract only while the callback is accepted or completed and not deleted.';
