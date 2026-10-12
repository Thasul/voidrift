-- VOIDRIFT: score-based travel; point thresholds are gameplay distances.
-- Outer worlds require more accumulated rarity points.
create or replace function public.voidrift_destination_for_score(p_score integer)
returns integer language sql immutable strict set search_path='' as $$
select case
 when p_score>=975 then 10
 when p_score>=780 then 9
 when p_score>=600 then 8
 when p_score>=445 then 7
 when p_score>=315 then 6
 when p_score>=215 then 5
 when p_score>=135 then 4
 when p_score>=80 then 3
 when p_score>=40 then 2
 when p_score>=15 then 1
 else 0 end;
$$;
revoke all on function public.voidrift_destination_for_score(integer)
from public,anon,authenticated;
grant execute on function public.voidrift_destination_for_score(integer) to service_role;

-- Answer and distance update remain one atomic transaction.
create or replace function public.voidrift_commit_answer(
 p_run_id uuid, p_prompt_index integer, p_prompt_tag text, p_answer text,
 p_canonical text, p_points integer, p_verdict text, p_correct boolean
)
returns table(next_index integer,next_score integer,next_destinations integer,is_finished boolean)
language plpgsql security invoker set search_path=public as $$
declare
 current_run public.game_runs%rowtype;
 new_progress integer;
 updated_points integer;
 reached integer;
begin
 select * into current_run from public.game_runs where id=p_run_id for update;
 if not found then raise exception 'Run not found'; end if;
 if current_run.finished_at is not null or current_run.progress<>p_prompt_index
    or p_prompt_index<0 or p_prompt_index>9
    or current_run.mission_tags[p_prompt_index+1] is distinct from p_prompt_tag
 then raise exception 'Run out of sync'; end if;
 if p_points not in (0,10,25,45,65,85,100)
    or p_verdict not in ('bank','ai','timeout','pass','invalid')
    or (p_correct is distinct from (p_points>0))
 then raise exception 'Invalid answer result'; end if;
 insert into public.game_submissions
   (run_id,prompt_index,prompt_tag,answer_text,canonical_answer,points,verdict)
 values(p_run_id,p_prompt_index,p_prompt_tag,left(p_answer,70),p_canonical,p_points,p_verdict);
 new_progress:=p_prompt_index+1;
 updated_points:=current_run.total_score+p_points;
 reached:=public.voidrift_destination_for_score(updated_points);
 update public.game_runs set
   progress=new_progress,total_score=updated_points,destinations=reached,
   question_started_at=now()+interval '2.9 seconds',
   finished_at=case when new_progress=10 then now() else null end
 where id=p_run_id;
 return query select new_progress,updated_points,reached,(new_progress=10);
end;
$$;
revoke all on function public.voidrift_commit_answer(uuid,integer,text,text,text,integer,text,boolean)
from public,anon,authenticated;
grant execute on function public.voidrift_commit_answer(uuid,integer,text,text,text,integer,text,boolean)
to service_role;

-- Old daily runs retain all scores, while their world position is recalculated.
update public.game_runs
set destinations=public.voidrift_destination_for_score(total_score)
where destinations is distinct from public.voidrift_destination_for_score(total_score);
