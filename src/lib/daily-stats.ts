/**
 * Estatísticas de uma ação diária para a Home, calculadas a partir de
 * `goalsDaily` e `completions` (sem alterar o store).
 */
import type { DailyCompletion, GoalDaily } from "./store";

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
 * Semana = hoje e os 6 dias anteriores. `scheduled` conta os dias da ação
 * (daysOfWeek) nessa janela; `done`, os desses dias que foram cumpridos.
 */
export function weekProgress(action: Action, completions: DailyCompletion[], today: string) {
  const done = doneSet(action, completions);
  let scheduled = 0;
  let hits = 0;
  for (let i = 0; i < 7; i++) {
    const day = shift(today, -i);
    if (!action.daysOfWeek.includes(parse(day).getDay())) continue;
    scheduled++;
    if (done.has(day)) hits++;
  }
  return { done: hits, scheduled };
}

/**
 * Sequência: dias AGENDADOS seguidos cumpridos, de trás para frente. Hoje
 * ainda não cumprido não zera (o dia não acabou): a contagem começa ontem.
 * Para no primeiro dia agendado não cumprido. Até 365 dias.
 */
export function actionStreak(
  action: Action,
  completions: DailyCompletion[],
  today: string,
): number {
  if (action.daysOfWeek.length === 0) return 0;
  const done = doneSet(action, completions);
  let streak = 0;
  for (let i = done.has(today) ? 0 : 1; i < 366; i++) {
    const day = shift(today, -i);
    if (!action.daysOfWeek.includes(parse(day).getDay())) continue;
    if (!done.has(day)) break;
    streak++;
  }
  return streak;
}
