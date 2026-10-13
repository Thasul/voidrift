alter table public.game_runs drop constraint if exists game_runs_destinations_check;
alter table public.game_runs add constraint game_runs_destinations_check check (destinations between 0 and 14);
create or replace function public.voidrift_destination_for_score(p_score integer)
returns integer language sql immutable strict set search_path='' as $$
 select case
 when p_score>=975 then 14 when p_score>=900 then 13
 when p_score>=820 then 12 when p_score>=700 then 11
 when p_score>=450 then 10 when p_score>=390 then 9
 when p_score>=330 then 8 when p_score>=260 then 7
 when p_score>=195 then 6 when p_score>=140 then 5
 when p_score>=95 then 4 when p_score>=60 then 3
 when p_score>=35 then 2 when p_score>=15 then 1 else 0 end;
$$;
revoke all on function public.voidrift_destination_for_score(integer) from public,anon,authenticated;
grant execute on function public.voidrift_destination_for_score(integer) to service_role;
update public.game_runs set destinations=public.voidrift_destination_for_score(total_score)
where destinations is distinct from public.voidrift_destination_for_score(total_score);
