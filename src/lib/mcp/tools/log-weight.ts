import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadData, newId, saveData, todayISO } from "../data";

export default defineTool({
  name: "log_weight",
  title: "Registrar peso",
  description: "Adiciona um registro de peso corporal (kg) no módulo Corpo & Saúde.",
  inputSchema: {
    weight: z.number().positive().max(500).describe("Peso em quilos."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe("Data AAAA-MM-DD, ou null para hoje."),
    notes: z.string().trim().nullable().describe("Observação opcional."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ weight, date, notes }, ctx) => {
    const d = await loadData(ctx);
    const row = { id: newId(), weight, date: date ?? todayISO(), notes: notes ?? undefined };
    await saveData(ctx, { ...d, weights: [row, ...(d.weights ?? [])] });
    return {
      content: [{ type: "text", text: `Peso registrado: ${weight} kg em ${row.date}.` }],
      structuredContent: { weight: { id: row.id, peso: row.weight, data: row.date, notas: row.notes ?? null } },
    };
  },
});
