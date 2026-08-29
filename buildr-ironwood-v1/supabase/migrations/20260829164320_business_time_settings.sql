alter table public.business_settings
  add column if not exists owner_hourly_cost numeric(10,2) not null default 0,
  add column if not exists android_minimum_visit_minutes integer not null default 5,
  add column if not exists android_maximum_visit_hours integer not null default 18;

alter table public.business_settings
  drop constraint if exists business_settings_owner_hourly_cost_check,
  add constraint business_settings_owner_hourly_cost_check
    check (owner_hourly_cost between 0 and 1000),
  drop constraint if exists business_settings_android_minimum_visit_check,
  add constraint business_settings_android_minimum_visit_check
    check (android_minimum_visit_minutes between 1 and 120),
  drop constraint if exists business_settings_android_maximum_visit_check,
  add constraint business_settings_android_maximum_visit_check
    check (android_maximum_visit_hours between 1 and 24);

comment on column public.business_settings.owner_hourly_cost is
  'Internal owner labor cost used for new and historical owner time costing.';
comment on column public.business_settings.android_minimum_visit_minutes is
  'Shortest OwnTracks jobsite visit that Buildr converts into time automatically.';
comment on column public.business_settings.android_maximum_visit_hours is
  'Longest OwnTracks jobsite visit that Buildr converts into time automatically.';
