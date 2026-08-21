-- Independence evaluations, editable operational records, and project change orders.

create type change_order_status as enum ('draft','sent','viewed','accepted','declined');

create table independence_assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict,
  estimate_id uuid references estimates(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  evaluation_date date not null default current_date,
  title text not null default 'Ironwood Independence In-Home Evaluation',
  home_areas text[] not null default array['Primary bathroom']::text[],
  priorities text[] not null default '{}'::text[],
  current_conditions jsonb not null default '{}'::jsonb,
  base_package_items text[] not null default array[
    'Remove existing tub and protect the work area',
    'Install a low-threshold shower pan',
    'Install an acrylic or composite wall system',
    'Install proper blocking and two decorative grab bars',
    'Install a handheld shower',
    'Install LVP flooring',
    'Complete trim and paint touch-ups',
    'Final cleanup and independence walkthrough'
  ]::text[],
  independence_options text[] not null default '{}'::text[],
  measurements text,
  observations text,
  customer_goals text,
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table independence_assessments enable row level security;
create policy independence_assessments_owner_all on independence_assessments
  for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create trigger independence_assessments_touch before update on independence_assessments
  for each row execute function touch_updated_at();
create index independence_assessments_customer_idx on independence_assessments(customer_id, evaluation_date desc);
create index independence_assessments_project_idx on independence_assessments(project_id);

alter table estimates
  add column if not exists independence_assessment_id uuid references independence_assessments(id) on delete set null,
  add column if not exists revision_number int not null default 0;

create table estimate_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  estimate_id uuid not null references estimates(id) on delete cascade,
  revision_number int not null,
  reason text,
  estimate_snapshot jsonb not null,
  sections_snapshot jsonb not null default '[]'::jsonb,
  items_snapshot jsonb not null default '[]'::jsonb,
  prior_status estimate_status not null,
  prior_accepted_at timestamptz,
  prior_accepted_by_name text,
  created_at timestamptz not null default now(),
  unique(estimate_id, revision_number)
);

alter table estimate_revisions enable row level security;
create policy estimate_revisions_owner_all on estimate_revisions
  for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create index estimate_revisions_estimate_idx on estimate_revisions(estimate_id, revision_number desc);

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
    accepted_by_email=null,acceptance_note=null where id=v.id;
  insert into estimate_events(owner_id,estimate_id,event_type,metadata)
  values(v.owner_id,v.id,case when v.status='accepted' then 'revised_after_acceptance' else 'revised' end,
    jsonb_build_object('revision_number',v_revision,'prior_status',v.status,'prior_accepted_at',v.accepted_at,'prior_accepted_by_name',v.accepted_by_name,'reason',nullif(trim(p_reason),'')));
  return v_revision;
end$$;
grant execute on function begin_estimate_revision(uuid,text) to authenticated;

create table change_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict,
  change_order_number text not null,
  title text not null,
  status change_order_status not null default 'draft',
  reason text,
  scope_changes text not null,
  schedule_impact text,
  payment_terms text,
  customer_notes text,
  private_notes text,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(7,4) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  public_token uuid not null default gen_random_uuid() unique,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count int not null default 0,
  accepted_at timestamptz,
  accepted_by_name text,
  accepted_by_email text,
  acceptance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, change_order_number)
);

