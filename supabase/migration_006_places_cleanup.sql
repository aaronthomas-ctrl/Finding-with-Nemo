-- 28. Google Maps terms: latitude and longitude that came from the Places API may be kept for 30 consecutive days.
-- Coordinates from the Geocoding API (geo_source = 'geocoding') and the place_id may be kept. This clears the rest.
create or replace function public.clear_expired_places_coordinates()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.clients
     set lat = null, lng = null, geo_source = null, places_fetched_at = null
   where geo_source = 'places' and places_fetched_at is not null
     and places_fetched_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.clear_expired_places_coordinates from anon, authenticated, public;

create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule('places-coordinates-30d') where exists (select 1 from cron.job where jobname = 'places-coordinates-30d');
select cron.schedule('places-coordinates-30d', '17 3 * * *', 'select public.clear_expired_places_coordinates()');
