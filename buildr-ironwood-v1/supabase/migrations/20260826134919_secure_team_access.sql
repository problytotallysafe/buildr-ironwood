create schema if not exists private;

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_owner_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'field' check (role in ('owner','admin','estimator','field','read_only')),
  status text not null default 'invited' check (status in ('invited','active','suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index business_members_owner_email_key on public.business_members (business_owner_id, lower(email));
create index business_members_owner_status_idx on public.business_members (business_owner_id, status);

insert into public.business_members (business_owner_id,user_id,email,role,status,accepted_at)
select u.id,u.id,u.email,'owner','active',now()
from auth.users u
where exists (
  select 1 from public.business_settings s where s.owner_id=u.id
  union all select 1 from public.estimates e where e.owner_id=u.id
)
on conflict (user_id) do nothing;

create or replace function private.current_business_owner()
returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
  select coalesce(
    (select m.business_owner_id from public.business_members m where m.user_id=(select auth.uid()) and m.status='active' limit 1),
    (select auth.uid())
  )
$$;

create or replace function private.can_access_business(target_owner uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select (select auth.uid())=target_owner or exists(
    select 1 from public.business_members m
    where m.business_owner_id=target_owner and m.user_id=(select auth.uid()) and m.status='active'
  )
$$;

create or replace function private.can_manage_business(target_owner uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select (select auth.uid())=target_owner or exists(
    select 1 from public.business_members m
    where m.business_owner_id=target_owner and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','estimator')
  )
$$;

create or replace function private.can_field_write_business(target_owner uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select (select auth.uid())=target_owner or exists(
    select 1 from public.business_members m
    where m.business_owner_id=target_owner and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','estimator','field')
  )
$$;

create or replace function private.assign_workspace_owner()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  new.owner_id := private.current_business_owner();
  return new;
end
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_business_owner() to authenticated;
grant execute on function private.can_access_business(uuid) to authenticated;
grant execute on function private.can_manage_business(uuid) to authenticated;
grant execute on function private.can_field_write_business(uuid) to authenticated;

alter table public.business_members enable row level security;
create policy business_members_team_select on public.business_members for select to authenticated
using (private.can_access_business(business_owner_id));

create or replace function public.accept_business_invitation()
returns public.business_members
language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.business_members;
declare invite_email text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select lower(email) into invite_email from auth.users where id=(select auth.uid());
  update public.business_members
  set user_id=(select auth.uid()),status='active',accepted_at=coalesce(accepted_at,now()),last_access_at=now()
  where lower(email)=invite_email and status='invited' and user_id is null
  returning * into result;
  if result.id is null then
    update public.business_members set last_access_at=now()
    where user_id=(select auth.uid()) and status='active' returning * into result;
  end if;
  return result;
end
$$;
revoke all on function public.accept_business_invitation() from public,anon;
grant execute on function public.accept_business_invitation() to authenticated;

do $$
declare table_name text;
declare all_tables text[] := array[
  'business_settings','catalog_items','change_order_events','change_order_items','change_orders','customers',
  'estimate_acceptance_evidence','estimate_events','estimate_items','estimate_payment_milestones','estimate_revisions',
  'estimate_sections','estimates','independence_assessments','payments','project_closeouts','project_media',
  'project_punch_items','project_tasks','projects','site_visit_worksheets','team_members','time_entries'
];
declare field_tables text[] := array['payments','project_closeouts','project_media','project_punch_items','project_tasks','projects','site_visit_worksheets','team_members','time_entries'];
begin
  foreach table_name in array all_tables loop
    execute format('create policy %I on public.%I for select to authenticated using (private.can_access_business(owner_id))',table_name||'_team_select',table_name);
    execute format('create policy %I on public.%I for all to authenticated using (private.can_manage_business(owner_id)) with check (private.can_manage_business(owner_id))',table_name||'_team_manage',table_name);
    execute format('drop trigger if exists %I on public.%I',table_name||'_workspace_owner',table_name);
    execute format('create trigger %I before insert on public.%I for each row execute function private.assign_workspace_owner()',table_name||'_workspace_owner',table_name);
  end loop;
  foreach table_name in array field_tables loop
    execute format('create policy %I on public.%I for all to authenticated using (private.can_field_write_business(owner_id)) with check (private.can_field_write_business(owner_id))',table_name||'_field_write',table_name);
  end loop;
end $$;

create trigger business_members_touch before update on public.business_members
for each row execute function public.touch_updated_at();
