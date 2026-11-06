/**
 * Notificações dentro do app (sino) e o cartão de "bom dia".
 *
 * Tudo é calculado dos dados do usuário na hora — nada é enviado para fora do
 * app. Só fica guardado o que a pessoa já leu (`notificationsSeen`, ids) e o
 * resumo da manhã do GOAT (`dailyBriefing`, 1 por dia), ambos sincronizados
 * entre aparelhos.
 */
import type { GoalDaily } from "./store";
import type { AltusPlan } from "./ai/plan";
// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { kaizenForToday, type InsightData } from "./insights.ts";
import { addDays, dayItems, type DayPlans } from "./day-plan.ts";
import { budgetLines, type CategoryBudgets } from "./finance.ts";

export type DailyBriefing = { date: string; text: string; lang: string };

export type AppNotification = {
  id: string;
  kind: "briefing" | "kaizen" | "kaizenMissing" | "arriving" | "review" | "budget";
  /** Chave de i18n (dashboard) e variáveis. */
  key: string;
  vars: Record<string, string | number>;
  /** Rota do app para abrir ao tocar. */
  to: "/" | "/kaizen" | "/planejamento" | "/financas";
};

export type NotificationData = Pick<InsightData, "kaizen" | "transactions"> & {
  goalsDaily?: GoalDaily[];
  dayPlans?: DayPlans;
  altusPlans?: Pick<AltusPlan, "id" | "macroGoalName" | "nextReview">[];
  categoryBudgets?: CategoryBudgets;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SEEN = 300;
export const BRIEFING_TEXT_MAX = 600;

/** Manhã: das 4h ao meio-dia (hora local). */
export const isMorning = (hour: number) => hour >= 4 && hour < 12;
export const morningId = (today: string) => `morning:${today}`;

export function normalizeBriefing(raw: unknown): DailyBriefing | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const date = typeof r.date === "string" ? r.date : "";
  const text = typeof r.text === "string" ? r.text.trim().slice(0, BRIEFING_TEXT_MAX) : "";
  const lang = r.lang === "en" || r.lang === "es" ? r.lang : "pt";
  return DATE_RE.test(date) && text ? { date, text, lang } : null;
}

/** Ids lidos: só textos curtos, sem repetição, os mais recentes primeiro (máx. 300). */
export function normalizeSeen(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw)
    if (typeof x === "string" && x && x.length <= 200 && !out.includes(x)) out.push(x);
  return out.slice(0, MAX_SEEN);
}

/** Marca ids como lidos (os novos entram no começo). */
export function markSeen(seen: string[], ids: string[]): string[] {
  return normalizeSeen([...ids, ...seen]);
}

export function buildNotifications(
  d: NotificationData,
  today: string,
  briefing: DailyBriefing | null,
): AppNotification[] {
  const out: AppNotification[] = [];
  if (briefing && briefing.date === today)
    out.push({
      id: `briefing:${today}`,
      kind: "briefing",
      key: "notif.briefing",
      vars: { text: briefing.text },
      to: "/",
    });

  const kaizen = d.kaizen ?? [];
  const k = kaizenForToday(kaizen, today);
  if (k)
    out.push({
      id: `kaizen:${today}`,
      kind: "kaizen",
      key: "notif.kaizen",
      vars: { text: k.text },
      to: "/kaizen",
    });
  // Quem já usa o Kaizen e não registrou ontem recebe um lembrete.
  const yesterday = addDays(today, -1);
  if (kaizen.length > 0 && !kaizen.some((e) => e.date === yesterday))
    out.push({
      id: `kaizen-missing:${today}`,
      kind: "kaizenMissing",
      key: "notif.kaizenMissing",
      vars: {},
      to: "/kaizen",
    });

  // Ações adiadas que chegam hoje.
  for (const item of dayItems(d.goalsDaily ?? [], d.dayPlans ?? {}, today))
    if (item.kind === "action" && item.from)
      out.push({
        id: `arriving:${today}:${item.action.id}`,
        kind: "arriving",
        key: "notif.arriving",
        vars: { name: item.action.name, from: item.from },
        to: "/",
      });

  for (const p of d.altusPlans ?? [])
    if (p.nextReview && p.nextReview <= today)
      out.push({
        id: `review:${today}:${p.id}`,
        kind: "review",
        key: "notif.review",
        vars: { macro: p.macroGoalName },
        to: "/planejamento",
      });

  // Orçamento estourado: um aviso por categoria por mês.
  const month = today.slice(0, 7);
  const byCat: Record<string, number> = {};
  for (const t of d.transactions ?? [])
    if (t.type === "saida" && t.date.startsWith(month))
      byCat[t.category] = (byCat[t.category] ?? 0) + (Number(t.value) || 0);
  for (const l of budgetLines(byCat, d.categoryBudgets ?? {}))
    if (l.over && l.limit !== null)
      out.push({
        id: `budget:${month}:${l.category}`,
        kind: "budget",
        key: "notif.budget",
        vars: { category: l.category },
        to: "/financas",
      });

  return out;
}

export const unreadCount = (list: AppNotification[], seen: string[]) =>
  list.filter((n) => !seen.includes(n.id)).length;
