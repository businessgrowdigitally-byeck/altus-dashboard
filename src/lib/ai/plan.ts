/**
 * Planejamento ALTUS (P.G. → Meta Macro → P.E. → Metas Micro) — modelo
 * persistido junto com o restante do estado do usuário (`user_data`).
 *
 * O Mentor nunca grava sozinho: ele PROPÕE um bloco ```altus-plan``` e o
 * usuário confirma no chat. Só então `applyPlanProposal` gera a nova versão.
 * Decisões, resultados e revisões são append-only (histórico preservado).
 */

export type PlanStatus = "pendente" | "ativa" | "concluida";

export type PlanSubaction = { id: string; title: string; done: boolean };
export type PlanAction = { id: string; title: string; done: boolean; subactions: PlanSubaction[] };
export type PlanStage = { id: string; title: string; status: PlanStatus; doneCriteria?: string; actions: PlanAction[] };
export type MicroGoal = {
  id: string;
  title: string;
  stageId?: string;
  doneCriteria?: string;
  estimateMinutes?: number;
  status: "pendente" | "concluida";
};
export type PlanLogEntry = { date: string; text: string };
export type PlanVersion = { version: number; date: string; summary: string };

export type AltusPlan = {
  id: string;
  /** Vínculo com a Meta Macro oficial do app (goalsMacro), quando existir. */
  macroGoalId: string | null;
  macroGoalName: string;
  generalPlanning: string;
  indicator: string;
  deadline: string;
  strategy: string;
  activeStageId: string | null;
  stages: PlanStage[];
  microGoals: MicroGoal[];
  decisions: PlanLogEntry[];
  /** Resultados reais observados — separados de tarefas concluídas. */
  results: PlanLogEntry[];
  reviews: PlanLogEntry[];
  parkedIdeas: PlanLogEntry[];
  nextReview: string;
  version: number;
  history: PlanVersion[];
  createdAt: string;
  updatedAt: string;
};

export const MAX_PLANS = 20;
const MAX_LIST = 60;
const MAX_TEXT = 1500;

const str = (v: unknown, max = MAX_TEXT): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const rid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v.slice(0, MAX_LIST) : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function cleanStatus(v: unknown): PlanStatus {
  return v === "ativa" || v === "concluida" ? v : "pendente";
}

function cleanStages(v: unknown): PlanStage[] {
  return arr(v)
    .map((raw) => {
      const s = obj(raw);
      const title = str(s.title, 200);
      if (!title) return null;
      return {
        id: str(s.id, 80) || rid(),
        title,
        status: cleanStatus(s.status),
        doneCriteria: str(s.doneCriteria, 300) || undefined,
        actions: arr(s.actions)
          .map((ra) => {
            const a = obj(ra);
            const at = str(a.title, 200);
            if (!at) return null;
            return {
              id: str(a.id, 80) || rid(),
              title: at,
              done: a.done === true,
              subactions: arr(a.subactions)
                .map((rs) => {
                  const sb = obj(rs);
                  const st = str(sb.title, 200);
                  return st ? { id: str(sb.id, 80) || rid(), title: st, done: sb.done === true } : null;
                })
                .filter((x): x is PlanSubaction => x !== null),
            };
          })
          .filter((x): x is PlanAction => x !== null),
      };
    })
    .filter((x): x is PlanStage => x !== null);
}

function cleanMicro(v: unknown): MicroGoal[] {
  return arr(v)
    .map((raw) => {
      const m = obj(raw);
      const title = str(m.title, 200);
      if (!title) return null;
      const est = Number(m.estimateMinutes);
      return {
        id: str(m.id, 80) || rid(),
        title,
        stageId: str(m.stageId, 80) || undefined,
        doneCriteria: str(m.doneCriteria, 300) || undefined,
        estimateMinutes: Number.isFinite(est) && est > 0 ? Math.min(Math.round(est), 1440) : undefined,
        status: m.status === "concluida" ? "concluida" : "pendente",
      } as MicroGoal;
    })
    .filter((x): x is MicroGoal => x !== null);
}

