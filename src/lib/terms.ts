import { supabase } from "./supabase";

/**
 * Consentimento LGPD: aceite dos Termos de Uso e da Política de Privacidade.
 *
 * Cada aceite vira uma linha em `consent_records` (ver supabase/schema.sql).
 * O gate de termos compara a versão vigente com a última aceita pelo usuário:
 * se divergirem (ou não existir), o aceite é solicitado novamente.
 */

/** Versão vigente dos documentos. Ao revisar o texto, incremente (ex.: "1.1") para re-solicitar o aceite. */
export const TERMS_VERSION = "1.0";

/** Retorna a versão do documento aceito mais recentemente, ou null se nunca aceitou. */
export async function getAcceptedTermsVersion(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("consent_records")
    .select("document_version")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.document_version ?? null;
}

/** Registra o aceite da versão vigente para o usuário. */
export async function recordTermsAcceptance(userId: string): Promise<void> {
  const { error } = await supabase
    .from("consent_records")
    .insert({ user_id: userId, document_version: TERMS_VERSION });
  if (error) throw new Error(error.message);
}
