import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadData, newId, saveData, todayISO } from "../data";

export default defineTool({
  name: "log_kaizen",
  title: "Registrar Kaizen do dia",
  description: "Grava a reflexão diária Kaizen: o que melhorou hoje e o que melhorar amanhã.",
  inputSchema: {
    improvedToday: z.string().trim().min(1).describe("O que foi melhorado hoje."),
    improveTomorrow: z.string().trim().min(1).describe("O que melhorar amanhã."),
    notes: z.string().trim().nullable().describe("Notas adicionais, ou null."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe("Data AAAA-MM-DD, ou null para hoje."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ improvedToday, improveTomorrow, notes, date }, ctx) => {
    const d = await loadData(ctx);
    const day = date ?? todayISO();
    const now = new Date().toISOString();
    const existing = (d.kaizen ?? []).find((k) => k.date === day);
    const row = {
      id: existing?.id ?? newId(),
      date: day,
      improvedToday,
      improveTomorrow,
      notes: notes ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const kaizen = [row, ...(d.kaizen ?? []).filter((k) => k.date !== day)];
    await saveData(ctx, { ...d, kaizen });
    return {
      content: [{ type: "text", text: `Kaizen de ${day} salvo.` }],
      structuredContent: { kaizen: { ...row } },
    };
  },
});
