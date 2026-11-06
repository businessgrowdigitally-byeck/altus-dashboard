/**
 * Planejamento ALTUS (P.G. → Meta Macro → P.E. → Metas Micro) — modelo
 * persistido junto com o restante do estado do usuário (`user_data`).
 *
 * - P.G.: um único `altusGeneralPlan` por usuário, acima das Metas Macro.
 * - Meta Macro: a oficial do app (`goalsMacro`); cada plano aponta para uma.
 * - P.E. + Metas Micro: um `AltusPlan` por Meta Macro.
 * - Filtro ALTUS: `altusFilter`, decisões estruturadas sobre novas ideias.
 *
 * O Mentor nunca grava sozinho: ele PROPÕE um bloco ```altus-plan``` e o
 * usuário confirma no chat. Só então `applyAltusProposal` gera a nova versão.
 * Decisões, resultados e revisões são append-only (histórico preservado).
 */

export type PlanStatus = "pendente" | "ativa" | "concluida";

export type PlanSubaction = { id: string; title: string; done: boolean };
export type PlanAction = { id: string; title: string; done: boolean; subactions: PlanSubaction[] };
export type PlanStage = {
  id: string;
  title: string;
  status: PlanStatus;
  doneCriteria?: string;
  actions: PlanAction[];
};
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
  /**
   * Meta Macro oficial do app (goalsMacro). Obrigatório em planos novos;
   * planos antigos podem estar sem vínculo até a próxima revisão.
   */
  macroGoalId: string | null;
  /** Nome no momento da última versão — a fonte da verdade é goalsMacro. */
  macroGoalName: string;
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
  nextReview: string;
  version: number;
  history: PlanVersion[];
  createdAt: string;
  updatedAt: string;
};

export const MAX_PLANS = 20;
const MAX_LIST = 60;
const MAX_TEXT = 1500;

const str = (v: unknown, max = MAX_TEXT): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
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
      const stage: PlanStage = {
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
                  return st
                    ? { id: str(sb.id, 80) || rid(), title: st, done: sb.done === true }
                    : null;
                })
                .filter((x): x is PlanSubaction => x !== null),
            };
          })
          .filter((x): x is PlanAction => x !== null),
      };
      return stage;
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
        estimateMinutes:
          Number.isFinite(est) && est > 0 ? Math.min(Math.round(est), 1440) : undefined,
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
    if (
      !hasPlanPart(p) &&
      !hasGeneralPart(p) &&
      arr(p.filterDecisions).length === 0 &&
      Object.keys(obj(p.dayPlan)).length === 0 &&
      arr(obj(p.weekPlan).days).length === 0 &&
      arr(p.routineChanges).length === 0
    )
      return null;
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

  const stages = "stages" in p ? cleanStages(p.stages) : (existing?.stages ?? []);
  const activeRaw = str(p.activeStageId, 80);
  const activeStageId =
    (activeRaw && stages.some((s) => s.id === activeRaw) ? activeRaw : null) ??
    stages.find((s) => s.status === "ativa")?.id ??
    (existing && stages.some((s) => s.id === existing.activeStageId)
      ? existing.activeStageId
      : null);

  const pick = (key: keyof AltusPlan, max?: number): string =>
    key in p ? str(p[key], max) : ((existing?.[key] as string | undefined) ?? "");

  const base: AltusPlan = {
    id: existing?.id ?? rid(),
    macroGoalId: macroGoalId ?? existing?.macroGoalId ?? null,
    macroGoalName: pick("macroGoalName", 200) || existing?.macroGoalName || "Meta sem nome",
    indicator: pick("indicator", 300),
    deadline: pick("deadline", 40),
    strategy: pick("strategy"),
    activeStageId,
    stages,
    microGoals: "microGoals" in p ? cleanMicro(p.microGoals) : (existing?.microGoals ?? []),
    decisions: [...(existing?.decisions ?? []), ...cleanLog(p.decisions, today)].slice(-MAX_LIST),
    results: [...(existing?.results ?? []), ...cleanLog(p.results, today)].slice(-MAX_LIST),
    reviews: [...(existing?.reviews ?? []), ...cleanLog(p.reviews, today)].slice(-MAX_LIST),
    nextReview: /^\d{4}-\d{2}-\d{2}$/.test(str(p.nextReview, 10))
      ? str(p.nextReview, 10)
      : addDays(today, 7),
    version: (existing?.version ?? 0) + 1,
    history: [
      ...(existing?.history ?? []),
      { version: (existing?.version ?? 0) + 1, date: today, summary },
    ].slice(-MAX_LIST),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const next = existing
    ? plans.map((x) => (x.id === existing.id ? base : x))
    : [base, ...plans].slice(0, MAX_PLANS);
  return { plans: next, plan: base };
}

