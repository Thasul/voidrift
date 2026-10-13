-- VOIDRIFT social crews, progress and cosmetic choices. No client direct table access.
create table if not exists public.voidrift_crews (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 3 and 28),
 invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.voidrift_crew_members (
 crew_id uuid not null references public.voidrift_crews(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(crew_id,user_id),unique(user_id)
);
create index if not exists voidrift_crew_members_crewid on public.voidrift_crew_members(crew_id);
create table if not exists public.voidrift_customization (
 user_id uuid primary key references auth.users(id) on delete cascade,
 ship text not null default 'scout',
 trail text not null default 'cyan',
 updated_at timestamptz not null default now()
);
alter table public.voidrift_crews enable row level security;
alter table public.voidrift_crew_members enable row level security;
alter table public.voidrift_customization enable row level security;
revoke all on public.voidrift_crews,public.voidrift_crew_members,public.voidrift_customization from anon,authenticated;
