create or replace function private.can_manage_business(target_owner uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select (select auth.uid())=target_owner or exists(
    select 1 from public.business_members m
    where m.business_owner_id=target_owner
      and m.user_id=(select auth.uid())
      and m.status='active'
      and m.role in ('owner','admin')
  )
$$;

create or replace function private.can_sales_write_business(target_owner uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select (select auth.uid())=target_owner or exists(
    select 1 from public.business_members m
    where m.business_owner_id=target_owner
      and m.user_id=(select auth.uid())
      and m.status='active'
      and m.role in ('owner','admin','estimator')
  )
$$;

grant execute on function private.can_sales_write_business(uuid) to authenticated;

do $$
declare table_name text;
declare sales_tables text[] := array[
  'catalog_items','change_order_events','change_order_items','change_orders','customers',
  'estimate_acceptance_evidence','estimate_events','estimate_items','estimate_payment_milestones',
  'estimate_revisions','estimate_sections','estimates','independence_assessments','leads','projects'
];
begin
  foreach table_name in array sales_tables loop
    execute format('drop policy if exists %I on public.%I',table_name||'_estimator_write',table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.can_sales_write_business(owner_id)) with check (private.can_sales_write_business(owner_id))',
      table_name||'_estimator_write',
      table_name
    );
  end loop;
end $$;

drop policy if exists payments_field_write on public.payments;
drop policy if exists projects_field_write on public.projects;
drop policy if exists team_members_field_write on public.team_members;

alter function public.touch_updated_at() set search_path=pg_catalog,public;
alter function public.set_change_order_number() set search_path=pg_catalog,public;

revoke execute on function public.begin_estimate_revision(uuid,text) from public,anon;
grant execute on function public.begin_estimate_revision(uuid,text) to authenticated;
revoke execute on function public.record_offline_estimate_acceptance(uuid,text,text,text) from public,anon;
grant execute on function public.record_offline_estimate_acceptance(uuid,text,text,text) to authenticated;
revoke execute on function public.refresh_project_paid_total(uuid) from public,anon;
grant execute on function public.refresh_project_paid_total(uuid) to authenticated;

create or replace function public.refresh_project_paid_total(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  if not exists(
    select 1
    from public.projects p
    where p.id=p_project_id
      and private.can_manage_business(p.owner_id)
  ) then
    raise exception 'Not authorized';
  end if;
  update public.projects
  set amount_paid=coalesce((select sum(amount) from public.payments where project_id=p_project_id),0)
  where id=p_project_id;
end
$$;
