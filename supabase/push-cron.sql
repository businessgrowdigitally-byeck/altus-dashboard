-- ============================================================================
-- ALTUS — agendamento do lembrete da manhã (todo dia às 7h30, São Paulo)
--
-- Antes de rodar:
--   1. Rode supabase/push.sql.
--   2. No painel do Supabase: Database → Extensions → habilite "pg_cron" e
--      "pg_net" (um clique em cada).
--   3. Troque abaixo:
--        COLE-AQUI-O-CRON_SECRET  → o mesmo valor da variável CRON_SECRET na Vercel
--        SEU-DOMINIO              → seu domínio, sem https:// e sem barra no fim
--   4. Cole no SQL Editor e clique em "Run".
--
-- O horário fica em UTC: 10:30 UTC = 7:30 em São Paulo (o Brasil não tem
-- horário de verão). Pode rodar de novo para trocar a senha ou o domínio.
-- ============================================================================

-- A senha fica no Vault (cofre criptografado do Supabase), não em texto aberto
-- na definição do agendamento.
do $$
declare
  existing uuid;
begin
  select id into existing from vault.secrets where name = 'altus_cron_secret';
  if existing is null then
    perform vault.create_secret(
      'COLE-AQUI-O-CRON_SECRET',
      'altus_cron_secret',
      'ALTUS: senha da rotina de envio do lembrete da manhã'
    );
  else
    perform vault.update_secret(existing, 'COLE-AQUI-O-CRON_SECRET');
  end if;
end $$;

-- Agenda (ou atualiza, se já existir com este nome) a chamada diária.
select cron.schedule(
  'altus-lembrete-manha',
  '30 10 * * *',
  $$
  select net.http_post(
    url := 'https://SEU-DOMINIO/api/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'altus_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- ----------------------------------------------------------------------------
-- Úteis (rode só quando precisar):
--
-- Ver se rodou:            select * from cron.job_run_details order by start_time desc limit 5;
-- Ver a resposta do envio: select status_code, content from net._http_response order by created desc limit 5;
-- Parar o lembrete:        select cron.unschedule('altus-lembrete-manha');
-- ----------------------------------------------------------------------------