// ---------------------------------------------------------------------------
// P.G. global, Filtro ALTUS e aplicação da proposta completa
// ---------------------------------------------------------------------------

/** Planejamento Geral: um por usuário, acima de todas as Metas Macro. */
export type AltusGeneralPlan = {
  /** Visão global: prioridades, prazos e como as metas se relacionam. */
  summary: string;
  /** Metas Macro em foco principal agora. */
  focusGoalIds: string[];
  /** Metas Macro em manutenção (priorizar outra não significa abandonar estas). */
  maintenanceGoalIds: string[];
  /** Recursos e capacidade disponíveis (tempo, dinheiro, energia). */
  capacity: string;
  /** Restrições e dependências. */
  constraints: string;
  version: number;
  history: PlanVersion[];
  createdAt: string;
  updatedAt: string;
};

export const FILTER_VERDICTS = ["executar", "testar", "estacionar", "descartar"] as const;
export type FilterVerdict = (typeof FILTER_VERDICTS)[number];

/** Uma ideia avaliada pelo Filtro ALTUS — só é registrada após confirmação. */
export type AltusFilterDecision = {
  id: string;
  date: string;
  idea: string;
  verdict: FilterVerdict;
  rationale: string;
  nextAction: string;
  macroGoalId: string | null;
  planId: string | null;
};

export const MACRO_AREAS = ["Finanças", "Corpo & Saúde", "Biblioteca", "Estudos", "Geral"] as const;
const MACRO_TYPES = ["numerica", "data", "habito"] as const;

/** Formato compatível com `GoalMacro` do store (sem importá-lo, para evitar ciclo). */
export type NewMacroGoal = {
  id: string;
  name: string;
  area: (typeof MACRO_AREAS)[number];
  type: (typeof MACRO_TYPES)[number];
  currentValue: number;
  targetValue: number;
  unit: string;
  deadline?: string;
  motivation?: string;
  linkedModule: null;
  createdAt: string;
};

export type AltusState = {
  altusPlans: AltusPlan[];
  altusGeneralPlan: AltusGeneralPlan | null;
  altusFilter: AltusFilterDecision[];
};

/** Como a proposta se liga a uma Meta Macro quando ela não traz um id válido. */
export type MacroLink = { kind: "existing"; goalId: string } | { kind: "create" };

export const MAX_FILTER = 100;

function hasPlanPart(p: Record<string, unknown>): boolean {
  return Boolean(str(p.planId, 80) || str(p.macroGoalName, 200));
}

function hasGeneralPart(p: Record<string, unknown>): boolean {
  return Object.keys(obj(p.generalPlan)).length > 0;
}

const ids = (v: unknown, valid: string[]): string[] =>
  [...new Set(arr(v).map((x) => str(x, 80)))].filter((x) => valid.includes(x));

