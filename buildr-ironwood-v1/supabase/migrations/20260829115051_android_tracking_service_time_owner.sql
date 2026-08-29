create or replace function private.assign_time_entry_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  resolved_owner uuid;
  request_role text;
begin
  resolved_owner := private.current_business_owner();

  if resolved_owner is not null then
    new.owner_id := resolved_owner;
    return new;
  end if;

  request_role := coalesce(auth.jwt() ->> 'role', '');
  if request_role = 'service_role' and new.owner_id is not null then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'A verified workspace owner is required for time entries.';
end
$function$;

drop trigger if exists time_entries_workspace_owner on public.time_entries;

create trigger time_entries_workspace_owner
before insert on public.time_entries
for each row execute function private.assign_time_entry_owner();

comment on function private.assign_time_entry_owner() is
  'Forces signed-in users to their workspace owner while allowing service-role integrations to preserve an explicit owner.';
