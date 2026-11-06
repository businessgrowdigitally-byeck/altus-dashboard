/**
 * Plano do dia: um ajuste por data em cima da rotina fixa (`goalsDaily`).
 *
 * A rotina continua sendo a base; o plano de uma data só muda aquele dia:
 * ordem das ações, duração, ações adiadas (com destino e motivo) e blocos
 * extras. No dia seguinte vale a rotina de novo. Uma ação adiada de propósito
 * não conta como falta: sai do dia de origem e entra no dia de destino.
 */
import type { GoalDaily } from "./store";
// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { validateSchedule } from "./daily-schedule.ts";

export type DayPlanExtra = {
  id: string;
  title: string;
  minutes?: number;
  note?: string;
  done: boolean;
};
export type DayPlanPostpone = { actionId: string; to: string; reason?: string };
export type DayPlan = {
  /** Ordem dos itens do dia: ids de ações e de extras. Itens fora da lista vêm depois. */
  order: string[];
  /** Duração ajustada só neste dia (minutos), por ação. */
  durations: Record<string, number>;
  /** Observação do dia por ação (ex.: "versão mínima: revisar vocabulário"). */
  notes: Record<string, string>;
  /** Ações que SAEM deste dia e vão para outra data. */
  postponed: DayPlanPostpone[];
  extras: DayPlanExtra[];
  reason: string;
  source: "mentor" | "manual";
  updatedAt: string;
};
export type DayPlans = Record<string, DayPlan>;

type Action = Pick<GoalDaily, "id" | "daysOfWeek">;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** AAAA-MM-DD de uma data que existe no calendário (rejeita 2026-02-30). */
const isDate = (v: string) => DATE_RE.test(v) && toIso(parse(v)) === v;
export const addDays = (day: string, n: number) => {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return toIso(d);
};
const rid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const emptyDayPlan = (source: DayPlan["source"] = "manual"): DayPlan => ({
  order: [],
  durations: {},
  notes: {},
  postponed: [],
  extras: [],
  reason: "",
  source,
  updatedAt: new Date().toISOString(),
});

/** A ação foi tirada desta data por um adiamento? */
const postponedAway = (plans: DayPlans, actionId: string, date: string) =>
  (plans[date]?.postponed ?? []).some((p) => p.actionId === actionId);

/** Datas de onde a ação foi adiada PARA esta data. */
const broughtFrom = (plans: DayPlans, actionId: string, date: string): string | null => {
  for (const [from, plan] of Object.entries(plans))
    if (from !== date && plan.postponed.some((p) => p.actionId === actionId && p.to === date))
      return from;
  return null;
};

/** A ação está prevista nesta data (rotina − adiadas para fora + trazidas de outro dia)? */
export function plannedOn(action: Action, date: string, plans: DayPlans = {}): boolean {
  if (postponedAway(plans, action.id, date)) return false;
  if (action.daysOfWeek.includes(parse(date).getDay())) return true;
  return broughtFrom(plans, action.id, date) !== null;
}

export type DayItem<A extends GoalDaily = GoalDaily> =
  | { kind: "action"; key: string; action: A; minutes: number; note?: string; from?: string }
  | { kind: "extra"; key: string; extra: DayPlanExtra };

/** Itens do dia, na ordem do plano; sem plano, a ordem da rotina (horário). */
export function dayItems<A extends GoalDaily>(
  goalsDaily: A[],
  plans: DayPlans,
  date: string,
): DayItem<A>[] {
  const plan = plans[date];
  const actions: DayItem<A>[] = goalsDaily
    .filter((a) => plannedOn(a, date, plans))
    .map((a) => ({
      kind: "action" as const,
      key: a.id,
      action: a,
      minutes: plan?.durations[a.id] ?? a.durationMinutes ?? 30,
      note: plan?.notes[a.id],
      from: a.daysOfWeek.includes(parse(date).getDay())
        ? undefined
        : (broughtFrom(plans, a.id, date) ?? undefined),
    }));
  const extras: DayItem<A>[] = (plan?.extras ?? []).map((e) => ({
    kind: "extra" as const,
    key: e.id,
    extra: e,
  }));
  const base = [...actions].sort((x, y) => {
    const tx = x.kind === "action" ? (x.action.suggestedTime ?? "99:99") : "99:99";
    const ty = y.kind === "action" ? (y.action.suggestedTime ?? "99:99") : "99:99";
    return tx.localeCompare(ty);
  });
  const all = [...base, ...extras];
  const order = plan?.order ?? [];
  const pos = (k: string) => {
    const i = order.indexOf(k);
    return i === -1 ? order.length + all.findIndex((x) => x.key === k) : i;
  };
  return [...all].sort((a, b) => pos(a.key) - pos(b.key));
}

