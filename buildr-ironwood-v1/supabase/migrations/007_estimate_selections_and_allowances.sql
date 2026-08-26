-- Track estimate selections, allowances, customer-supplied items, and open decisions.

alter table public.estimate_items
  add column if not exists selection_status text not null default 'final',
  add column if not exists selection_responsibility text not null default 'ironwood',
  add column if not exists selection_deadline date,
  add column if not exists selected_product text,
  add column if not exists selection_notes text;

alter table public.estimate_items
  drop constraint if exists estimate_items_selection_status_check,
  add constraint estimate_items_selection_status_check
    check (selection_status in ('final','allowance','customer_supplied','undecided','excluded')),
  drop constraint if exists estimate_items_selection_responsibility_check,
  add constraint estimate_items_selection_responsibility_check
    check (selection_responsibility in ('ironwood','customer'));

create index if not exists estimate_items_open_selections_idx
  on public.estimate_items (estimate_id, selection_status)
  where selection_status in ('allowance','undecided','customer_supplied');
