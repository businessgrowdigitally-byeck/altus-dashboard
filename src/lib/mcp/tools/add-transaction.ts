import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadData, newId, saveData, todayISO } from "../data";

export default defineTool({
  name: "add_transaction",
  title: "Registrar transação",
  description: "Registra uma entrada ou saída financeira no ALTUS.",
  inputSchema: {
    type: z.enum(["entrada", "saida"]).describe("Tipo do lançamento."),
    value: z.number().positive().describe("Valor em reais."),
    description: z.string().trim().min(1).describe("Descrição curta."),
    category: z.string().trim().min(1).describe("Categoria, ex.: Alimentação, Salário."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe("Data AAAA-MM-DD, ou null para hoje."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ type, value, description, category, date }, ctx) => {
    const d = await loadData(ctx);
    const row = { id: newId(), type, value, description, category, date: date ?? todayISO() };
    await saveData(ctx, { ...d, transactions: [row, ...(d.transactions ?? [])] });
    return {
      content: [{ type: "text", text: `Transação registrada: ${row.description} (R$ ${row.value}).` }],
      structuredContent: { transaction: { ...row } },
    };
  },
});
