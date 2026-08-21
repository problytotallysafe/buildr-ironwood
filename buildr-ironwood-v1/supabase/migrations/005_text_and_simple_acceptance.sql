-- Text-message delivery, simpler customer acceptance, and documented offline acceptance.

alter table estimates
  add column if not exists accepted_by_phone text,
  add column if not exists acceptance_method text;

create table estimate_acceptance_evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  estimate_id uuid not null references estimates(id) on delete cascade,
  revision_number int not null default 0,
  evidence_type text not null default 'text_confirmation',
  note text not null,
  storage_path text,
  file_name text,
  content_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table estimate_acceptance_evidence enable row level security;
create policy estimate_acceptance_evidence_owner_all on estimate_acceptance_evidence
  for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create trigger estimate_acceptance_evidence_touch before update on estimate_acceptance_evidence
  for each row execute function touch_updated_at();
create index estimate_acceptance_evidence_estimate_idx on estimate_acceptance_evidence(estimate_id,created_at desc);

insert into storage.buckets(id,name,public)
values('acceptance-evidence','acceptance-evidence',false)
on conflict(id) do nothing;

create policy acceptance_evidence_owner_select on storage.objects for select to authenticated
using(bucket_id='acceptance-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
create policy acceptance_evidence_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='acceptance-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
create policy acceptance_evidence_owner_update on storage.objects for update to authenticated
using(bucket_id='acceptance-evidence' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='acceptance-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
create policy acceptance_evidence_owner_delete on storage.objects for delete to authenticated
using(bucket_id='acceptance-evidence' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function get_public_estimate(p_token uuid) returns jsonb
language sql stable security definer set search_path=public as $$
select jsonb_build_object(
 'estimate', to_jsonb(e)-'owner_id'-'private_notes'-'accepted_by_email'-'accepted_by_phone'-'acceptance_note'-'public_token'-'default_markup_rate',
 'customer', jsonb_build_object('first_name',c.first_name,'last_name',c.last_name,'email',c.email,'phone',c.phone),
 'items', coalesce((select jsonb_agg(to_jsonb(i)-'owner_id'-'estimate_id'-'catalog_item_id'-'unit_cost'-'markup_rate'-'line_subtotal'-'line_markup'-'private_notes' order by i.sort_order) from estimate_items i where i.estimate_id=e.id),'[]'::jsonb),
 'business', coalesce((select to_jsonb(s)-'owner_id'-'default_tax_rate'-'default_markup_rate' from business_settings s where s.owner_id=e.owner_id),'{}'::jsonb)
) from estimates e join customers c on c.id=e.customer_id where e.public_token=p_token;
$$;
grant execute on function get_public_estimate(uuid) to anon,authenticated;

create or replace function accept_public_estimate_v2(
  p_token uuid,
  p_name text,
  p_email text default null,
  p_phone text default null,
  p_note text default null,
  p_method text default 'online'
) returns void language plpgsql security definer set search_path=public as $$
declare v estimates%rowtype; v_change_orders numeric(12,2); v_email text; v_phone text;
begin
  v_email := nullif(lower(trim(coalesce(p_email,''))), '');
  v_phone := nullif(trim(coalesce(p_phone,'')), '');
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Full name is required.'; end if;
  if v_email is null and v_phone is null then raise exception 'Email or mobile number is required.'; end if;
  if v_email is not null and position('@' in v_email)=0 then raise exception 'Enter a valid email address.'; end if;
  select * into v from estimates where public_token=p_token for update;
  if not found then raise exception 'Proposal not found.'; end if;
  if v.status='accepted' then return; end if;
  update estimates set status='accepted',accepted_at=now(),accepted_by_name=trim(p_name),
    accepted_by_email=v_email,accepted_by_phone=v_phone,acceptance_note=nullif(trim(coalesce(p_note,'')),''),
    acceptance_method=coalesce(nullif(trim(p_method),''),'online') where id=v.id;
  insert into estimate_events(owner_id,estimate_id,event_type,metadata)
  values(v.owner_id,v.id,'accepted',jsonb_build_object('name',trim(p_name),'email',v_email,'phone',v_phone,'method',p_method,'revision_number',v.revision_number));
  select coalesce(sum(total),0) into v_change_orders from change_orders where project_id=(select id from projects where estimate_id=v.id) and status='accepted';
  insert into projects(owner_id,customer_id,estimate_id,name,project_address,contract_total)
  values(v.owner_id,v.customer_id,v.id,v.title,v.project_address,v.total)
  on conflict(estimate_id) do update set name=excluded.name,project_address=excluded.project_address,contract_total=excluded.contract_total+v_change_orders;
end$$;
grant execute on function accept_public_estimate_v2(uuid,text,text,text,text,text) to anon,authenticated;

create or replace function record_offline_estimate_acceptance(
  p_estimate_id uuid,
  p_name text,
  p_method text,
  p_note text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v estimates%rowtype; v_change_orders numeric(12,2);
begin
  select * into v from estimates where id=p_estimate_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Estimate not found or not authorized.'; end if;
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Customer name is required.'; end if;
  if length(trim(coalesce(p_note,'')))<3 then raise exception 'Add a note describing the customer approval.'; end if;
  if p_method not in ('signed_paper','in_person','other_documented') then raise exception 'Choose a valid acceptance method.'; end if;
  update estimates set status='accepted',accepted_at=now(),accepted_by_name=trim(p_name),
    accepted_by_email=null,accepted_by_phone=null,acceptance_note=nullif(trim(coalesce(p_note,'')),''),
    acceptance_method=p_method where id=v.id;
  insert into estimate_events(owner_id,estimate_id,event_type,metadata)
  values(v.owner_id,v.id,'offline_acceptance_recorded',jsonb_build_object('name',trim(p_name),'method',p_method,'note',nullif(trim(coalesce(p_note,'')),''),'revision_number',v.revision_number));
  select coalesce(sum(total),0) into v_change_orders from change_orders where project_id=(select id from projects where estimate_id=v.id) and status='accepted';
  insert into projects(owner_id,customer_id,estimate_id,name,project_address,contract_total)
  values(v.owner_id,v.customer_id,v.id,v.title,v.project_address,v.total)
  on conflict(estimate_id) do update set name=excluded.name,project_address=excluded.project_address,contract_total=excluded.contract_total+v_change_orders;
end$$;
grant execute on function record_offline_estimate_acceptance(uuid,text,text,text) to authenticated;

create or replace function begin_estimate_revision(p_estimate_id uuid,p_reason text default null) returns int
language plpgsql security definer set search_path=public as $$
declare v estimates%rowtype; v_revision int;
begin
  select * into v from estimates where id=p_estimate_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Estimate not found or not authorized.'; end if;
  if v.status='draft' then return v.revision_number; end if;
  v_revision := v.revision_number+1;
  insert into estimate_revisions(owner_id,estimate_id,revision_number,reason,estimate_snapshot,sections_snapshot,items_snapshot,prior_status,prior_accepted_at,prior_accepted_by_name)
  values(
    v.owner_id,v.id,v_revision,nullif(trim(p_reason),''),to_jsonb(v),
    coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from estimate_sections s where s.estimate_id=v.id),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from estimate_items i where i.estimate_id=v.id),'[]'::jsonb),
    v.status,v.accepted_at,v.accepted_by_name
  );
  update estimates set status='draft',revision_number=v_revision,public_token=gen_random_uuid(),sent_at=null,
    first_viewed_at=null,last_viewed_at=null,view_count=0,accepted_at=null,accepted_by_name=null,
    accepted_by_email=null,accepted_by_phone=null,acceptance_note=null,acceptance_method=null where id=v.id;
  insert into estimate_events(owner_id,estimate_id,event_type,metadata)
  values(v.owner_id,v.id,case when v.status='accepted' then 'revised_after_acceptance' else 'revised' end,
    jsonb_build_object('revision_number',v_revision,'prior_status',v.status,'prior_accepted_at',v.accepted_at,'prior_accepted_by_name',v.accepted_by_name,'reason',nullif(trim(p_reason),'')));
  return v_revision;
end$$;
grant execute on function begin_estimate_revision(uuid,text) to authenticated;
