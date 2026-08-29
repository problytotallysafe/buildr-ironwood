alter table public.project_callbacks
  add constraint project_callbacks_acceptance_details_check
  check (
    status = 'draft'
    or (
      warranty_status in ('warranty','not_warranty')
      and cost_responsibility in ('ironwood','homeowner','shared')
      and nullif(btrim(repair_plan), '') is not null
    )
  );