const touch = (plan: DayPlan, source: DayPlan["source"]): DayPlan => ({
  ...plan,
  source: plan.source === "mentor" && source === "manual" ? "mentor" : source,
  updatedAt: new Date().toISOString(),
});

/** Move um item uma posição para cima (-1) ou para baixo (+1) no dia. */
export function moveItem(
  plans: DayPlans,
  date: string,
  keys: string[],
  key: string,
  dir: -1 | 1,
): DayPlans {
  const i = keys.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= keys.length) return plans;
  const order = [...keys];
  [order[i], order[j]] = [order[j], order[i]];
  return { ...plans, [date]: touch({ ...(plans[date] ?? emptyDayPlan()), order }, "manual") };
}

/** Adia uma ação de `date` para `to` (sai de um dia, entra no outro). */
export function postponeAction(
  plans: DayPlans,
  date: string,
  actionId: string,
  to: string,
  reason = "",
  source: DayPlan["source"] = "manual",
): DayPlans {
  const plan = plans[date] ?? emptyDayPlan(source);
  const postponed = [
    ...plan.postponed.filter((p) => p.actionId !== actionId),
    { actionId, to, reason: reason || undefined },
  ];
  return {
    ...plans,
    [date]: touch({ ...plan, postponed, order: plan.order.filter((k) => k !== actionId) }, source),
  };
}

export function toggleExtra(plans: DayPlans, date: string, extraId: string): DayPlans {
  const plan = plans[date];
  if (!plan) return plans;
  return {
    ...plans,
    [date]: {
      ...plan,
      extras: plan.extras.map((e) => (e.id === extraId ? { ...e, done: !e.done } : e)),
    },
  };
}

/** Volta à rotina: apaga o plano desta data (ações trazidas de outros dias continuam). */
export function resetDay(plans: DayPlans, date: string): DayPlans {
  const { [date]: _removed, ...rest } = plans;
  return rest;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const minutes = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 600 ? n : undefined;
};

function cleanPlan(raw: unknown): DayPlan | null {
  const p = obj(raw);
  if (Object.keys(p).length === 0) return null;
  const durations: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(p.durations)).slice(0, 60)) {
    const m = minutes(v);
    if (m) durations[k.slice(0, 80)] = m;
  }
  const notes: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(p.notes)).slice(0, 60))
    if (str(v, 200)) notes[k.slice(0, 80)] = str(v, 200);
  return {
    order: (Array.isArray(p.order) ? p.order : [])
      .map((x) => str(x, 80))
      .filter(Boolean)
      .slice(0, 80),
    durations,
    notes,
    postponed: (Array.isArray(p.postponed) ? p.postponed : [])
      .map((x): DayPlanPostpone | null => {
        const e = obj(x);
        const actionId = str(e.actionId, 80);
        const to = str(e.to, 10);
        return actionId && isDate(to)
          ? { actionId, to, reason: str(e.reason, 200) || undefined }
          : null;
      })
      .filter((x): x is DayPlanPostpone => x !== null)
      .slice(0, 40),
    extras: (Array.isArray(p.extras) ? p.extras : [])
      .map((x): DayPlanExtra | null => {
        const e = obj(x);
        const title = str(e.title, 160);
        return title
          ? {
              id: str(e.id, 80) || rid(),
              title,
              minutes: minutes(e.minutes),
              note: str(e.note, 200) || undefined,
              done: e.done === true,
            }
          : null;
      })
      .filter((x): x is DayPlanExtra => x !== null)
      .slice(0, 20),
    reason: str(p.reason, 300),
    source: p.source === "mentor" ? "mentor" : "manual",
    updatedAt: str(p.updatedAt, 40) || new Date().toISOString(),
  };
}

/** Valida o que veio da nuvem/importação; guarda de 35 dias atrás a 14 dias à frente. */
export function normalizeDayPlans(raw: unknown, today: string): DayPlans {
  const out: DayPlans = {};
  const min = addDays(today, -35);
  const max = addDays(today, 14);
  for (const [date, plan] of Object.entries(obj(raw))) {
    if (!isDate(date) || date < min || date > max) continue;
    const clean = cleanPlan(plan);
    if (clean) out[date] = clean;
  }
  return out;
}

