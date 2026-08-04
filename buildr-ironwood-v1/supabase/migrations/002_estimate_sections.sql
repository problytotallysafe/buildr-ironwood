create table estimate_sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  estimate_id uuid not null references estimates(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table estimate_items
add column section_id uuid references estimate_sections(id) on delete set null;

alter table estimate_sections enable row level security;

create policy estimate_sections_owner_all
on estimate_sections
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create trigger estimate_sections_touch
before update on estimate_sections
for each row
execute function touch_updated_at();

create index estimate_sections_estimate_idx
on estimate_sections(estimate_id, sort_order);

create index estimate_items_section_idx
on estimate_items(section_id, sort_order);