create table change_order_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  change_order_id uuid not null references change_orders(id) on delete cascade,
  sort_order int not null default 0,
  description text not null,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'each',
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table change_order_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  change_order_id uuid not null references change_orders(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table change_orders enable row level security;
alter table change_order_items enable row level security;
alter table change_order_events enable row level security;
create policy change_orders_owner_all on change_orders for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy change_order_items_owner_all on change_order_items for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy change_order_events_owner_all on change_order_events for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create trigger change_orders_touch before update on change_orders for each row execute function touch_updated_at();
create trigger change_order_items_touch before update on change_order_items for each row execute function touch_updated_at();
create index change_orders_project_idx on change_orders(project_id, created_at desc);
create index change_order_items_order_idx on change_order_items(change_order_id, sort_order);
create index change_order_events_order_idx on change_order_events(change_order_id, created_at desc);

create sequence if not exists change_order_number_seq start 1;
create or replace function set_change_order_number() returns trigger language plpgsql as $$
begin
  if new.change_order_number is null or new.change_order_number='' then
    new.change_order_number := 'IW-CO-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('change_order_number_seq')::text,4,'0');
  end if;
  return new;
end$$;
create trigger change_orders_number_before_insert before insert on change_orders
  for each row execute function set_change_order_number();

create or replace function get_public_change_order(p_token uuid) returns jsonb
language sql stable security definer set search_path=public as $$
select jsonb_build_object(
  'change_order', to_jsonb(co)-'owner_id'-'private_notes'-'accepted_by_email'-'acceptance_note'-'public_token',
  'customer', jsonb_build_object('first_name',c.first_name,'last_name',c.last_name,'email',c.email),
  'project', jsonb_build_object('name',p.name,'project_address',p.project_address),
  'items', coalesce((select jsonb_agg(to_jsonb(i)-'owner_id'-'change_order_id' order by i.sort_order) from change_order_items i where i.change_order_id=co.id),'[]'::jsonb),
  'business', coalesce((select to_jsonb(s)-'owner_id'-'default_tax_rate'-'default_markup_rate' from business_settings s where s.owner_id=co.owner_id),'{}'::jsonb)
) from change_orders co
join customers c on c.id=co.customer_id
join projects p on p.id=co.project_id
where co.public_token=p_token;
$$;
grant execute on function get_public_change_order(uuid) to anon,authenticated;

create or replace function record_change_order_view(p_token uuid,p_user_agent text default null) returns void
language plpgsql security definer set search_path=public as $$
declare v change_orders%rowtype;
begin
  select * into v from change_orders where public_token=p_token;
  if not found then return; end if;
  update change_orders set
    status=case when status='sent' then 'viewed'::change_order_status else status end,
    first_viewed_at=coalesce(first_viewed_at,now()), last_viewed_at=now(), view_count=view_count+1
  where id=v.id;
  insert into change_order_events(owner_id,change_order_id,event_type,metadata)
  values(v.owner_id,v.id,'viewed',jsonb_build_object('user_agent',left(coalesce(p_user_agent,''),500)));
end$$;
grant execute on function record_change_order_view(uuid,text) to anon,authenticated;

create or replace function accept_public_change_order(p_token uuid,p_name text,p_email text,p_note text default null) returns void
language plpgsql security definer set search_path=public as $$
declare v change_orders%rowtype;
begin
  if length(trim(p_name))<2 or position('@' in p_email)=0 then
    raise exception 'Name and valid email are required.';
  end if;
  select * into v from change_orders where public_token=p_token for update;
  if not found then raise exception 'Change order not found.'; end if;
  if v.status='accepted' then return; end if;
  update change_orders set status='accepted',accepted_at=now(),accepted_by_name=trim(p_name),
    accepted_by_email=lower(trim(p_email)),acceptance_note=nullif(trim(p_note),'') where id=v.id;
  update projects set contract_total=contract_total+v.total where id=v.project_id;
  insert into change_order_events(owner_id,change_order_id,event_type,metadata)
  values(v.owner_id,v.id,'accepted',jsonb_build_object('name',trim(p_name),'email',lower(trim(p_email))));
end$$;
grant execute on function accept_public_change_order(uuid,text,text,text) to anon,authenticated;

-- Reaccepting a revised estimate replaces the base contract value while retaining
-- separately approved change orders.
create or replace function accept_public_estimate(p_token uuid,p_name text,p_email text,p_note text default null) returns void
language plpgsql security definer set search_path=public as $$
declare v estimates%rowtype; v_change_orders numeric(12,2);
begin
  if length(trim(p_name))<2 or position('@' in p_email)=0 then raise exception 'Name and valid email are required.'; end if;
  select * into v from estimates where public_token=p_token for update;
  if not found then raise exception 'Proposal not found.'; end if;
  if v.status='accepted' then return; end if;
  update estimates set status='accepted',accepted_at=now(),accepted_by_name=trim(p_name),accepted_by_email=lower(trim(p_email)),acceptance_note=nullif(trim(p_note),'') where id=v.id;
  insert into estimate_events(owner_id,estimate_id,event_type,metadata)
  values(v.owner_id,v.id,'accepted',jsonb_build_object('name',trim(p_name),'email',lower(trim(p_email)),'revision_number',v.revision_number));
  select coalesce(sum(total),0) into v_change_orders from change_orders where project_id=(select id from projects where estimate_id=v.id) and status='accepted';
  insert into projects(owner_id,customer_id,estimate_id,name,project_address,contract_total)
  values(v.owner_id,v.customer_id,v.id,v.title,v.project_address,v.total)
  on conflict(estimate_id) do update set name=excluded.name,project_address=excluded.project_address,contract_total=excluded.contract_total+v_change_orders;
end$$;
grant execute on function accept_public_estimate(uuid,text,text,text) to anon,authenticated;