export type DayPlanApplyResult = {
  plans: DayPlans;
  date: string;
  /** Itens do dia como ficarão, para a prévia do cartão. */
  items: DayItem[];
  postponed: { action: GoalDaily; to: string; reason?: string }[];
  reason: string;
};

/**
 * Aplica (ou pré-visualiza) a proposta `dayPlan` do Mentor para hoje. Ignora
 * ids de ações que não existem, durações fora de 1–600 min e adiamentos para
 * datas no passado ou a mais de 14 dias.
 */
export function applyDayPlanProposal(
  plans: DayPlans,
  goalsDaily: GoalDaily[],
  raw: unknown,
  today: string,
  /** Data do plano (padrão: hoje). O plano da semana usa hoje … hoje+6. */
  date: string = today,
): DayPlanApplyResult {
  const p = obj(raw);
  const ids = new Set(goalsDaily.map((a) => a.id));
  const reason = str(p.reason, 300);
  const durations: Record<string, number> = {};
  const notes: Record<string, string> = {};
  for (const x of Array.isArray(p.adjust) ? p.adjust : []) {
    const e = obj(x);
    const id = str(e.actionId, 80);
    if (!ids.has(id)) continue;
    const m = minutes(e.durationMinutes);
    if (m) durations[id] = m;
    if (str(e.note, 200)) notes[id] = str(e.note, 200);
  }
  const postponed: DayPlanPostpone[] = [];
  for (const x of Array.isArray(p.postpone) ? p.postpone : []) {
    const e = obj(x);
    const id = str(e.actionId, 80);
    const to = str(e.to, 10);
    if (!ids.has(id) || !isDate(to) || to <= date || to > addDays(date, 14)) continue;
    postponed.push({ actionId: id, to, reason: str(e.reason, 200) || undefined });
  }
  const extras: DayPlanExtra[] = (Array.isArray(p.extras) ? p.extras : [])
    .map((x): DayPlanExtra | null => {
      const e = obj(x);
      const title = str(e.title, 160);
      return title
        ? {
            id: `extra-${rid()}`,
            title,
            minutes: minutes(e.minutes),
            note: str(e.note, 200) || undefined,
            done: false,
          }
        : null;
    })
    .filter((x): x is DayPlanExtra => x !== null)
    .slice(0, 10);
  // Ordem: ids de ações conhecidas + "extra:N" (posição do extra na lista da proposta).
  const order = (Array.isArray(p.order) ? p.order : [])
    .map((x) => {
      const k = str(x, 80);
      const m = /^extra:(\d+)$/.exec(k);
      if (m) return extras[Number(m[1])]?.id ?? "";
      return ids.has(k) ? k : "";
    })
    .filter(Boolean);
  const plan: DayPlan = {
    order,
    durations,
    notes,
    postponed,
    extras,
    reason,
    source: "mentor",
    updatedAt: new Date().toISOString(),
  };
  const next = { ...plans, [date]: plan };
  return {
    plans: next,
    date,
    items: dayItems(goalsDaily, next, date),
    postponed: postponed.map((x) => ({
      action: goalsDaily.find((a) => a.id === x.actionId)!,
      to: x.to,
      reason: x.reason,
    })),
    reason,
  };
}

/** Próxima data (hoje incluído) que cai no dia da semana `dow` (0 = domingo). */
export function weekdayDate(today: string, dow: number): string {
  const diff = (dow - parse(today).getDay() + 7) % 7;
  return addDays(today, diff);
}

export const WEEK_PLAN_DAYS = 7;

export type WeekPlanApplyResult = { plans: DayPlans; days: DayPlanApplyResult[] };

/**
 * Plano da semana: vários planos do dia de uma vez (hoje … hoje+6). Datas
 * fora da janela ou repetidas são ignoradas. A prévia de cada dia já leva em
 * conta os adiamentos entre os dias da própria proposta.
 */
export function applyWeekPlanProposal(
  plans: DayPlans,
  goalsDaily: GoalDaily[],
  rawDays: unknown,
  today: string,
  /** Motivo geral do plano da semana, usado nos dias sem motivo próprio. */
  reason = "",
): WeekPlanApplyResult {
  const last = addDays(today, WEEK_PLAN_DAYS - 1);
  const seen = new Set<string>();
  const valid = (Array.isArray(rawDays) ? rawDays : [])
    .map((d) => obj(d))
    .filter((d) => {
      const date = str(d.date, 10);
      if (!isDate(date) || date < today || date > last || seen.has(date)) return false;
      seen.add(date);
      return true;
    })
    .sort((a, b) => str(a.date, 10).localeCompare(str(b.date, 10)));
  let next = plans;
  const applied: DayPlanApplyResult[] = [];
  for (const d of valid) {
    const r = applyDayPlanProposal(
      next,
      goalsDaily,
      { ...d, reason: str(d.reason, 300) || reason },
      today,
      str(d.date, 10),
    );
    next = r.plans;
    applied.push(r);
  }
  return {
    plans: next,
    days: applied.map((r) => ({ ...r, items: dayItems(goalsDaily, next, r.date) })),
  };
}