function applyGeneralPlan(
  existing: AltusGeneralPlan | null,
  raw: unknown,
  today: string,
  validMacroIds: string[],
  fallbackSummary: string,
): AltusGeneralPlan {
  const g = obj(raw);
  const now = new Date().toISOString();
  const text = (key: "summary" | "capacity" | "constraints") =>
    key in g ? str(g[key], key === "summary" ? 3000 : MAX_TEXT) : (existing?.[key] ?? "");
  const list = (key: "focusGoalIds" | "maintenanceGoalIds") =>
    key in g ? ids(g[key], validMacroIds) : (existing?.[key] ?? []);
  const version = (existing?.version ?? 0) + 1;
  const focusGoalIds = list("focusGoalIds");
  return {
    summary: text("summary"),
    focusGoalIds,
    // Uma meta não pode estar em foco e em manutenção ao mesmo tempo.
    maintenanceGoalIds: list("maintenanceGoalIds").filter((x) => !focusGoalIds.includes(x)),
    capacity: text("capacity"),
    constraints: text("constraints"),
    version,
    history: [
      ...(existing?.history ?? []),
      { version, date: today, summary: str(g.changeSummary, 300) || fallbackSummary },
    ].slice(-MAX_LIST),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function cleanVerdict(v: unknown): FilterVerdict | null {
  const x = str(v, 20).toLowerCase();
  return (FILTER_VERDICTS as readonly string[]).includes(x) ? (x as FilterVerdict) : null;
}

function cleanFilterDecisions(
  raw: unknown,
  today: string,
  validMacroIds: string[],
  defaults: { macroGoalId: string | null; planId: string | null },
): AltusFilterDecision[] {
  return arr(raw)
    .map((r) => {
      const d = obj(r);
      const idea = str(d.idea, 500);
      const verdict = cleanVerdict(d.verdict);
      if (!idea || !verdict) return null;
      const macro = str(d.macroGoalId, 80);
      return {
        id: str(d.id, 80) || rid(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(str(d.date, 10)) ? str(d.date, 10) : today,
        idea,
        verdict,
        rationale: str(d.rationale, 600),
        nextAction: str(d.nextAction, 300),
        macroGoalId: macro && validMacroIds.includes(macro) ? macro : defaults.macroGoalId,
        planId: defaults.planId,
      };
    })
    .filter((x): x is AltusFilterDecision => x !== null);
}

function newMacroGoal(
  p: Record<string, unknown>,
  plan: { indicator: string; deadline: string },
  today: string,
): NewMacroGoal {
  const g = obj(p.macroGoal);
  const area = str(g.area, 40);
  const type = str(g.type, 20);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const deadline = str(g.deadline, 10) || plan.deadline;
  return {
    id: rid(),
    name: str(p.macroGoalName, 200) || "Meta sem nome",
    area: (MACRO_AREAS as readonly string[]).includes(area)
      ? (area as NewMacroGoal["area"])
      : "Geral",
    type: (MACRO_TYPES as readonly string[]).includes(type)
      ? (type as NewMacroGoal["type"])
      : "numerica",
    currentValue: num(g.currentValue),
    targetValue: num(g.targetValue),
    unit: str(g.unit, 20),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : undefined,
    motivation: str(g.motivation, 300) || plan.indicator || undefined,
    linkedModule: null,
    createdAt: today,
  };
}

/** A proposta tem um plano (P.E.) que precisa de vínculo explícito com uma Meta Macro? */
export function needsMacroLink(
  proposal: PlanProposal,
  plans: AltusPlan[],
  validMacroIds: string[],
): boolean {
  const p = obj(proposal);
  if (!hasPlanPart(p)) return false;
  if (validMacroIds.includes(str(p.macroGoalId, 80))) return false;
  const existing = plans.find((x) => x.id === str(p.planId, 80));
  return !(existing?.macroGoalId && validMacroIds.includes(existing.macroGoalId));
}

export type AltusApplyResult = {
  state: AltusState;
  plan: AltusPlan | null;
  generalPlan: AltusGeneralPlan | null;
  decisions: AltusFilterDecision[];
  createdGoal: NewMacroGoal | null;
};

/**
 * Aplica uma proposta CONFIRMADA (P.G., plano e/ou decisões do Filtro).
 * Função pura: devolve o novo estado, sem gravar. Lança erro se o plano
 * ficaria sem Meta Macro — o vínculo é obrigatório.
 */
export function applyAltusProposal(
  state: AltusState,
  goalsMacro: { id: string }[],
  proposal: PlanProposal,
  today: string,
  link: MacroLink | null = null,
): AltusApplyResult {
  const p = obj(proposal);
  let validIds = goalsMacro.map((g) => g.id);
  let plans = state.altusPlans;
  let plan: AltusPlan | null = null;
  let createdGoal: NewMacroGoal | null = null;

  if (hasPlanPart(p)) {
    let macroGoalId: string | null = null;
    if (!needsMacroLink(p, plans, validIds)) {
      const own = str(p.macroGoalId, 80);
      macroGoalId = validIds.includes(own)
        ? own
        : plans.find((x) => x.id === str(p.planId, 80))!.macroGoalId;
    } else if (link?.kind === "existing" && validIds.includes(link.goalId)) {
      macroGoalId = link.goalId;
    } else if (link?.kind === "create") {
      createdGoal = newMacroGoal(
        p,
        { indicator: str(p.indicator, 300), deadline: str(p.deadline, 40) },
        today,
      );
      macroGoalId = createdGoal.id;
      validIds = [...validIds, createdGoal.id];
    } else {
      throw new Error("macro_link_required");
    }
    // Um P.E. por Meta Macro: sem planId, uma proposta para uma meta que já tem
    // plano revisa esse plano em vez de criar um segundo.
    const planId = str(p.planId, 80) || plans.find((x) => x.macroGoalId === macroGoalId)?.id;
    const applied = applyPlanProposal(plans, { ...p, macroGoalId, planId }, today, validIds);
    plans = applied.plans;
    plan = applied.plan;
  }

  const summary = str(p.changeSummary, 300) || "Atualização do planejamento";
  // Formato antigo: `generalPlanning` dentro do plano vira acréscimo ao P.G.
  // global (como na migração), em vez de ser descartado em silêncio.
  const legacyGeneral = str(p.generalPlanning);
  const generalRaw = hasGeneralPart(p)
    ? p.generalPlan
    : legacyGeneral
      ? {
          summary: [
            state.altusGeneralPlan?.summary ?? "",
            `${plan?.macroGoalName ?? str(p.macroGoalName, 200)}: ${legacyGeneral}`,
          ]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 3000),
        }
      : null;
  const generalPlan = generalRaw
    ? applyGeneralPlan(state.altusGeneralPlan, generalRaw, today, validIds, summary)
    : null;

  const defaults = { macroGoalId: plan?.macroGoalId ?? null, planId: plan?.id ?? null };
  // `parkedIdeas` (formato antigo) vira decisão "estacionar" do Filtro ALTUS.
  const legacyParked = cleanLog(p.parkedIdeas, today).map((e) => ({
    idea: e.text,
    date: e.date,
    verdict: "estacionar",
  }));
  const decisions = cleanFilterDecisions(
    [...arr(p.filterDecisions), ...legacyParked],
    today,
    validIds,
    defaults,
  );

  return {
    state: {
      altusPlans: plans,
      altusGeneralPlan: generalPlan ?? state.altusGeneralPlan,
      altusFilter: [...decisions, ...state.altusFilter].slice(0, MAX_FILTER),
    },
    plan,
    generalPlan,
    decisions,
    createdGoal,
  };
}

// ---------------------------------------------------------------------------
// Normalização ao carregar (nuvem, importação, contexto do servidor)
// ---------------------------------------------------------------------------

function normalizePlan(
  raw: unknown,
  today: string,
): (AltusPlan & { legacyGeneral: string; legacyParked: PlanLogEntry[] }) | null {
  const p = obj(raw);
  const id = str(p.id, 80);
  if (!id) return null;
  const stages = cleanStages(p.stages);
  const active = str(p.activeStageId, 80);
  const version = Number(p.version);
  const history = arr(p.history)
    .map((h) => {
      const e = obj(h);
      const v = Number(e.version);
      return Number.isFinite(v) && v > 0
        ? { version: v, date: str(e.date, 10) || today, summary: str(e.summary, 300) }
        : null;
    })
    .filter((x): x is PlanVersion => x !== null);
  return {
    id,
    macroGoalId: str(p.macroGoalId, 80) || null,
    macroGoalName: str(p.macroGoalName, 200) || "Meta sem nome",
    indicator: str(p.indicator, 300),
    deadline: str(p.deadline, 40),
    strategy: str(p.strategy),
    activeStageId: active && stages.some((s) => s.id === active) ? active : null,
    stages,
    microGoals: cleanMicro(p.microGoals),
    decisions: cleanLog(p.decisions, today),
    results: cleanLog(p.results, today),
    reviews: cleanLog(p.reviews, today),
    nextReview: /^\d{4}-\d{2}-\d{2}$/.test(str(p.nextReview, 10)) ? str(p.nextReview, 10) : "",
    version: Number.isFinite(version) && version > 0 ? Math.round(version) : 1,
    history,
    createdAt: str(p.createdAt, 40) || new Date().toISOString(),
    updatedAt: str(p.updatedAt, 40) || new Date().toISOString(),
    legacyGeneral: str(p.generalPlanning),
    legacyParked: cleanLog(p.parkedIdeas, today),
  };
}

function normalizeGeneral(raw: unknown, today: string): AltusGeneralPlan | null {
  const g = obj(raw);
  if (Object.keys(g).length === 0) return null;
  const version = Number(g.version);
  const strings = (v: unknown) => [
    ...new Set(
      arr(v)
        .map((x) => str(x, 80))
        .filter(Boolean),
    ),
  ];
  return {
    summary: str(g.summary, 3000),
    focusGoalIds: strings(g.focusGoalIds),
    maintenanceGoalIds: strings(g.maintenanceGoalIds),
    capacity: str(g.capacity),
    constraints: str(g.constraints),
    version: Number.isFinite(version) && version > 0 ? Math.round(version) : 1,
    history: arr(g.history)
      .map((h) => {
        const e = obj(h);
        const v = Number(e.version);
        return Number.isFinite(v) && v > 0
          ? { version: v, date: str(e.date, 10) || today, summary: str(e.summary, 300) }
          : null;
      })
      .filter((x): x is PlanVersion => x !== null),
    createdAt: str(g.createdAt, 40) || new Date().toISOString(),
    updatedAt: str(g.updatedAt, 40) || new Date().toISOString(),
  };
}

/**
 * Valida o que veio da nuvem/importação e converte o formato antigo, sem
 * perder conteúdo e sem duplicar:
 * - `generalPlanning` de cada plano → texto do P.G. global (e sai do plano);
 * - `parkedIdeas` de cada plano → decisões "estacionar" do Filtro ALTUS.
 * Idempotente: rodar de novo sobre o resultado não muda nada.
 */
export function normalizeAltusState(
  raw: Partial<Record<keyof AltusState, unknown>>,
  today: string,
): AltusState {
  const plans = (Array.isArray(raw.altusPlans) ? raw.altusPlans.slice(0, MAX_PLANS) : [])
    .map((p) => normalizePlan(p, today))
    .filter((p): p is NonNullable<ReturnType<typeof normalizePlan>> => p !== null);

  let general = normalizeGeneral(raw.altusGeneralPlan, today);
  const legacy = plans
    .filter((p) => p.legacyGeneral)
    .map((p) => `${p.macroGoalName}: ${p.legacyGeneral}`);
  if (legacy.length > 0) {
    const now = new Date().toISOString();
    const base: AltusGeneralPlan = general ?? {
      summary: "",
      focusGoalIds: [],
      maintenanceGoalIds: [],
      capacity: "",
      constraints: "",
      version: 1,
      history: [{ version: 1, date: today, summary: "Migrado dos planejamentos existentes" }],
      createdAt: now,
      updatedAt: now,
    };
    general = {
      ...base,
      summary: [base.summary, ...legacy].filter(Boolean).join("\n\n").slice(0, 3000),
    };
  }

  const migrated: AltusFilterDecision[] = plans.flatMap((p) =>
    p.legacyParked.map((e) => ({
      id: rid(),
      date: e.date,
      idea: e.text.slice(0, 500),
      verdict: "estacionar" as const,
      rationale: "",
      nextAction: "",
      macroGoalId: p.macroGoalId,
      planId: p.id,
    })),
  );
  // Sem `arr()`, que cortaria em MAX_LIST: o Filtro guarda até MAX_FILTER decisões.
  const existing = (Array.isArray(raw.altusFilter) ? raw.altusFilter.slice(0, MAX_FILTER) : [])
    .map((r) => {
      const d = obj(r);
      const idea = str(d.idea, 500);
      const verdict = cleanVerdict(d.verdict);
      if (!idea || !verdict) return null;
      return {
        id: str(d.id, 80) || rid(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(str(d.date, 10)) ? str(d.date, 10) : today,
        idea,
        verdict,
        rationale: str(d.rationale, 600),
        nextAction: str(d.nextAction, 300),
        macroGoalId: str(d.macroGoalId, 80) || null,
        planId: str(d.planId, 80) || null,
      };
    })
    .filter((x): x is AltusFilterDecision => x !== null);

  return {
    altusPlans: plans.map(({ legacyGeneral: _g, legacyParked: _p, ...plan }) => plan),
    altusGeneralPlan: general,
    altusFilter: [...migrated, ...existing].slice(0, MAX_FILTER),
  };
}
