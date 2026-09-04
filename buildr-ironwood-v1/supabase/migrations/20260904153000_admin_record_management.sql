alter table public.customers add column if not exists deleted_at timestamptz;

create or replace function private.assign_business_owner_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_owner uuid;
begin
  if current_user_id is null then
    return new;
  end if;

  select m.business_owner_id
    into workspace_owner
  from public.business_members m
  where m.user_id = current_user_id
    and m.status = 'active'
  limit 1;

  new.owner_id := coalesce(workspace_owner, current_user_id);
  return new;
end;
$$;

revoke execute on function private.assign_business_owner_id() from public, anon, authenticated;

do $$
declare
  t text;
  managed_tables text[] := array[
    'customers','estimates','projects','payments','time_entries','site_visit_worksheets',
    'change_orders','independence_assessments','leads','project_callbacks'
  ];
begin
  foreach t in array managed_tables loop
    execute format('drop trigger if exists assign_business_owner_id_before_insert on public.%I', t);
    execute format(
      'create trigger assign_business_owner_id_before_insert before insert on public.%I for each row execute function private.assign_business_owner_id()',
      t
    );
  end loop;
end $$;
