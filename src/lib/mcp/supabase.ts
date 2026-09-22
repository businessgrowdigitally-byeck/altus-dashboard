import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Cliente Supabase usado pelas ferramentas MCP.
 * Sempre encaminha o token do usuário autenticado — a RLS decide o que ele vê.
 */

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const DEFAULT_URL = "https://oskwtnluunvdlbjptday.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za3d0bmx1dW52ZGxianB0ZGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzA1OTAsImV4cCI6MjEwMjg0NjU5MH0.VNP3iFTocqMspsUGNkn-y29yZSPU3mPWw01yjMx__Ns";

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.process?.env?.[name]?.trim() || undefined;
}

function projectUrl(): string {
  return runtimeEnv("SUPABASE_URL") ?? runtimeEnv("VITE_SUPABASE_URL") ?? DEFAULT_URL;
}

function publishableKey(): string {
  return (
    runtimeEnv("SUPABASE_PUBLISHABLE_KEY") ??
    runtimeEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    runtimeEnv("SUPABASE_ANON_KEY") ??
    runtimeEnv("VITE_SUPABASE_ANON_KEY") ??
    DEFAULT_ANON_KEY
  );
}

export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("Autenticação necessária");
  return createClient(projectUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
