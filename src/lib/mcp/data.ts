import type { ToolContext } from "@lovable.dev/mcp-js";
import { ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

/**
 * Todo o estado do ALTUS vive numa única linha JSON (`public.user_data`).
 * Estas funções leem e gravam essa linha em nome do usuário autenticado.
 */

export type AltusData = {
  profile?: { name?: string; goalWeight?: number; incomeTarget?: number; maxExpenses?: number; height?: number };
  transactions?: { id: string; type: "entrada" | "saida"; value: number; description: string; category: string; date: string }[];
  weights?: { id: string; weight: number; date: string; notes?: string }[];
  workouts?: { id: string; date: string; type: string; duration: number; notes?: string }[];
  books?: { id: string; title: string; author: string; genre: string; finishedAt: string; rating: number; notes?: string }[];
  studies?: { id: string; date: string; topic: string; area: string; type: string; duration: number; learned?: string; status: string }[];
  goalsMacro?: { id: string; name: string; area: string; currentValue: number; targetValue: number; unit: string; deadline?: string }[];
  goalsDaily?: { id: string; name: string; area: string; daysOfWeek: number[]; suggestedTime?: string }[];
  completions?: { date: string; actionId: string }[];
  kaizen?: { id: string; date: string; improvedToday: string; improveTomorrow: string; notes: string; createdAt: string; updatedAt: string }[];
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

export async function saveData(ctx: ToolContext, next: AltusData): Promise<void> {
  const supabase = supabaseForUser(ctx);
  const { error } = await supabase.from("user_data").upsert({
    user_id: userId(ctx),
    data: next,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new ToolError(error.message);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
