import { createClient } from "@supabase/supabase-js";

/**
 * Conexão com o Supabase.
 *
 * A chave `anon` é pública por natureza — ela viaja dentro do JavaScript de
 * qualquer site publicado. Quem protege os dados é a Row Level Security
 * (ver supabase/schema.sql), que faz o banco recusar leituras de linhas que
 * não pertencem ao usuário logado.
 *
 * Deixá-la aqui evita ter que configurar variáveis de ambiente no Lovable, na
 * Cloudflare e localmente. Para apontar para outro projeto Supabase, basta
 * definir VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — elas têm prioridade.
 */
const DEFAULT_URL = "https://oskwtnluunvdlbjptday.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za3d0bmx1dW52ZGxianB0ZGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzA1OTAsImV4cCI6MjEwMjg0NjU5MH0.VNP3iFTocqMspsUGNkn-y29yZSPU3mPWw01yjMx__Ns";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

const isBrowser = typeof window !== "undefined";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    storageKey: "altus-auth",
  },
});
