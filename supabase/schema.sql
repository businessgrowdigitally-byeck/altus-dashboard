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
