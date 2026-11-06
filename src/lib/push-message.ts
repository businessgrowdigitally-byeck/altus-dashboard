/**
 * Texto do lembrete da manhã (notificação push), montado SÓ com os dados do
 * usuário — sem IA. Função pura: o servidor chama para cada pessoa inscrita.
 *
 * "Bom dia, Ana!" / "Seu 1% de hoje: <kaizen> · 5 ações hoje, comece por Inglês"
 * Sem ações e sem Kaizen de ontem → null (não envia nada).
 */
import type { GoalDaily } from "./store";
// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { dayItems, normalizeDayPlans } from "./day-plan.ts";
import { kaizenForToday } from "./insights.ts";
import { push } from "./i18n/dict/push.ts";

export type PushLang = "pt" | "en" | "es";
export type MorningPush = { title: string; body: string; url: string; tag: string };

const MAX_KAIZEN = 140;
const MAX_NAME = 60;

type Key = keyof typeof push;
export function pushText(key: Key, lang: PushLang, vars: Record<string, string | number> = {}) {
  let out: string = push[key][lang] ?? push[key].pt;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

export const normalizePushLang = (v: unknown): PushLang => (v === "en" || v === "es" ? v : "pt");

/** "Hoje" em São Paulo (AAAA-MM-DD), que é quando o lembrete é enviado. */
export function saoPauloDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);

/** Lê do JSON salvo (`user_data.data`) só o que o lembrete precisa, já validado. */
function readData(raw: unknown, today: string) {
  const d = obj(raw);
  const goalsDaily: GoalDaily[] = list(d.goalsDaily)
    .slice(0, 100)
    .map((a) => ({
      id: str(a.id, 80),
      name: str(a.name, 120),
      area: (str(a.area, 40) || "Geral") as GoalDaily["area"],
      daysOfWeek: Array.isArray(a.daysOfWeek)
        ? a.daysOfWeek.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6)
        : [],
      suggestedTime: str(a.suggestedTime, 5) || undefined,
      durationMinutes:
        typeof a.durationMinutes === "number" && Number.isFinite(a.durationMinutes)
          ? a.durationMinutes
          : undefined,
    }))
    .filter((a) => a.id && a.name);
  const completions = list(d.completions).map((c) => ({
    date: str(c.date, 10),
    actionId: str(c.actionId, 80),
  }));
  const kaizen = list(d.kaizen).map((k) => ({
    date: str(k.date, 10),
    improveTomorrow: str(k.improveTomorrow, 500),
  }));
  return {
    name: str(obj(d.profile).name, MAX_NAME),
    goalsDaily,
    completions,
    dayPlans: normalizeDayPlans(d.dayPlans, today),
    kaizen,
  };
}

export function buildMorningPush(raw: unknown, today: string, lang: PushLang): MorningPush | null {
  const d = readData(raw, today);
  // Ações de hoje como a Home mostra: rotina + plano do dia (adiadas saem, trazidas entram).
  const actions = dayItems(d.goalsDaily, d.dayPlans, today).flatMap((i) =>
    i.kind === "action" ? [i.action] : [],
  );
  const k = kaizenForToday(d.kaizen, today);
  if (actions.length === 0 && !k) return null;

  const parts: string[] = [];
  if (k) parts.push(pushText("push.kaizen", lang, { text: clip(k.text, MAX_KAIZEN) }));
  if (actions.length) {
    const done = new Set(d.completions.filter((c) => c.date === today).map((c) => c.actionId));
    const first = actions.find((a) => !done.has(a.id));
    parts.push(
      !first
        ? pushText("push.actionsDone", lang, { n: actions.length })
        : actions.length === 1
          ? pushText("push.actionsOne", lang, { name: first.name })
          : pushText("push.actions", lang, { n: actions.length, name: first.name }),
    );
  }
  return {
    title: d.name
      ? pushText("push.title", lang, { name: d.name })
      : pushText("push.titleNoName", lang),
    body: parts.join(" · "),
    url: "/",
    tag: `altus-lembrete-${today}`,
  };
}
