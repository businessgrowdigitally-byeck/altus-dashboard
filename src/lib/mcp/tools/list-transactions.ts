import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadData } from "../data";

export default defineTool({
  name: "list_transactions",
  title: "Listar transações",
  description: "Lista as transações financeiras do usuário, das mais recentes para as mais antigas.",
  inputSchema: {
    type: z.enum(["entrada", "saida", "todas"]).nullable().describe("Filtrar por tipo. Use 'todas' ou null para tudo."),
    month: z.string().regex(/^\d{4}-\d{2}$/).nullable().describe("Mês no formato AAAA-MM, ou null para todos."),
    limit: z.number().int().min(1).max(200).nullable().describe("Quantidade máxima (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, month, limit }, ctx) => {
    const d = await loadData(ctx);
    let rows = [...(d.transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    if (type && type !== "todas") rows = rows.filter((t) => t.type === type);
    if (month) rows = rows.filter((t) => t.date.startsWith(month));
    rows = rows.slice(0, limit ?? 50);
    const transactions = rows.map((t) => ({
      id: t.id,
      tipo: t.type,
      valor: t.value,
      descricao: t.description,
      categoria: t.category,
      data: t.date,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(transactions, null, 2) }],
      structuredContent: { transactions },
    };
  },
});
