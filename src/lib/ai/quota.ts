/**
 * Limite de uso do Mentor (/api/chat). A contagem fica no Supabase
 * (`public.consume_chat_quota`, ver supabase/schema.sql); aqui ficam os limites
 * e a interpretação da resposta, testáveis sem banco.
 */

export const DEFAULT_DAILY_LIMIT = 60;
export const DEFAULT_MINUTE_LIMIT = 8;

const positiveInt = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Limites do servidor (variáveis CHAT_DAILY_LIMIT e CHAT_MINUTE_LIMIT, opcionais). */
export function quotaLimits(env: Record<string, string | undefined>) {
  return {
    daily: positiveInt(env.CHAT_DAILY_LIMIT, DEFAULT_DAILY_LIMIT),
    minute: positiveInt(env.CHAT_MINUTE_LIMIT, DEFAULT_MINUTE_LIMIT),
  };
}

export type QuotaDecision =
  | { kind: "allowed" }
  /** A função ainda não existe no banco (SQL não aplicado): o chat segue sem limite. */
  | { kind: "not-installed" }
  | { kind: "blocked"; status: 429; message: string }
  | { kind: "error"; status: 500; message: string };

type RpcError = { code?: string; message?: string } | null;

export function quotaDecision(data: unknown, error: RpcError): QuotaDecision {
  if (error) {
    // PostgREST: função inexistente (PGRST202) ou "undefined_function" do Postgres (42883).
    if (error.code === "PGRST202" || error.code === "42883") return { kind: "not-installed" };
    return {
      kind: "error",
      status: 500,
      message: "Não foi possível verificar seu limite de uso agora. Tente novamente.",
    };
  }
  const r = (data && typeof data === "object" ? data : {}) as {
    allowed?: unknown;
    reason?: unknown;
    limit?: unknown;
  };
  if (r.allowed === true) return { kind: "allowed" };
  if (r.reason === "minute")
    return {
      kind: "blocked",
      status: 429,
      message: "Muitas mensagens seguidas. Aguarde um minuto e tente de novo.",
    };
  const limit = typeof r.limit === "number" ? r.limit : null;
  return {
    kind: "blocked",
    status: 429,
    message: `Você atingiu o limite${limit ? ` de ${limit} mensagens` : ""} do Mentor por hoje. Ele volta à meia-noite (horário de Brasília).`,
  };
}
