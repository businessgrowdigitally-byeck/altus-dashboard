import { defineTool } from "@lovable.dev/mcp-js";
import { loadData } from "../data";

export default defineTool({
  name: "list_goals",
  title: "Listar metas e rotina",
  description: "Lista as metas macro (com progresso) e as ações da rotina diária do usuário.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const d = await loadData(ctx);
    const metas = (d.goalsMacro ?? []).map((g) => ({
      id: g.id,
      nome: g.name,
      area: g.area,
      atual: g.currentValue,
      alvo: g.targetValue,
      unidade: g.unit,
      prazo: g.deadline ?? null,
      progresso_pct: g.targetValue ? Math.round((g.currentValue / g.targetValue) * 100) : 0,
    }));
    const rotina = (d.goalsDaily ?? []).map((a) => ({
      id: a.id,
      nome: a.name,
      area: a.area,
      dias_da_semana: a.daysOfWeek,
      horario: a.suggestedTime ?? null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify({ metas, rotina }, null, 2) }],
      structuredContent: { metas, rotina },
    };
  },
});
