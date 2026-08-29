drop policy if exists project_callbacks_sales_write on public.project_callbacks;

create policy project_callbacks_sales_insert on public.project_callbacks
for insert to authenticated
with check (private.can_sales_write_business(owner_id));

create policy project_callbacks_sales_update on public.project_callbacks
for update to authenticated
using (private.can_sales_write_business(owner_id))
with check (private.can_sales_write_business(owner_id));

create policy project_callbacks_sales_delete on public.project_callbacks
for delete to authenticated
using (private.can_sales_write_business(owner_id));

-- The unique owner/number index already covers owner_id lookups and its foreign key.
drop index if exists public.project_callbacks_owner_idx;
