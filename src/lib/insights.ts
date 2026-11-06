/**
 * Insights da semana calculados dos dados reais do usuário — os mesmos que o
 * GOAT lê no contexto (rotina + plano do dia, Kaizen, P.E., finanças, saúde,
 * leitura e estudos). Cada insight diz SOBRE O QUE é (ex.: "Gastos: …") e traz
 * os números, para nunca aparecer uma porcentagem solta.
 *
 * Função pura: devolve chaves de i18n + variáveis; a Home traduz e formata.
 */
import type { DailyCompletion, GoalDaily, KaizenEntry } from "./store";
import type { AltusPlan } from "./ai/plan";
// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { addDays, plannedOn, type DayPlans } from "./day-plan.ts";
import { actionStreak, weekProgress } from "./daily-stats.ts";
import { budgetLines, type CategoryBudgets } from "./finance.ts";

export type InsightTone = "good" | "warn" | "info";
export type Insight = {
  id: string;
  /** Chave de i18n (dashboard). */
  key: string;
  vars: Record<string, string | number>;
  tone: InsightTone;
};

export type InsightData = {
  transactions?: { type: "entrada" | "saida"; value: number; date: string; category: string }[];
  categoryBudgets?: CategoryBudgets;
  weights?: { weight: number; date: string }[];
  books?: { finishedAt: string }[];
  studies?: { date: string }[];
  goalsDaily?: GoalDaily[];
  completions?: DailyCompletion[];
  dayPlans?: DayPlans;
  kaizen?: Pick<KaizenEntry, "date" | "improveTomorrow">[];
  altusPlans?: Pick<AltusPlan, "macroGoalName" | "activeStageId" | "microGoals" | "nextReview">[];
};

export type InsightFormat = { money: (n: number) => string; kg: (n: number) => string };

export const MAX_INSIGHTS = 6;

/** "O que posso melhorar 1% amanhã?" mais recente, escrito ontem ou anteontem. */
export function kaizenForToday(
  kaizen: InsightData["kaizen"] = [],
  today: string,
): { date: string; text: string } | null {
  const from = addDays(today, -2);
  const k = kaizen
    .filter((e) => e.date < today && e.date >= from && e.improveTomorrow?.trim())
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return k ? { date: k.date, text: k.improveTomorrow.trim() } : null;
}

