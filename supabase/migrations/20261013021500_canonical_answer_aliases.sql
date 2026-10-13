create table if not exists public.game_answer_aliases (
 prompt_tag text not null,
 alias text not null,
 canonical text not null,
 primary key(prompt_tag,alias)
);
alter table public.game_answer_aliases enable row level security;
revoke all on public.game_answer_aliases from anon,authenticated;
-- Alias maps are editorial. They deliberately resolve to the existing normalized answer
-- so all aliases contribute to the same player-based rarity statistics.
with variants(tag,short,longname) as (
 values
 ('geography2','al','alabama'),('geography2','ak','alaska'),('geography2','az','arizona'),
 ('geography2','ar','arkansas'),('geography2','ca','california'),('geography2','co','colorado'),
 ('geography2','ct','connecticut'),('geography2','de','delaware'),('geography2','fl','florida'),
 ('geography2','ga','georgia'),('geography2','hi','hawaii'),('geography2','id','idaho'),
 ('geography2','il','illinois'),('geography2','in','indiana'),('geography2','ia','iowa'),
 ('geography2','ks','kansas'),('geography2','ky','kentucky'),('geography2','la','louisiana'),
 ('geography2','me','maine'),('geography2','md','maryland'),('geography2','ma','massachusetts'),
 ('geography2','mi','michigan'),('geography2','mn','minnesota'),('geography2','ms','mississippi'),
 ('geography2','mo','missouri'),('geography2','mt','montana'),('geography2','ne','nebraska'),
 ('geography2','nv','nevada'),('geography2','nh','new hampshire'),('geography2','nj','new jersey'),
 ('geography2','nm','new mexico'),('geography2','ny','new york'),('geography2','nc','north carolina'),
 ('geography2','nd','north dakota'),('geography2','oh','ohio'),('geography2','ok','oklahoma'),
 ('geography2','or','oregon'),('geography2','pa','pennsylvania'),('geography2','ri','rhode island'),
 ('geography2','sc','south carolina'),('geography2','sd','south dakota'),('geography2','tn','tennessee'),
 ('geography2','tx','texas'),('geography2','ut','utah'),('geography2','vt','vermont'),
 ('geography2','va','virginia'),('geography2','wa','washington'),('geography2','wv','west virginia'),
 ('geography2','wi','wisconsin'),('geography2','wy','wyoming'),
 ('geography','uk','united kingdom'),('geography','great britain','united kingdom'),
 ('gaming','cod','call of duty'),('gaming','gta','grand theft auto'),
 ('gaming','ff','final fantasy'),('gaming','the legend of zelda','legend of zelda'),
 ('practice-games-12','final fantasy i','final fantasy 1'),
 ('practice-games-12','final fantasy ii','final fantasy 2'),
 ('practice-games-12','final fantasy iii','final fantasy 3'),
 ('practice-games-12','final fantasy iv','final fantasy 4'),
 ('practice-games-12','final fantasy v','final fantasy 5'),
 ('practice-games-12','final fantasy vi','final fantasy 6'),
 ('practice-games-12','final fantasy vii','final fantasy 7'),
 ('practice-games-12','final fantasy viii','final fantasy 8'),
 ('practice-games-12','final fantasy ix','final fantasy 9'),
 ('practice-games-12','final fantasy x','final fantasy 10'),
 ('practice-games-12','final fantasy xi','final fantasy 11'),
 ('practice-games-12','final fantasy xii','final fantasy 12'),
 ('practice-games-12','final fantasy xiii','final fantasy 13'),
 ('practice-games-12','final fantasy xiv','final fantasy 14'),
 ('practice-games-12','final fantasy xv','final fantasy 15'),
 ('practice-games-12','final fantasy xvi','final fantasy 16')
)
insert into public.game_answer_aliases(prompt_tag,alias,canonical)
select v.tag,v.short,v.longname
from variants v
join public.game_answers a on a.prompt_tag=v.tag and a.normalized=v.longname
on conflict(prompt_tag,alias) do update set canonical=excluded.canonical;
