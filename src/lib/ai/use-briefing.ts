import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { isSyncReady, useSyncStatus } from "@/lib/sync";
import { AI_AGENT_ENABLED } from "@/lib/features";
import { todayISO } from "@/lib/format";
import { readChatStream } from "@/lib/ai/stream";
import { BRIEFING_TEXT_MAX } from "@/lib/notifications";

/** Pedidos já feitos nesta aba (um por dia e idioma), para não repetir em cada tela. */
const requested = new Set<string>();

export type BriefingState = "ready" | "loading" | "unavailable";

/**
 * Resumo da manhã do GOAT: gerado pela IA no máximo 1x por dia (e idioma),
 * guardado em `dailyBriefing` e sincronizado — outro aparelho reaproveita.
 * Só pede depois da carga inicial da nuvem, para não gerar de novo um resumo
 * que já existe. Se falhar (limite, rede), a Home segue só com os insights.
 */
export function useDailyBriefing(): { text: string | null; state: BriefingState } {
  const { session } = useAuth();
  const { lang } = useI18n();
  const briefing = useStore((s) => s.dailyBriefing);
  const setDailyBriefing = useStore((s) => s.setDailyBriefing);
  const syncStatus = useSyncStatus((s) => s.status);
  const [loading, setLoading] = useState(false);
  const today = todayISO();
  const current = briefing && briefing.date === today && briefing.lang === lang ? briefing : null;
  const token = session?.access_token;

  useEffect(() => {
    if (!AI_AGENT_ENABLED || !token || current) return;
    if (!isSyncReady() || syncStatus === "loading") return;
    const key = `${today}|${lang}`;
    if (requested.has(key)) return;
    requested.add(key);
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: "briefing", lang, today }),
        });
        if (!res.ok || !res.body) return;
        const text = (await readChatStream(res.body)).trim().slice(0, BRIEFING_TEXT_MAX);
        // Outro aparelho pode ter salvo um resumo enquanto este esperava: mantém o dele.
        const now = useStore.getState().dailyBriefing;
        if (text && !(now && now.date === today && now.lang === lang))
          setDailyBriefing({ date: today, text, lang });
      } catch {
        /* Sem resumo hoje: a Home continua com os insights calculados. */
      } finally {
        setLoading(false);
      }
    })();
  }, [token, current, syncStatus, today, lang, setDailyBriefing]);

  if (current) return { text: current.text, state: "ready" };
  return { text: null, state: loading ? "loading" : "unavailable" };
}
