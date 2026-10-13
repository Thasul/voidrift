alter table public.practice_history drop constraint if exists practice_history_destinations_check;
alter table public.practice_history add constraint practice_history_destinations_check check(destinations between 0 and 14);
update public.practice_history
set destinations=public.voidrift_destination_for_score(score)
where destinations is distinct from public.voidrift_destination_for_score(score);
