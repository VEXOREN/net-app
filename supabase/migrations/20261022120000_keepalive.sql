-- Lekka funkcja do codziennego pingu z GitHub Actions.
-- Darmowy plan Supabase usypia projekt po 7 dniach bez ruchu;
-- jedno wywołanie dziennie wystarcza, żeby baza była aktywna.
create function public.keepalive()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function public.keepalive() to anon, authenticated;
