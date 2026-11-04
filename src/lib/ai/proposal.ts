/**
 * Fluxo de confirmação das propostas ```altus-plan``` no chat.
 *
 * A prévia roda `applyPlanProposal` sem gravar nada, então o cartão mostra
 * exatamente o que será salvo (já sanitizado), e não o JSON cru do modelo.
 */

// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { applyPlanProposal, parsePlanProposal, type AltusPlan, type PlanProposal } from "./plan.ts";

export type ChatPlanState = {
  status: "saved" | "discarded";
  planId?: string;
  version?: number;
};

type ChatLike = { role: "user" | "assistant"; content: string; plan?: ChatPlanState };

export type ProposalPreview = {
  plan: AltusPlan;
  /** Versão atual quando a proposta revisa um plano existente; null = plano novo. */
  fromVersion: number | null;
  linkedMacroName: string | null;
  changeSummary: string;
  newEntries: number;
};

export function previewPlanProposal(
  proposal: PlanProposal,
  plans: AltusPlan[],
  goalsMacro: { id: string; name: string }[],
  today: string,
): ProposalPreview {
  const { plan } = applyPlanProposal(
    plans,
    proposal,
    today,
    goalsMacro.map((g) => g.id),
  );
  const existing = plans.find((p) => p.id === plan.id);
  const count = (k: "decisions" | "results" | "reviews" | "parkedIdeas") =>
    plan[k].length - (existing?.[k].length ?? 0);
  return {
    plan,
    fromVersion: existing ? existing.version : null,
    linkedMacroName: goalsMacro.find((g) => g.id === plan.macroGoalId)?.name ?? null,
    changeSummary: plan.history.at(-1)?.summary ?? "",
    newEntries: count("decisions") + count("results") + count("reviews") + count("parkedIdeas"),
  };
}

export type ProposalView =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "pending"; proposal: PlanProposal }
  | { kind: "superseded" }
  | { kind: "saved"; version?: number }
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
    if (m.plan?.status === "saved") return { kind: "saved", version: m.plan.version };
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
