-- Public usernames are created through the server only. This table holds
-- hashed network identifiers for basic account-creation rate limits.
create table if not exists public.voidrift_signup_attempts (
  id bigint generated always as identity primary key,
  client_hash text not null check (length(client_hash)=64),
  created_at timestamptz not null default now()
);
create index if not exists voidrift_signup_attempts_lookup
  on public.voidrift_signup_attempts(client_hash,created_at desc);
alter table public.voidrift_signup_attempts enable row level security;
revoke all on public.voidrift_signup_attempts from anon,authenticated;
create or replace function public.voidrift_allow_signup(p_hash text)
returns boolean
language plpgsql
security invoker
set search_path=''
as $$
begin
  if p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_hash));
  if (select count(*) from public.voidrift_signup_attempts
      where client_hash=p_hash and created_at>now()-interval '1 hour')>=8 then
    return false;
  end if;
  insert into public.voidrift_signup_attempts(client_hash) values(p_hash);
  return true;
end;
$$;
revoke all on function public.voidrift_allow_signup(text) from public,anon,authenticated;
grant execute on function public.voidrift_allow_signup(text) to service_role;
