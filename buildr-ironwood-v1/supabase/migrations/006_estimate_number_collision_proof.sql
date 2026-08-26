-- Keep generated estimate numbers unique even after imports or restored data.

select setval(
  'public.estimate_number_seq',
  greatest(
    (select last_value from public.estimate_number_seq),
    coalesce((
      select max((regexp_match(estimate_number, '^IW-[0-9]{4}-([0-9]+)$'))[1]::bigint)
      from public.estimates
      where estimate_number ~ '^IW-[0-9]{4}-[0-9]+$'
    ), 1000)
  ),
  true
);

create or replace function public.set_estimate_number()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  candidate text;
begin
  if new.estimate_number is null or new.estimate_number = '' then
    loop
      candidate := 'IW-' || to_char(current_date, 'YYYY') || '-' ||
        lpad(nextval('public.estimate_number_seq')::text, 4, '0');

      exit when not exists (
        select 1
        from public.estimates e
        where e.owner_id = new.owner_id
          and e.estimate_number = candidate
      );
    end loop;

    new.estimate_number := candidate;
  end if;

  return new;
end
$function$;
