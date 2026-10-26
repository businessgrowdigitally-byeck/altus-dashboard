/**
 * Monta o contexto do Mentor a partir da linha `user_data` lida NO SERVIDOR
 * (com o token do usuário, sob RLS). Seleciona períodos e limita volume.
 * Nada aqui é inventado: campos ausentes viram listas vazias.
 */

type Row = Record<string, unknown>;
const list = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Row[]) : []);
const s = (v: unknown, max = 300): string => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const byDateDesc = (a: Row, b: Row) => s(b.date ?? b.finishedAt).localeCompare(s(a.date ?? a.finishedAt));

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
    mt.filter((t) => t.type === "saida").forEach((t) => (cat[s(t.category, 60)] = (cat[s(t.category, 60)] || 0) + n(t.value)));
    return { mes: m, entradas, saidas, saldo: entradas - saidas, saidas_por_categoria: cat, lancamentos: mt.length };
  });

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
  st30.forEach((x) => (horasArea[s(x.area, 60)] = +((horasArea[s(x.area, 60)] || 0) + n(x.duration) / 60).toFixed(1)));

  // Metas e rotina.
  const daily = list(d.goalsDaily);
  const completions = list(d.completions);
  const comp30 = completions.filter((c) => s(c.date) >= since30);
  const plans = list(d.altusPlans);

  return {
    data_de_hoje: today,
    perfil: {
      nome: s(profile.name, 80),
      peso_meta: n(profile.goalWeight) || null,
      altura_m: n(profile.height) || null,
      meta_renda_mensal: n(profile.incomeTarget) || null,
      teto_despesas_mensal: n(profile.maxExpenses) || null,
    },
    metas_macro: list(d.goalsMacro).slice(0, 20).map((g) => ({
      id: s(g.id, 80),
      nome: s(g.name, 150),
      area: s(g.area, 40),
      tipo: s(g.type, 20),
      atual: n(g.currentValue),
      alvo: n(g.targetValue),
      unidade: s(g.unit, 20),
      prazo: s(g.deadline, 20) || null,
      motivacao: s(g.motivation, 200) || null,
    })),
    rotina: {
      acoes: daily.slice(0, 30).map((a) => {
        const id = s(a.id, 80);
        return {
          nome: s(a.name, 120),
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
    financas: { ultimos_3_meses: meses, lancamentos_recentes: tx.sort(byDateDesc).slice(0, 15).map((t) => ({ data: s(t.date), tipo: s(t.type), valor: n(t.value), categoria: s(t.category, 60), descricao: s(t.description, 100) })) },
    corpo: {
      pesos_recentes: weights.slice(0, 12).map((w) => ({ data: s(w.date), kg: n(w.weight), notas: s(w.notes, 120) || undefined })),
      treinos_30d: w30.length,
      minutos_treino_30d: w30.reduce((a, w) => a + n(w.duration), 0),
      sequencia_atual_dias: streak,
      treinos_recentes: workouts.slice(0, 10).map((w) => ({ data: s(w.date), tipo: s(w.type, 60), minutos: n(w.duration), notas: s(w.notes, 120) || undefined })),
    },
    estudos: {
      horas_30d_por_area: horasArea,
      sessoes_30d: st30.length,
      sessoes_recentes: studies.slice(0, 10).map((x) => ({ data: s(x.date), topico: s(x.topic, 120), area: s(x.area, 60), minutos: n(x.duration), status: s(x.status, 20), aprendizado: s(x.learned, 250) || undefined })),
    },
    biblioteca: {
      total_livros: list(d.books).length,
      recentes: list(d.books).sort(byDateDesc).slice(0, 8).map((b) => ({ titulo: s(b.title, 120), autor: s(b.author, 80), nota: n(b.rating), concluido_em: s(b.finishedAt), notas: s(b.notes, 250) || undefined, aplicacoes: s(b.applications, 250) || undefined })),
    },
    kaizen: list(d.kaizen).sort(byDateDesc).slice(0, 10).map((k) => ({ data: s(k.date), melhorei_hoje: s(k.improvedToday, 250), melhorar_amanha: s(k.improveTomorrow, 250), notas: s(k.notes, 200) || undefined })),
    planejamentos_altus: plans.slice(0, 10).map((p) => ({
      planId: s(p.id, 80),
      meta_macro: s(p.macroGoalName, 150),
      macroGoalId: s(p.macroGoalId, 80) || null,
      versao: n(p.version),
      indicador: s(p.indicator, 200),
      prazo: s(p.deadline, 40),
      planejamento_geral: s(p.generalPlanning, 600),
      estrategia: s(p.strategy, 600),
      etapa_ativa: s(p.activeStageId, 80) || null,
      etapas: list(p.stages).slice(0, 12),
      metas_micro: list(p.microGoals).slice(0, 20),
      decisoes_recentes: list(p.decisions).slice(-5),
      resultados_recentes: list(p.results).slice(-5),
      revisoes_recentes: list(p.reviews).slice(-3),
      ideias_estacionadas: list(p.parkedIdeas).slice(-5),
      proxima_revisao: s(p.nextReview, 10),
    })),
  };
}