export function buildInsights(d: InsightData, today: string, fmt: InsightFormat): Insight[] {
  const out: Insight[] = [];
  const daily = d.goalsDaily ?? [];
  const completions = d.completions ?? [];
  const plans = d.dayPlans ?? {};

  // 1) Kaizen de ontem: o 1% que a pessoa prometeu para hoje.
  const k = kaizenForToday(d.kaizen, today);
  if (k) out.push({ id: "kaizen", key: "insight.kaizen", vars: { text: k.text }, tone: "info" });

  // 2) Rotina nos últimos 7 dias (plano do dia incluído: adiar não conta como falta).
  const doneOn = new Set(completions.map((c) => `${c.date}|${c.actionId}`));
  let planned = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(today, -i);
    for (const a of daily) {
      if (!plannedOn(a, day, plans)) continue;
      planned++;
      if (doneOn.has(`${day}|${a.id}`)) done++;
    }
  }
  if (planned > 0) {
    const pct = Math.round((done / planned) * 100);
    out.push({
      id: "routine",
      key: "insight.routineWeek",
      vars: { done, planned, pct },
      tone: pct >= 70 ? "good" : pct < 40 ? "warn" : "info",
    });
  }

  // 3) Melhor sequência e 4) ação que ficou para trás.
  const stats = daily.map((a) => ({
    a,
    streak: actionStreak(a, completions, today, plans),
    week: weekProgress(a, completions, today, plans),
  }));
  const best = [...stats].sort((x, y) => y.streak - x.streak)[0];
  if (best && best.streak >= 3)
    out.push({
      id: "streak",
      key: "insight.bestStreak",
      vars: { name: best.a.name, n: best.streak },
      tone: "good",
    });
  const lagging = stats
    .filter((s) => s.week.scheduled >= 3 && s.week.done / s.week.scheduled < 0.4)
    .sort((x, y) => x.week.done / x.week.scheduled - y.week.done / y.week.scheduled)[0];
  if (lagging)
    out.push({
      id: "lagging",
      key: "insight.lagging",
      vars: { name: lagging.a.name, done: lagging.week.done, scheduled: lagging.week.scheduled },
      tone: "warn",
    });

  // 5) P.E.: revisão vencida ou a próxima Meta Micro da etapa ativa.
  for (const p of d.altusPlans ?? []) {
    if (p.nextReview && p.nextReview <= today) {
      out.push({
        id: `review:${p.macroGoalName}`,
        key: "insight.reviewDue",
        vars: { macro: p.macroGoalName },
        tone: "warn",
      });
      break;
    }
  }
  const plan = (d.altusPlans ?? []).find((p) => p.microGoals.some((m) => m.status === "pendente"));
  if (plan) {
    const micro =
      plan.microGoals.find((m) => m.status === "pendente" && m.stageId === plan.activeStageId) ??
      plan.microGoals.find((m) => m.status === "pendente")!;
    out.push({
      id: "micro",
      key: "insight.nextMicro",
      vars: { title: micro.title, macro: plan.macroGoalName },
      tone: "info",
    });
  }

  // 6) Gastos: esta semana (7 dias até hoje) contra os 7 dias anteriores.
  const tx = d.transactions ?? [];
  const spent = (from: string, to: string) =>
    tx
      .filter((t) => t.type === "saida" && t.date >= from && t.date <= to)
      .reduce((s, t) => s + (Number(t.value) || 0), 0);
  const thisWeek = spent(addDays(today, -6), today);
  const prevWeek = spent(addDays(today, -13), addDays(today, -7));
  if (prevWeek > 0) {
    const diff = Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
    if (Math.abs(diff) >= 5)
      out.push({
        id: "expenses",
        key: diff < 0 ? "insight.expensesLess" : "insight.expensesMore",
        vars: { diff: Math.abs(diff), week: fmt.money(thisWeek), prev: fmt.money(prevWeek) },
        tone: diff < 0 ? "good" : "warn",
      });
  }

  // 7) Orçamento do mês estourado (a categoria mais acima do limite).
  const month = today.slice(0, 7);
  const byCat: Record<string, number> = {};
  for (const t of tx)
    if (t.type === "saida" && t.date.startsWith(month))
      byCat[t.category] = (byCat[t.category] ?? 0) + (Number(t.value) || 0);
  const over = budgetLines(byCat, d.categoryBudgets ?? {})
    .filter((l) => l.over)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  if (over && over.limit !== null)
    out.push({
      id: "budget",
      key: "insight.budgetOver",
      vars: { category: over.category, spent: fmt.money(over.spent), limit: fmt.money(over.limit) },
      tone: "warn",
    });

  // 8) Peso, leitura e estudos.
  const weights = [...(d.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (weights.length >= 2) {
    const diff = weights[weights.length - 1].weight - weights[0].weight;
    out.push(
      Math.abs(diff) < 0.3
        ? { id: "weight", key: "insight.weightStable", vars: {}, tone: "info" }
        : {
            id: "weight",
            key: diff > 0 ? "insight.weightUp" : "insight.weightDown",
            vars: { kg: fmt.kg(Math.abs(diff)) },
            tone: "info",
          },
    );
  }
  const year = today.slice(0, 4);
  const books = (d.books ?? []).filter((b) => b.finishedAt?.startsWith(year)).length;
  if (books > 0)
    out.push({
      id: "books",
      key: books === 1 ? "booksOne" : "booksMany",
      vars: { count: books, year },
      tone: "good",
    });
  const studyDays = new Set((d.studies ?? []).map((s) => s.date));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (studyDays.has(addDays(today, -i))) streak++;
    else if (i > 0) break;
  }
  if (streak > 0)
    out.push({
      id: "study",
      key: streak === 1 ? "streakOne" : "streakMany",
      vars: { n: streak },
      tone: "good",
    });

  return out.slice(0, MAX_INSIGHTS);
}
