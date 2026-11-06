import type { ToolContext } from "@lovable.dev/mcp-js";
import { ToolError } from "@lovable.dev/mcp-js";
// Extensão explícita para os testes rodarem direto no Node (--experimental-strip-types).
import { supabaseForUser } from "./supabase.ts";

/**
 * Todo o estado do ALTUS vive numa única linha JSON (`public.user_data`).
 * Estas funções leem e gravam essa linha em nome do usuário autenticado.
 */

export type AltusData = {
  profile?: {
    name?: string;
    goalWeight?: number;
    incomeTarget?: number;
    maxExpenses?: number;
    height?: number;
    openingBalance?: number;
  };
  transactions?: {
    id: string;
    type: "entrada" | "saida";
    value: number;
    description: string;
    category: string;
    date: string;
  }[];
  weights?: { id: string; weight: number; date: string; notes?: string }[];
  workouts?: { id: string; date: string; type: string; duration: number; notes?: string }[];
  books?: {
    id: string;
    title: string;
    author: string;
    genre: string;
    finishedAt: string;
    rating: number;
    notes?: string;
  }[];
  studies?: {
    id: string;
    date: string;
    topic: string;
    area: string;
    type: string;
    duration: number;
    learned?: string;
    status: string;
  }[];
  goalsMacro?: {
    id: string;
    name: string;
    area: string;
    currentValue: number;
    targetValue: number;
    unit: string;
    deadline?: string;
  }[];
  goalsDaily?: {
    id: string;
    name: string;
    area: string;
    daysOfWeek: number[];
    suggestedTime?: string;
  }[];
  completions?: { date: string; actionId: string }[];
  kaizen?: {
    id: string;
    date: string;
    improvedToday: string;
    improveTomorrow: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  }[];
};

export function userId(ctx: ToolContext): string {
  const id = ctx.getUserId();
  if (!id) throw new ToolError("Autenticação necessária");
  return id;
}

export async function loadData(ctx: ToolContext): Promise<AltusData> {
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", userId(ctx))
    .maybeSingle();
  if (error) throw new ToolError(error.message);
  return (data?.data as AltusData | undefined) ?? {};
}

/**
 * Lê, altera e grava a linha do usuário sem apagar o que outro aparelho salvou
 * no meio-tempo: grava só se `updated_at` ainda for o lido; se não for, relê e
 * reaplica a alteração (até 3 vezes).
 */
export async function mutateData(
  ctx: ToolContext,
  change: (d: AltusData) => AltusData,
): Promise<void> {
  const supabase = supabaseForUser(ctx);
  const uid = userId(ctx);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: row, error } = await supabase
      .from("user_data")
      .select("data, updated_at")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    const next = change((row?.data as AltusData | undefined) ?? {});
    if (!row) {
      const { error: insertError } = await supabase
        .from("user_data")
        .insert({ user_id: uid, data: next });
      if (!insertError) return;
      continue; // outra gravação criou a linha antes: tenta de novo
    }
    const { data: updated, error: updateError } = await supabase
      .from("user_data")
      .update({ data: next })
      .eq("user_id", uid)
      .eq("updated_at", row.updated_at)
      .select("updated_at");
    if (updateError) throw new ToolError(updateError.message);
    if (updated && updated.length === 1) return;
  }
  throw new ToolError("Os dados foram alterados em outro aparelho ao mesmo tempo. Tente de novo.");
}

export function newId(): string {
  return crypto.randomUUID();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
