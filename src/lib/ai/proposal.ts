/**
 * Fluxo de confirmação das propostas ```altus-plan``` no chat.
 *
 * A prévia roda `applyAltusProposal` sem gravar nada, então o cartão mostra
 * exatamente o que será salvo (já sanitizado), e não o JSON cru do modelo.
 */

// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import {
  applyAltusProposal,
  needsMacroLink,
  parsePlanProposal,
  type AltusApplyResult,
  type AltusState,
  type MacroLink,
  type PlanProposal,
} from "./plan.ts";

export type ChatPlanState = {
  status: "saved" | "discarded";
  planId?: string;
  /** Versão do plano (P.E.) salva por esta proposta. */
  version?: number;
  /** Versão do P.G. salva por esta proposta. */
  generalVersion?: number;
  /** Quantas decisões do Filtro ALTUS foram registradas. */
  decisions?: number;
  /** A proposta salvou um plano do dia (data). */
  dayPlan?: string;
  /** Quantos dias o plano da semana salvou. */
  weekDays?: number;
  /** Quantas ações da rotina fixa mudaram. */
  routine?: number;
};

type ChatLike = { role: "user" | "assistant"; content: string; plan?: ChatPlanState };

export type ProposalPreview = {
  result: AltusApplyResult;
  /** Versão atual do plano revisado; null = plano novo (ou proposta sem plano). */
  fromVersion: number | null;
  /** Versão atual do P.G.; null = P.G. novo (ou proposta sem P.G.). */
  generalFromVersion: number | null;
  /** O plano precisa que o usuário escolha ou crie a Meta Macro. */
  needsLink: boolean;
  linkedMacroName: string | null;
  changeSummary: string;
  newEntries: number;
};

/** Sugestão inicial de vínculo: meta existente com o mesmo nome, senão criar. */
export function defaultMacroLink(
  proposal: PlanProposal,
  goalsMacro: { id: string; name: string }[],
): MacroLink {
  const name = String(proposal.macroGoalName ?? "")
    .trim()
    .toLowerCase();
  const match = goalsMacro.find((g) => g.name.trim().toLowerCase() === name);
  return match ? { kind: "existing", goalId: match.id } : { kind: "create" };
}

export function previewAltusProposal(
  proposal: PlanProposal,
  state: AltusState,
  goalsMacro: { id: string; name: string }[],
  today: string,
  link: MacroLink | null,
): ProposalPreview {
  const ids = goalsMacro.map((g) => g.id);
  const needsLink = needsMacroLink(proposal, state.altusPlans, ids);
  const result = applyAltusProposal(state, goalsMacro, proposal, today, needsLink ? link : null);
  const { plan, generalPlan } = result;
  const existing = plan ? state.altusPlans.find((p) => p.id === plan.id) : undefined;
  const count = (k: "decisions" | "results" | "reviews") =>
    plan ? plan[k].length - (existing?.[k].length ?? 0) : 0;
  return {
    result,
    fromVersion: existing ? existing.version : null,
    generalFromVersion:
      generalPlan && state.altusGeneralPlan ? state.altusGeneralPlan.version : null,
    needsLink,
    linkedMacroName: result.createdGoal
      ? result.createdGoal.name
      : (goalsMacro.find((g) => g.id === plan?.macroGoalId)?.name ?? null),
    changeSummary: plan?.history.at(-1)?.summary ?? generalPlan?.history.at(-1)?.summary ?? "",
    newEntries: count("decisions") + count("results") + count("reviews"),
  };
}

export type ProposalView =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "pending"; proposal: PlanProposal }
  | { kind: "superseded" }
  | { kind: "saved"; saved: ChatPlanState }
  | { kind: "discarded" };

/**
 * Situação da proposta em cada mensagem. Só a proposta mais recente ainda não
 * decidida pode ser confirmada — uma anterior poderia sobrescrever uma revisão
 * mais nova do mesmo plano.
 */
export function proposalViews(chat: ChatLike[], streaming: boolean): ProposalView[] {
  const parsed = chat.map((m) => (m.role === "assistant" ? parsePlanProposal(m.content) : null));
  let latest = -1;
  parsed.forEach((p, i) => {
    if (p) latest = i;
  });
  return chat.map((m, i) => {
    if (m.role !== "assistant") return { kind: "none" };
    const inProgress = streaming && i === chat.length - 1;
    if (m.plan?.status === "saved") return { kind: "saved", saved: m.plan };
    if (m.plan?.status === "discarded") return { kind: "discarded" };
    const proposal = parsed[i];
    if (!proposal) {
      const hasBlock = m.content.includes("```altus-plan");
      return hasBlock && !inProgress ? { kind: "invalid" } : { kind: "none" };
    }
    if (inProgress) return { kind: "none" };
    return i === latest ? { kind: "pending", proposal } : { kind: "superseded" };
  });
}
