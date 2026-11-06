/**
 * Estatísticas de uma ação diária para a Home, calculadas a partir de
 * `goalsDaily` e `completions` (sem alterar o store).
 */
import type { DailyCompletion, GoalDaily } from "./store";
// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { plannedOn, type DayPlans } from "./day-plan.ts";

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (day: string, n: number) => {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return iso(d);
};

type Action = Pick<GoalDaily, "id" | "daysOfWeek">;

const doneSet = (action: Action, completions: DailyCompletion[]) =>
  new Set(completions.filter((c) => c.actionId === action.id).map((c) => c.date));

/**
 * Semana = hoje e os 6 dias anteriores. `scheduled` conta os dias em que a
 * ação estava prevista nessa janela; `done`, os desses dias que foram cumpridos.
 * Com `plans`, uma ação adiada de propósito sai do dia de origem (não é falta)
 * e entra no dia de destino.
 */
export function weekProgress(
  action: Action,
  completions: DailyCompletion[],
  today: string,
  plans: DayPlans = {},
) {
  const done = doneSet(action, completions);
  let scheduled = 0;
  let hits = 0;
  for (let i = 0; i < 7; i++) {
    const day = shift(today, -i);
    if (!plannedOn(action, day, plans)) continue;
    scheduled++;
    if (done.has(day)) hits++;
  }
  return { done: hits, scheduled };
}

/**
 * Sequência: dias AGENDADOS seguidos cumpridos, de trás para frente. Hoje
 * ainda não cumprido não zera (o dia não acabou): a contagem começa ontem.
 * Para no primeiro dia agendado não cumprido. Até 365 dias. Dias de onde a ação
 * foi adiada de propósito são pulados (não quebram a sequência).
 */
export function actionStreak(
  action: Action,
  completions: DailyCompletion[],
  today: string,
  plans: DayPlans = {},
): number {
  if (action.daysOfWeek.length === 0 && Object.keys(plans).length === 0) return 0;
  const done = doneSet(action, completions);
  let streak = 0;
  for (let i = done.has(today) ? 0 : 1; i < 366; i++) {
    const day = shift(today, -i);
    if (!plannedOn(action, day, plans)) continue;
    if (!done.has(day)) break;
    streak++;
  }
  return streak;
}
