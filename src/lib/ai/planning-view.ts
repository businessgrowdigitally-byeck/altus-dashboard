/**
 * Regras da tela de Planejamento (sem React), para testar sem navegador.
 */

// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import type { AltusFilterDecision, AltusPlan, FilterVerdict } from "./plan.ts";

/** Planos com a revisão semanal vencida (próxima revisão hoje ou antes). */
export function overduePlans(plans: AltusPlan[], today: string): AltusPlan[] {
  return plans.filter((p) => p.nextReview && p.nextReview <= today);
}

/**
 * Metas Macro que podem receber este plano: um P.E. por Meta Macro, então
 * metas já vinculadas a OUTRO plano ficam de fora.
 */
export function linkableGoals<G extends { id: string }>(
  goals: G[],
  plans: AltusPlan[],
  planId: string,
): G[] {
  const taken = new Set(
    plans.filter((p) => p.id !== planId && p.macroGoalId).map((p) => p.macroGoalId),
  );
  return goals.filter((g) => !taken.has(g.id));
}

/** Metas Micro concluídas — execução, não resultado: a tela mostra os dois separados. */
export function microProgress(plan: AltusPlan): { done: number; total: number } {
  return {
    done: plan.microGoals.filter((m) => m.status === "concluida").length,
    total: plan.microGoals.length,
  };
}

export function filterDecisions(
  decisions: AltusFilterDecision[],
  verdict: FilterVerdict | "todas",
): AltusFilterDecision[] {
  return verdict === "todas" ? decisions : decisions.filter((d) => d.verdict === verdict);
}
