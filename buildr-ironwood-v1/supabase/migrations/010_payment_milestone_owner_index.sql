create index if not exists estimate_payment_milestones_owner_idx
  on public.estimate_payment_milestones (owner_id, estimate_id);
