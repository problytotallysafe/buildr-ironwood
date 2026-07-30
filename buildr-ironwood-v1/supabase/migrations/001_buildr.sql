-- Buildr by Ironwood Remodeling
-- Run this entire file in the Supabase SQL Editor for a new project.
create extension if not exists pgcrypto;

create type estimate_status as enum ('draft','sent','viewed','accepted','declined','expired');
create type project_status as enum ('scheduled','in_progress','waiting','substantially_complete','complete','on_hold');

create table business_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Ironwood Remodeling', phone text, email text, website text,
  address text, license_number text, default_tax_rate numeric(7,4) not null default 0,
  default_markup_rate numeric(7,2) not null default 20, proposal_terms text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table customers (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null, last_name text not null, company_name text, email text, phone text,
  address_line1 text, address_line2 text, city text, state text default 'AR', postal_code text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table catalog_items (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, category text, item_type text not null default 'material', unit text not null default 'each',
  unit_cost numeric(12,2) not null default 0, default_markup_rate numeric(7,2) not null default 20,
  taxable boolean not null default true, vendor text, vendor_sku text, vendor_url text, private_notes text,
  vendor_price_checked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table estimates (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict, estimate_number text not null,
  title text not null, status estimate_status not null default 'draft', project_address text,
  scope text, exclusions text, customer_notes text, private_notes text, payment_schedule text,
  tax_rate numeric(7,4) not null default 0, default_markup_rate numeric(7,2) not null default 20,
  subtotal numeric(12,2) not null default 0, markup_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  public_token uuid not null default gen_random_uuid() unique, sent_at timestamptz, first_viewed_at timestamptz,
  last_viewed_at timestamptz, view_count int not null default 0, accepted_at timestamptz,
  accepted_by_name text, accepted_by_email text, acceptance_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id, estimate_number)
);
create table estimate_items (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  estimate_id uuid not null references estimates(id) on delete cascade, catalog_item_id uuid references catalog_items(id) on delete set null,
  sort_order int not null default 0, item_type text not null default 'material', category text, description text not null,
  quantity numeric(12,3) not null default 1, unit text not null default 'each', unit_cost numeric(12,2) not null default 0,
  markup_rate numeric(7,2) not null default 0, taxable boolean not null default true, vendor text, vendor_sku text,
  vendor_url text, private_notes text, line_subtotal numeric(12,2) not null default 0,
  line_markup numeric(12,2) not null default 0, line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table estimate_events (
  id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  estimate_id uuid not null references estimates(id) on delete cascade, event_type text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict, estimate_id uuid unique references estimates(id) on delete set null,
  name text not null, status project_status not null default 'scheduled', project_address text,
  contract_total numeric(12,2) not null default 0, amount_paid numeric(12,2) not null default 0,
  target_start_date date, target_end_date date, schedule_notes text, private_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table payments (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade, amount numeric(12,2) not null check(amount>0),
  payment_method text not null default 'other', reference_number text, notes text,
  received_at timestamptz not null default now(), created_at timestamptz not null default now()
);

create sequence if not exists estimate_number_seq start 1001;
create or replace function set_estimate_number() returns trigger language plpgsql as $$begin if new.estimate_number is null or new.estimate_number='' then new.estimate_number := 'IW-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('estimate_number_seq')::text,4,'0'); end if; return new; end$$;
create trigger estimates_number_before_insert before insert on estimates for each row execute function set_estimate_number();

create or replace function touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create trigger settings_touch before update on business_settings for each row execute function touch_updated_at();
create trigger customers_touch before update on customers for each row execute function touch_updated_at();
create trigger catalog_touch before update on catalog_items for each row execute function touch_updated_at();
create trigger estimates_touch before update on estimates for each row execute function touch_updated_at();
create trigger estimate_items_touch before update on estimate_items for each row execute function touch_updated_at();
create trigger projects_touch before update on projects for each row execute function touch_updated_at();

alter table business_settings enable row level security; alter table customers enable row level security; alter table catalog_items enable row level security;
alter table estimates enable row level security; alter table estimate_items enable row level security; alter table estimate_events enable row level security;
alter table projects enable row level security; alter table payments enable row level security;

do $$ declare t text; begin foreach t in array array['business_settings','customers','catalog_items','estimates','estimate_items','estimate_events','projects','payments'] loop execute format('create policy %I on %I for all using (owner_id=auth.uid()) with check (owner_id=auth.uid())', t || '_owner_all', t); end loop; end $$;

create or replace function get_public_estimate(p_token uuid) returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
 'estimate', to_jsonb(e)-'owner_id'-'private_notes'-'accepted_by_email'-'acceptance_note'-'public_token'-'default_markup_rate',
 'customer', jsonb_build_object('first_name',c.first_name,'last_name',c.last_name,'email',c.email),
 'items', coalesce((select jsonb_agg(to_jsonb(i)-'owner_id'-'estimate_id'-'catalog_item_id'-'unit_cost'-'markup_rate'-'line_subtotal'-'line_markup'-'private_notes' order by i.sort_order) from estimate_items i where i.estimate_id=e.id),'[]'::jsonb),
 'business', coalesce((select to_jsonb(s)-'owner_id'-'default_tax_rate'-'default_markup_rate' from business_settings s where s.owner_id=e.owner_id),'{}'::jsonb)
) from estimates e join customers c on c.id=e.customer_id where e.public_token=p_token;
$$;
grant execute on function get_public_estimate(uuid) to anon,authenticated;

create or replace function record_estimate_view(p_token uuid,p_user_agent text default null) returns void language plpgsql security definer set search_path=public as $$
declare v estimates%rowtype; begin select * into v from estimates where public_token=p_token; if not found then return; end if; update estimates set status=case when status='sent' then 'viewed'::estimate_status else status end,first_viewed_at=coalesce(first_viewed_at,now()),last_viewed_at=now(),view_count=view_count+1 where id=v.id; insert into estimate_events(owner_id,estimate_id,event_type,metadata) values(v.owner_id,v.id,'viewed',jsonb_build_object('user_agent',left(coalesce(p_user_agent,''),500))); end$$;
grant execute on function record_estimate_view(uuid,text) to anon,authenticated;

create or replace function accept_public_estimate(p_token uuid,p_name text,p_email text,p_note text default null) returns void language plpgsql security definer set search_path=public as $$
declare v estimates%rowtype; begin if length(trim(p_name))<2 or position('@' in p_email)=0 then raise exception 'Name and valid email are required.'; end if; select * into v from estimates where public_token=p_token for update; if not found then raise exception 'Proposal not found.'; end if; if v.status='accepted' then return; end if; update estimates set status='accepted',accepted_at=now(),accepted_by_name=trim(p_name),accepted_by_email=lower(trim(p_email)),acceptance_note=nullif(trim(p_note),'') where id=v.id; insert into estimate_events(owner_id,estimate_id,event_type,metadata) values(v.owner_id,v.id,'accepted',jsonb_build_object('name',trim(p_name),'email',lower(trim(p_email)))); insert into projects(owner_id,customer_id,estimate_id,name,project_address,contract_total) values(v.owner_id,v.customer_id,v.id,v.title,v.project_address,v.total) on conflict(estimate_id) do nothing; end$$;
grant execute on function accept_public_estimate(uuid,text,text,text) to anon,authenticated;

create or replace function refresh_project_paid_total(p_project_id uuid) returns void language plpgsql security definer set search_path=public as $$begin if not exists(select 1 from projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'Not authorized'; end if; update projects set amount_paid=coalesce((select sum(amount) from payments where project_id=p_project_id),0) where id=p_project_id; end$$;
grant execute on function refresh_project_paid_total(uuid) to authenticated;

create index customers_owner_name_idx on customers(owner_id,last_name,first_name);
create index estimates_owner_status_idx on estimates(owner_id,status,created_at desc);
create index estimate_items_estimate_idx on estimate_items(estimate_id,sort_order);
create index estimate_events_estimate_idx on estimate_events(estimate_id,created_at desc);
create index projects_owner_status_idx on projects(owner_id,status);
create index payments_project_idx on payments(project_id,received_at desc);
