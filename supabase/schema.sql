-- ============================================================================
-- ALTUS — estrutura do banco de dados
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem problema: tudo é idempotente.
-- ============================================================================

-- Uma linha por usuário. Todo o estado do app vive na coluna `data` (JSON).
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security: cada pessoa só enxerga e altera a própria linha.
-- Sem isso, a chave pública do app daria acesso aos dados de todo mundo.
-- ----------------------------------------------------------------------------
alter table public.user_data enable row level security;

drop policy if exists user_data_select_own on public.user_data;
create policy user_data_select_own on public.user_data
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_data_insert_own on public.user_data;
create policy user_data_insert_own on public.user_data
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists user_data_update_own on public.user_data;
create policy user_data_update_own on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_data_delete_own on public.user_data;
create policy user_data_delete_own on public.user_data
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- Mantém `updated_at` correto mesmo que o app esqueça de enviar.
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_data_touch_updated_at on public.user_data;
create trigger user_data_touch_updated_at
  before update on public.user_data
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Limite de uso do Mentor ALTUS (/api/chat)
-- Conta as mensagens de cada pessoa por dia e por minuto. O usuário só pode
-- LER a própria linha; quem grava é a função abaixo, que usa auth.uid() — então
-- ninguém consegue zerar o próprio contador pela chave pública do app.
-- ============================================================================
create table if not exists public.chat_usage (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  day          date        not null,
  day_count    integer     not null default 0,
  window_start timestamptz not null default now(),
  window_count integer     not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.chat_usage enable row level security;

drop policy if exists chat_usage_select_own on public.chat_usage;
create policy chat_usage_select_own on public.chat_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- Sem políticas de insert/update/delete: só a função grava.

-- Registra uma mensagem e diz se ela cabe nos limites. O dia vira à meia-noite
-- de Brasília. Os limites vêm do servidor; chamar a função direto com limites
-- maiores só aumenta o próprio contador, nunca o reduz.
create or replace function public.consume_chat_quota(p_daily_limit integer, p_minute_limit integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.chat_usage;
  daily integer := greatest(1, coalesce(p_daily_limit, 1));
  per_minute integer := greatest(1, coalesce(p_minute_limit, 1));
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.chat_usage (user_id, day) values (uid, today)
  on conflict (user_id) do nothing;

  select * into r from public.chat_usage where user_id = uid for update;

  if r.day <> today then
    r.day := today;
    r.day_count := 0;
  end if;
  if r.window_start < now() - interval '1 minute' then
    r.window_start := now();
    r.window_count := 0;
  end if;

  if r.day_count >= daily then
    update public.chat_usage
      set day = r.day, day_count = r.day_count, window_start = r.window_start,
          window_count = r.window_count, updated_at = now()
      where user_id = uid;
    return json_build_object('allowed', false, 'reason', 'daily', 'used', r.day_count, 'limit', daily);
  end if;
  if r.window_count >= per_minute then
    update public.chat_usage
      set day = r.day, day_count = r.day_count, window_start = r.window_start,
          window_count = r.window_count, updated_at = now()
      where user_id = uid;
    return json_build_object('allowed', false, 'reason', 'minute', 'used', r.day_count, 'limit', daily);
  end if;

  update public.chat_usage
    set day = r.day, day_count = r.day_count + 1, window_start = r.window_start,
        window_count = r.window_count + 1, updated_at = now()
    where user_id = uid;
  return json_build_object('allowed', true, 'used', r.day_count + 1, 'limit', daily);
end;
$$;

revoke all on function public.consume_chat_quota(integer, integer) from public, anon;
grant execute on function public.consume_chat_quota(integer, integer) to authenticated;
