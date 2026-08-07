alter table estimates
add column if not exists archived_at timestamptz,
add column if not exists deleted_at timestamptz;

create index if not exists estimates_archived_at_idx
on estimates(archived_at);

create index if not exists estimates_deleted_at_idx
on estimates(deleted_at);