function cleanLog(v: unknown, today: string): PlanLogEntry[] {
  return arr(v)
    .map((raw) => {
      if (typeof raw === "string") return raw.trim() ? { date: today, text: str(raw) } : null;
      const e = obj(raw);
      const text = str(e.text);
      if (!text) return null;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(e.date, 10)) ? str(e.date, 10) : today;
      return { date, text };
    })
    .filter((x): x is PlanLogEntry => x !== null);
}

export type PlanProposal = Record<string, unknown>;

/** Extrai a última proposta ```altus-plan {json}``` de uma resposta do Mentor. */
export function parsePlanProposal(text: string): PlanProposal | null {
  const re = /```altus-plan\s*([\s\S]*?)```/g;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) last = m[1];
  if (!last) return null;
  try {
    const parsed = JSON.parse(last.trim());
    const p = obj(parsed);
    if (!str(p.macroGoalName) && !str(p.planId)) return null;
    return p;
  } catch {
    return null;
  }
}

/** Remove os blocos técnicos da resposta exibida ao usuário. */
export function stripPlanBlocks(text: string): string {
  return text.replace(/```altus-plan[\s\S]*?(```|$)/g, "").trim();
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Aplica uma proposta CONFIRMADA. Plano existente (planId) → nova versão com
 * campos substituídos e logs anexados; senão cria um plano v1.
 */
export function applyPlanProposal(
  plans: AltusPlan[],
  proposal: PlanProposal,
  today: string,
  validMacroIds: string[] = [],
): { plans: AltusPlan[]; plan: AltusPlan } {
  const p = obj(proposal);
  const now = new Date().toISOString();
  const summary = str(p.changeSummary, 300) || "Atualização do planejamento";
  const macroIdRaw = str(p.macroGoalId, 80);
  const macroGoalId = macroIdRaw && validMacroIds.includes(macroIdRaw) ? macroIdRaw : null;
  const existing = plans.find((x) => x.id === str(p.planId, 80));

  const stages = "stages" in p ? cleanStages(p.stages) : existing?.stages ?? [];
  const activeRaw = str(p.activeStageId, 80);
  const activeStageId =
    (activeRaw && stages.some((s) => s.id === activeRaw) ? activeRaw : null) ??
    stages.find((s) => s.status === "ativa")?.id ??
    (existing && stages.some((s) => s.id === existing.activeStageId) ? existing.activeStageId : null);

  const pick = (key: keyof AltusPlan, max?: number): string =>
    key in p ? str(p[key], max) : ((existing?.[key] as string | undefined) ?? "");

  const base: AltusPlan = {
    id: existing?.id ?? rid(),
    macroGoalId: macroGoalId ?? existing?.macroGoalId ?? null,
    macroGoalName: pick("macroGoalName", 200) || existing?.macroGoalName || "Meta sem nome",
    generalPlanning: pick("generalPlanning"),
    indicator: pick("indicator", 300),
    deadline: pick("deadline", 40),
    strategy: pick("strategy"),
    activeStageId,
    stages,
    microGoals: "microGoals" in p ? cleanMicro(p.microGoals) : existing?.microGoals ?? [],
    decisions: [...(existing?.decisions ?? []), ...cleanLog(p.decisions, today)].slice(-MAX_LIST),
    results: [...(existing?.results ?? []), ...cleanLog(p.results, today)].slice(-MAX_LIST),
    reviews: [...(existing?.reviews ?? []), ...cleanLog(p.reviews, today)].slice(-MAX_LIST),
    parkedIdeas: [...(existing?.parkedIdeas ?? []), ...cleanLog(p.parkedIdeas, today)].slice(-MAX_LIST),
    nextReview: /^\d{4}-\d{2}-\d{2}$/.test(str(p.nextReview, 10)) ? str(p.nextReview, 10) : addDays(today, 7),
    version: (existing?.version ?? 0) + 1,
    history: [...(existing?.history ?? []), { version: (existing?.version ?? 0) + 1, date: today, summary }].slice(-MAX_LIST),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const next = existing ? plans.map((x) => (x.id === existing.id ? base : x)) : [base, ...plans].slice(0, MAX_PLANS);
  return { plans: next, plan: base };
}