export type RoutinePatch = Partial<
  Pick<GoalDaily, "durationMinutes" | "suggestedTime" | "daysOfWeek">
>;
export type RoutineChange = { action: GoalDaily; patch: RoutinePatch; reason?: string };

/**
 * Mudanças na ROTINA FIXA propostas pelo Mentor (ex.: um ajuste que se repete).
 * Só ações existentes; duração 5–600 min; horário HH:MM (vazio = sem horário);
 * dias 0–6 sem repetição e ao menos um. Mudanças que não mudam nada são ignoradas.
 */
export function cleanRoutineChanges(goalsDaily: GoalDaily[], raw: unknown): RoutineChange[] {
  const out: RoutineChange[] = [];
  for (const x of (Array.isArray(raw) ? raw : []).slice(0, 20)) {
    const e = obj(x);
    const action = goalsDaily.find((a) => a.id === str(e.actionId, 80));
    if (!action || out.some((c) => c.action.id === action.id)) continue;
    const patch: RoutinePatch = {};
    // A rotina usa passos de 5 min (ver validDuration): arredonda.
    const n = Number(e.durationMinutes);
    if ("durationMinutes" in e && Number.isFinite(n) && n >= 1 && n <= 600)
      patch.durationMinutes = Math.max(5, Math.round(n / 5) * 5);
    if ("suggestedTime" in e) {
      const t = str(e.suggestedTime, 5);
      if (t === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) patch.suggestedTime = t;
    }
    if (Array.isArray(e.daysOfWeek)) {
      const days = [
        ...new Set(e.daysOfWeek.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
      ].sort();
      if (days.length) patch.daysOfWeek = days;
    }
    const merged = { ...action, ...patch };
    if (!validateSchedule(merged.suggestedTime || undefined, merged.durationMinutes ?? 30))
      continue;
    const current: RoutinePatch = {
      durationMinutes: action.durationMinutes ?? 30,
      suggestedTime: action.suggestedTime ?? "",
      daysOfWeek: [...action.daysOfWeek].sort(),
    };
    const changed = (Object.keys(patch) as (keyof RoutinePatch)[]).some(
      (k) => JSON.stringify(patch[k]) !== JSON.stringify(current[k]),
    );
    if (changed) out.push({ action, patch, reason: str(e.reason, 200) || undefined });
  }
  return out;
}

/**
 * "Manter na rotina": as durações ajustadas no plano de `date` viram a duração
 * fixa das ações, e saem do plano (que segue com ordem, notas e extras).
 */
export function keepDayDurations(
  plans: DayPlans,
  goalsDaily: GoalDaily[],
  date: string,
): { plans: DayPlans; changes: RoutineChange[] } {
  const plan = plans[date];
  if (!plan) return { plans, changes: [] };
  const changes = cleanRoutineChanges(
    goalsDaily,
    Object.entries(plan.durations).map(([actionId, durationMinutes]) => ({
      actionId,
      durationMinutes,
    })),
  );
  // Só saem do plano as durações que viraram rotina (ou já eram a da rotina);
  // as que a rotina não aceita (ex.: passariam da meia-noite) continuam no dia.
  const durations: Record<string, number> = {};
  for (const [id, min] of Object.entries(plan.durations)) {
    const action = goalsDaily.find((a) => a.id === id);
    const kept = changes.some((c) => c.action.id === id);
    if (!kept && action && min !== (action.durationMinutes ?? 30)) durations[id] = min;
  }
  return { plans: { ...plans, [date]: { ...plan, durations } }, changes };
}

/** Aplica mudanças já validadas à rotina (horário vazio = sem horário). */
export function applyRoutineChanges(
  goalsDaily: GoalDaily[],
  changes: RoutineChange[],
): GoalDaily[] {
  return goalsDaily.map((a) => {
    const c = changes.find((x) => x.action.id === a.id);
    if (!c) return a;
    const next: GoalDaily = { ...a, ...c.patch };
    if (c.patch.suggestedTime === "") delete next.suggestedTime;
    return next;
  });
}
