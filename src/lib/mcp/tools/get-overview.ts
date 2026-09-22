import { defineTool } from "@lovable.dev/mcp-js";
import { loadData } from "../data";

export default defineTool({
  name: "get_overview",
  title: "Visão geral do ALTUS",
  description:
    "Resumo do painel: saldo financeiro do mês, peso mais recente, estudos, livros, metas e rotina diária.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const d = await loadData(ctx);
    const month = new Date().toISOString().slice(0, 7);
    const tx = (d.transactions ?? []).filter((t) => t.date.startsWith(month));
    const entradas = tx.filter((t) => t.type === "entrada").reduce((a, b) => a + b.value, 0);
    const saidas = tx.filter((t) => t.type === "saida").reduce((a, b) => a + b.value, 0);
    const weights = [...(d.weights ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    const studies = d.studies ?? [];

    const overview = {
      mes: month,
      financas: { entradas, saidas, saldo: entradas - saidas, lancamentos: tx.length },
      peso_atual: weights[0]?.weight ?? null,
      peso_meta: d.profile?.goalWeight ?? null,
      livros_lidos: (d.books ?? []).length,
      horas_estudo: Math.round((studies.reduce((a, b) => a + b.duration, 0) / 60) * 10) / 10,
      metas: (d.goalsMacro ?? []).map((g) => ({
        nome: g.name,
        area: g.area,
        atual: g.currentValue,
        alvo: g.targetValue,
        unidade: g.unit,
      })),
      acoes_diarias: (d.goalsDaily ?? []).length,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(overview, null, 2) }],
      structuredContent: { overview },
    };
  },
});
