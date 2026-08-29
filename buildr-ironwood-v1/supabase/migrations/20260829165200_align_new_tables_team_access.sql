drop policy if exists leads_team_select on public.leads;
create policy leads_team_select on public.leads
for select to authenticated
using (private.can_access_business(owner_id));

drop trigger if exists leads_workspace_owner on public.leads;
create trigger leads_workspace_owner
before insert on public.leads
for each row execute function private.assign_workspace_owner();

drop policy if exists site_visit_media_team_select on public.site_visit_media;
create policy site_visit_media_team_select on public.site_visit_media
for select to authenticated
using (private.can_access_business(owner_id));
