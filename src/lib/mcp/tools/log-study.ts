import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadData, newId, saveData, todayISO } from "../data";

export default defineTool({
  name: "log_study",
  title: "Registrar estudo",
  description: "Registra uma sessão de estudo (tópico, área, duração e aprendizados).",
  inputSchema: {
    topic: z.string().trim().min(1).describe("Tópico estudado."),
    area: z.string().trim().min(1).describe("Área de conhecimento."),
    duration: z.number().int().positive().max(1440).describe("Duração em minutos."),
    type: z.string().trim().nullable().describe("Tipo de estudo (curso, leitura...), ou null."),
    learned: z.string().trim().nullable().describe("O que foi aprendido, ou null."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe("Data AAAA-MM-DD, ou null para hoje."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ topic, area, duration, type, learned, date }, ctx) => {
    const d = await loadData(ctx);
    const row = {
      id: newId(),
      date: date ?? todayISO(),
      topic,
      area,
      type: type ?? "Estudo",
      duration,
      learned: learned ?? undefined,
      status: "concluido",
    };
    await saveData(ctx, { ...d, studies: [row, ...(d.studies ?? [])] });
    return {
      content: [{ type: "text", text: `Estudo registrado: ${topic} (${duration} min).` }],
      structuredContent: { study: { ...row, learned: row.learned ?? null } },
    };
  },
});
