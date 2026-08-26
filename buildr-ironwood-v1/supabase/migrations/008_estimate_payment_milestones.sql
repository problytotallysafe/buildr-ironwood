create table if not exists public.estimate_payment_milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  title text not null,
  amount_type text not null default 'percentage'
    check (amount_type in ('percentage', 'fixed')),
  amount_value numeric(12,2) not null default 0 check (amount_value >= 0),
  due_trigger text,
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_payment_milestones_percentage_check
    check (amount_type <> 'percentage' or amount_value <= 100)
);

alter table public.estimate_payment_milestones enable row level security;

create policy estimate_payment_milestones_owner_select
  on public.estimate_payment_milestones for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy estimate_payment_milestones_owner_insert
  on public.estimate_payment_milestones for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy estimate_payment_milestones_owner_update
  on public.estimate_payment_milestones for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy estimate_payment_milestones_owner_delete
  on public.estimate_payment_milestones for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create trigger estimate_payment_milestones_touch
  before update on public.estimate_payment_milestones
  for each row execute function public.touch_updated_at();

create index estimate_payment_milestones_estimate_idx
  on public.estimate_payment_milestones (estimate_id, sort_order);

alter table public.payments
  add column if not exists milestone_id uuid
  references public.estimate_payment_milestones(id) on delete set null;

create index if not exists payments_milestone_idx
  on public.payments (milestone_id)
  where milestone_id is not null;
