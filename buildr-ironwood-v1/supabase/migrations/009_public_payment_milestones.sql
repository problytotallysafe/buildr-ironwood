create or replace function public.get_public_estimate(p_token uuid) returns jsonb
language sql stable security definer set search_path=public as $$
select jsonb_build_object(
  'estimate', to_jsonb(e)-'owner_id'-'private_notes'-'accepted_by_email'-'accepted_by_phone'-'acceptance_note'-'public_token'-'default_markup_rate',
  'customer', jsonb_build_object('first_name',c.first_name,'last_name',c.last_name,'email',c.email,'phone',c.phone),
  'items', coalesce((select jsonb_agg(to_jsonb(i)-'owner_id'-'estimate_id'-'catalog_item_id'-'unit_cost'-'markup_rate'-'line_subtotal'-'line_markup'-'private_notes' order by i.sort_order) from estimate_items i where i.estimate_id=e.id),'[]'::jsonb),
  'payment_milestones', coalesce((select jsonb_agg(jsonb_build_object(
    'id',m.id,
    'title',m.title,
    'amount_type',m.amount_type,
    'amount_value',m.amount_value,
    'due_trigger',m.due_trigger,
    'due_date',m.due_date,
    'sort_order',m.sort_order
  ) order by m.sort_order) from estimate_payment_milestones m where m.estimate_id=e.id),'[]'::jsonb),
  'business', coalesce((select to_jsonb(s)-'owner_id'-'default_tax_rate'-'default_markup_rate' from business_settings s where s.owner_id=e.owner_id),'{}'::jsonb)
) from estimates e join customers c on c.id=e.customer_id where e.public_token=p_token;
$$;
