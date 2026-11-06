/**
 * Envio do lembrete da manhã (servidor). A lógica de entrega recebe as
 * dependências (enviar, apagar), para ser testada sem serviço de push real.
 */
// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { buildMorningPush, normalizePushLang, type MorningPush } from "./push-message.ts";

export type StoredSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: string;
};
export type SendResult = { ok: true } | { ok: false; gone: boolean; status?: number };
export type PushDeps = {
  send: (sub: StoredSubscription, payload: string) => Promise<SendResult>;
  remove: (ids: string[]) => Promise<void>;
};
export type DeliveryReport = { sent: number; skipped: number; removed: number; failed: number };

const BATCH = 10;

/** Envia para cada inscrição a mensagem dela (null = não envia) e apaga as expiradas (404/410). */
export async function deliver(
  subs: StoredSubscription[],
  messageFor: (sub: StoredSubscription) => MorningPush | null,
  deps: PushDeps,
): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, skipped: 0, removed: 0, failed: 0 };
  const gone: string[] = [];
  for (let i = 0; i < subs.length; i += BATCH) {
    await Promise.all(
      subs.slice(i, i + BATCH).map(async (sub) => {
        const msg = messageFor(sub);
        if (!msg) {
          report.skipped++;
          return;
        }
        let r: SendResult;
        try {
          r = await deps.send(sub, JSON.stringify(msg));
        } catch {
          r = { ok: false, gone: false };
        }
        if (r.ok) report.sent++;
        else if (r.gone) gone.push(sub.id);
        else report.failed++;
      }),
    );
  }
  if (gone.length) {
    await deps.remove(gone);
    report.removed = gone.length;
  }
  return report;
}

/** O lembrete das 7h30: a mensagem de cada pessoa vem dos dados dela (`user_data.data`). */
export function morningMessages(dataByUser: Map<string, unknown>, today: string) {
  return (sub: StoredSubscription) =>
    dataByUser.has(sub.user_id)
      ? buildMorningPush(dataByUser.get(sub.user_id), today, normalizePushLang(sub.lang))
      : null;
}

export type PushEnv = {
  publicKey: string;
  privateKey: string;
  subject: string;
  serviceRoleKey: string;
  cronSecret: string;
};

/** Lê as variáveis de ambiente do lembrete; `missing` lista as que faltam. */
export function pushEnv(env: Record<string, string | undefined>): PushEnv & { missing: string[] } {
  const v = {
    publicKey: env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "",
    privateKey: env.VAPID_PRIVATE_KEY?.trim() ?? "",
    subject: env.VAPID_SUBJECT?.trim() ?? "",
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
    cronSecret: env.CRON_SECRET?.trim() ?? "",
  };
  const names: Record<keyof PushEnv, string> = {
    publicKey: "VITE_VAPID_PUBLIC_KEY",
    privateKey: "VAPID_PRIVATE_KEY",
    subject: "VAPID_SUBJECT",
    serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
    cronSecret: "CRON_SECRET",
  };
  return {
    ...v,
    missing: (Object.keys(names) as (keyof PushEnv)[]).filter((k) => !v[k]).map((k) => names[k]),
  };
}

/** Compara a senha em tempo constante (não revela quantos caracteres batem). */
export function sameSecret(given: string, expected: string): boolean {
  if (!expected) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}
