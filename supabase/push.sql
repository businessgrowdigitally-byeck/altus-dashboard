-- ============================================================================
-- ALTUS — lembrete da manhã (notificações push)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez: tudo é idempotente. Não altera nenhuma tabela
-- que já existe.
-- ============================================================================

-- Uma linha por aparelho inscrito (o mesmo aparelho pode ter uma linha por
-- conta). `endpoint`, `p256dh` e `auth` são os dados que o navegador entrega
-- para receber push; não dão acesso a mais nada.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) <= 200),
  auth       text not null check (length(auth) <= 100),
  lang       text not null default 'pt' check (lang in ('pt', 'en', 'es')),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- ----------------------------------------------------------------------------
-- Row Level Security: cada pessoa só vê, cria e apaga os PRÓPRIOS aparelhos.
-- (Sem política de update: para trocar algo, o app apaga e cria de novo.)
-- O envio das 7h30 roda no servidor com a chave service_role, que ignora RLS.
-- ----------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);
