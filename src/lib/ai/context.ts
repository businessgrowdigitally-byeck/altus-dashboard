/**
 * Monta o contexto do Mentor a partir da linha `user_data` lida NO SERVIDOR
 * (com o token do usuário, sob RLS). Seleciona períodos e limita volume.
 * Nada aqui é inventado: campos ausentes viram listas vazias.
 */

// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { normalizeAltusState } from "./plan.ts";
import { balanceUntil, normalizeBudgets, normalizeRecurring, type FinTx } from "../finance.ts";
import { addDays, dayItems, normalizeDayPlans, WEEK_PLAN_DAYS } from "../day-plan.ts";
import { actionStreak, weekProgress } from "../daily-stats.ts";
import type { GoalDaily } from "../store";

type Row = Record<string, unknown>;
const list = (v: unknown): Row[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Row[]) : [];
const s = (v: unknown, max = 300): string => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const byDateDesc = (a: Row, b: Row) =>
  s(b.date ?? b.finishedAt).localeCompare(s(a.date ?? a.finishedAt));

function shift(today: string, days: number): string {
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function monthKey(today: string, back: number): string {
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - back);
  return d.toISOString().slice(0, 7);
}

export function buildMentorContext(data: unknown, today: string) {
  const d = (data && typeof data === "object" ? data : {}) as Row;
  const since30 = shift(today, 29);
  const since7 = shift(today, 6);

  const profile = (d.profile && typeof d.profile === "object" ? d.profile : {}) as Row;

  // Finanças: 3 meses agregados + 15 lançamentos recentes.
  const tx = list(d.transactions);
  const meses = [0, 1, 2].map((b) => {
    const m = monthKey(today, b);
    const mt = tx.filter((t) => s(t.date).startsWith(m));
    const entradas = mt.filter((t) => t.type === "entrada").reduce((a, t) => a + n(t.value), 0);
    const saidas = mt.filter((t) => t.type === "saida").reduce((a, t) => a + n(t.value), 0);
    const cat: Record<string, number> = {};
    mt.filter((t) => t.type === "saida").forEach(
      (t) => (cat[s(t.category, 60)] = (cat[s(t.category, 60)] || 0) + n(t.value)),
    );
    return {
      mes: m,
      entradas,
      saidas,
      resultado_do_mes: entradas - saidas,
      saidas_por_categoria: cat,
      lancamentos: mt.length,
    };
  });
  const finTx: FinTx[] = tx
    .filter((t) => (t.type === "entrada" || t.type === "saida") && n(t.value) > 0 && s(t.date, 10))
    .map((t) => ({
      id: s(t.id, 80),
      type: t.type as FinTx["type"],
      value: n(t.value),
      date: s(t.date, 10),
      category: s(t.category, 60),
      description: s(t.description, 100),
    }));
  const openingRaw = (d.profile as Row | undefined)?.openingBalance;
  const opening = typeof openingRaw === "number" && Number.isFinite(openingRaw) ? openingRaw : null;

  // Corpo.
  const weights = list(d.weights).sort(byDateDesc);
  const workouts = list(d.workouts).sort(byDateDesc);
  const w30 = workouts.filter((w) => s(w.date) >= since30);
  const workoutDays = new Set(workouts.map((w) => s(w.date)));
  let streak = 0;
  for (let i = workoutDays.has(today) ? 0 : 1; i < 365; i++) {
    if (workoutDays.has(shift(today, i))) streak++;
    else break;
  }

  // Estudos.
  const studies = list(d.studies).sort(byDateDesc);
  const st30 = studies.filter((x) => s(x.date) >= since30);
  const horasArea: Record<string, number> = {};
  st30.forEach(
    (x) =>
      (horasArea[s(x.area, 60)] = +((horasArea[s(x.area, 60)] || 0) + n(x.duration) / 60).toFixed(
        1,
      )),
  );

  // Metas e rotina.
  const daily = list(d.goalsDaily);
  const completions = list(d.completions);
  const comp30 = completions.filter((c) => s(c.date) >= since30);
  // Mesma normalização do app: dados antigos (P.G. dentro do plano, ideias
  // estacionadas) aparecem já no formato atual.
  const altus = normalizeAltusState(
    { altusPlans: d.altusPlans, altusGeneralPlan: d.altusGeneralPlan, altusFilter: d.altusFilter },
    today,
  );
  const goals = list(d.goalsMacro);
  const goalName = (id: string | null) =>
    id ? s(goals.find((g) => g.id === id)?.name, 150) || null : null;
  const goalRef = (id: string) => ({ id, nome: goalName(id) ?? "(meta não encontrada)" });
  const general = altus.altusGeneralPlan;

  return {
    data_de_hoje: today,
    perfil: {
      nome: s(profile.name, 80),
      peso_meta: n(profile.goalWeight) || null,
      altura_m: n(profile.height) || null,
      meta_renda_mensal: n(profile.incomeTarget) || null,
      teto_despesas_mensal: n(profile.maxExpenses) || null,
    },
    metas_macro: goals.slice(0, 20).map((g) => ({
      id: s(g.id, 80),
      planId_vinculado: altus.altusPlans.find((p) => p.macroGoalId === g.id)?.id ?? null,
      nome: s(g.name, 150),
      area: s(g.area, 40),
      tipo: s(g.type, 20),
      atual: n(g.currentValue),
      alvo: n(g.targetValue),
      unidade: s(g.unit, 20),
      prazo: s(g.deadline, 20) || null,
      motivacao: s(g.motivation, 200) || null,
    })),
    ...buildDays(daily, list(d.completions), d.dayPlans, today),
    rotina: {
      acoes: daily.slice(0, 30).map((a) => {
        const id = s(a.id, 80);
        return {
          id,
          nome: s(a.name, 120),
          minutos: n(a.durationMinutes) || 30,
          area: s(a.area, 40),
          dias_semana: Array.isArray(a.daysOfWeek) ? a.daysOfWeek : [],
          horario: s(a.suggestedTime, 5) || null,
          meta_vinculada: s(a.linkedGoalId, 80) || null,
          conclusoes_7d: completions.filter((c) => c.actionId === id && s(c.date) >= since7).length,
          conclusoes_30d: comp30.filter((c) => c.actionId === id).length,
        };
      }),
      conclusoes_totais_30d: comp30.length,
    },
    financas: {
      // Saldo acumulado = saldo inicial + todo o histórico; não zera na virada do mês.
      saldo_acumulado_hoje: balanceUntil(finTx, opening ?? 0, today),
      saldo_inicial: opening,
      saldo_inicial_informado: opening !== null,
      orcamento_mensal_por_categoria: normalizeBudgets(d.categoryBudgets),
      recorrentes: normalizeRecurring(d.recurringTransactions)
        .slice(0, 20)
        .map((r) => ({
          tipo: r.type,
          valor: r.value,
          descricao: r.description,
          categoria: r.category,
          dia: r.dayOfMonth,
          ativo: r.active,
        })),
      ultimos_3_meses: meses,
      lancamentos_recentes: tx
        .sort(byDateDesc)
        .slice(0, 15)
        .map((t) => ({
          data: s(t.date),
          tipo: s(t.type),
          valor: n(t.value),
          categoria: s(t.category, 60),
          descricao: s(t.description, 100),
        })),
    },
    corpo: {
      pesos_recentes: weights
        .slice(0, 12)
        .map((w) => ({ data: s(w.date), kg: n(w.weight), notas: s(w.notes, 120) || undefined })),
      treinos_30d: w30.length,
      minutos_treino_30d: w30.reduce((a, w) => a + n(w.duration), 0),
      sequencia_atual_dias: streak,
      treinos_recentes: workouts.slice(0, 10).map((w) => ({
        data: s(w.date),
        tipo: s(w.type, 60),
        minutos: n(w.duration),
        notas: s(w.notes, 120) || undefined,
      })),
    },
    estudos: {
      horas_30d_por_area: horasArea,
      sessoes_30d: st30.length,
      sessoes_recentes: studies.slice(0, 10).map((x) => ({
        data: s(x.date),
        topico: s(x.topic, 120),
        area: s(x.area, 60),
        minutos: n(x.duration),
        status: s(x.status, 20),
        aprendizado: s(x.learned, 250) || undefined,
      })),
    },
    biblioteca: {
      total_livros: list(d.books).length,
      recentes: list(d.books)
        .sort(byDateDesc)
        .slice(0, 8)
        .map((b) => ({
          titulo: s(b.title, 120),
          autor: s(b.author, 80),
          nota: n(b.rating),
          concluido_em: s(b.finishedAt),
          notas: s(b.notes, 250) || undefined,
          aplicacoes: s(b.applications, 250) || undefined,
        })),
    },
    kaizen: list(d.kaizen)
      .sort(byDateDesc)
      .slice(0, 10)
      .map((k) => ({
        data: s(k.date),
        melhorei_hoje: s(k.improvedToday, 250),
        melhorar_amanha: s(k.improveTomorrow, 250),
        notas: s(k.notes, 200) || undefined,
      })),
    planejamento_geral: general
      ? {
          versao: general.version,
          visao_geral: general.summary.slice(0, 1500),
          foco_principal: general.focusGoalIds.map(goalRef),
          em_manutencao: general.maintenanceGoalIds.map(goalRef),
          recursos_capacidade: general.capacity.slice(0, 600),
          restricoes_dependencias: general.constraints.slice(0, 600),
          atualizado_em: general.updatedAt.slice(0, 10),
        }
      : null,
    planejamentos_altus: altus.altusPlans.slice(0, 10).map((p) => {
      const linked = goalName(p.macroGoalId);
      return {
        planId: p.id,
        macroGoalId: linked ? p.macroGoalId : null,
        meta_macro: linked ?? p.macroGoalName.slice(0, 150),
        vinculo_meta_macro: linked
          ? "ok"
          : "SEM VÍNCULO — na próxima proposta, vincule a uma meta de metas_macro",
        versao: p.version,
        indicador: p.indicator.slice(0, 200),
        prazo: p.deadline,
        estrategia: p.strategy.slice(0, 600),
        etapa_ativa: p.activeStageId,
        etapas: p.stages.slice(0, 12).map((st) => ({
          id: st.id,
          titulo: st.title,
          status: st.status,
          criterio: st.doneCriteria,
          acoes: st.actions.slice(0, 10).map((a) => ({
            id: a.id,
            titulo: a.title,
            feita: a.done,
            subacoes: a.subactions
              .slice(0, 6)
              .map((sb) => ({ id: sb.id, titulo: sb.title, feita: sb.done })),
          })),
        })),
        metas_micro: p.microGoals.slice(0, 20).map((m) => ({
          id: m.id,
          titulo: m.title,
          etapa: m.stageId,
          status: m.status,
          estimativa_min: m.estimateMinutes,
        })),
        decisoes_recentes: p.decisions.slice(-5),
        resultados_recentes: p.results.slice(-5),
        revisoes_recentes: p.reviews.slice(-3),
        proxima_revisao: p.nextReview || null,
        revisao_vencida: Boolean(p.nextReview && p.nextReview <= today),
      };
    }),
    filtro_altus: altus.altusFilter.slice(0, 15).map((f) => ({
      data: f.date,
      ideia: f.idea.slice(0, 250),
      veredito: f.verdict,
      motivo: f.rationale.slice(0, 250) || undefined,
      proxima_acao: f.nextAction.slice(0, 200) || undefined,
      meta_macro: goalName(f.macroGoalId),
    })),
  };
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * Ações de hoje como o usuário as vê na Home (rotina + plano do dia), com os
 * ids que o Mentor usa para propor um `dayPlan`; os próximos 6 dias (para o
 * `weekPlan`) e os ajustes que se repetem nos últimos 14 dias (para sugerir
 * `routineChanges`).
 */
function buildDays(rawDaily: Row[], rawCompletions: Row[], rawPlans: unknown, today: string) {
  const daily: GoalDaily[] = rawDaily.slice(0, 60).map((a) => ({
    id: s(a.id, 80),
    name: s(a.name, 120),
    area: (s(a.area, 40) || "Geral") as GoalDaily["area"],
    daysOfWeek: Array.isArray(a.daysOfWeek)
      ? a.daysOfWeek.filter((x): x is number => typeof x === "number")
      : [],
    suggestedTime: s(a.suggestedTime, 5) || undefined,
    durationMinutes: n(a.durationMinutes) || undefined,
  }));
  const completions = rawCompletions.map((c) => ({
    date: s(c.date, 10),
    actionId: s(c.actionId, 80),
  }));
  const plans = normalizeDayPlans(rawPlans, today);
  const plan = plans[today];
  const doneToday = new Set(completions.filter((c) => c.date === today).map((c) => c.actionId));
  const weekday = (iso: string) => {
    const [y, m, dd] = iso.split("-").map(Number);
    return WEEKDAYS[new Date(y, m - 1, dd).getDay()];
  };
  const hoje = {
    data: today,
    dia_da_semana: weekday(today),
    plano_do_dia: plan
      ? {
          origem: plan.source === "mentor" ? "Mentor" : "usuário",
          motivo: plan.reason || null,
          adiadas: plan.postponed.map((p) => ({
            id: p.actionId,
            para: p.to,
            motivo: p.reason ?? null,
          })),
        }
      : null,
    itens: dayItems(daily, plans, today).map((i) =>
      i.kind === "action"
        ? {
            id: i.action.id,
            nome: i.action.name,
            area: i.action.area,
            minutos: i.minutes,
            horario: i.action.suggestedTime ?? null,
            feita_hoje: doneToday.has(i.action.id),
            semana: (({ done, scheduled }) => `${done}/${scheduled}`)(
              weekProgress(i.action, completions, today, plans),
            ),
            sequencia_dias: actionStreak(i.action, completions, today, plans),
            nota: i.note ?? null,
            adiada_de: i.from ?? null,
          }
        : {
            extra: i.extra.title,
            minutos: i.extra.minutes ?? null,
            feito: i.extra.done,
            nota: i.extra.note ?? null,
          },
    ),
  };
  const proximos_dias = Array.from({ length: WEEK_PLAN_DAYS - 1 }, (_, k) => {
    const date = addDays(today, k + 1);
    const p = plans[date];
    return {
      data: date,
      dia_da_semana: weekday(date),
      ajustado: p ? (p.source === "mentor" ? "Mentor" : "usuário") : null,
      motivo: p?.reason || null,
      itens: dayItems(daily, plans, date).map((i) =>
        i.kind === "action"
          ? {
              id: i.action.id,
              minutos: i.minutes,
              ...(i.note ? { nota: i.note } : {}),
              ...(i.from ? { adiada_de: i.from } : {}),
            }
          : { extra: i.extra.title, minutos: i.extra.minutes ?? null },
      ),
    };
  });
  // Ajustes que se repetem: mesma ação com duração ajustada ou adiada em 2+ dias.
  const since = addDays(today, -13);
  const stats = new Map<string, { durations: number[]; postponed: number }>();
  for (const [date, p] of Object.entries(plans)) {
    if (date < since || date > today) continue;
    for (const [id, min] of Object.entries(p.durations)) {
      const e = stats.get(id) ?? { durations: [], postponed: 0 };
      e.durations.push(min);
      stats.set(id, e);
    }
    for (const x of p.postponed) {
      const e = stats.get(x.actionId) ?? { durations: [], postponed: 0 };
      e.postponed += 1;
      stats.set(x.actionId, e);
    }
  }
  const ajustes_recentes = daily
    .map((a) => {
      const e = stats.get(a.id);
      if (!e || (e.durations.length < 2 && e.postponed < 2)) return null;
      const freq = new Map<number, number>();
      for (const d of e.durations) freq.set(d, (freq.get(d) ?? 0) + 1);
      const common = [...freq.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0];
      return {
        id: a.id,
        nome: a.name,
        minutos_rotina: a.durationMinutes ?? 30,
        dias_com_duracao_ajustada: e.durations.length,
        duracao_mais_usada: common ? common[0] : null,
        vezes_adiada: e.postponed,
      };
    })
    .filter((x) => x !== null)
    .slice(0, 15);
  return { hoje, proximos_dias, ajustes_recentes };
}
