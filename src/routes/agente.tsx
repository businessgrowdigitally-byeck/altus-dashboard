import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/primitives";
import { Bot, Send, Sparkles } from "lucide-react";
import { AI_AGENT_ENABLED } from "@/lib/features";
import { todayISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { buildChatHistory } from "@/lib/ai/history";
import { stripPlanBlocks } from "@/lib/ai/plan";
import { proposalViews } from "@/lib/ai/proposal";
import { PlanProposalCard } from "@/components/PlanProposalCard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/agente")({
  // Agente vendido separadamente como add-on: rota desativada nesta versão.
  beforeLoad: () => {
    if (!AI_AGENT_ENABLED) throw redirect({ to: "/" });
  },
  component: Agente,
});

const QUICK_PROMPTS = [
  "agente.quick1",
  "agente.quick2",
  "agente.quick3",
  "agente.quick4",
  "agente.quick5",
  "agente.quick6",
];

function Agente() {
  const {
    chat,
    pushChat,
    updateLastAssistant,
    clearChat,
  } = useStore();
  const { lang, t } = useI18n();
  const { session } = useAuth();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const views = useMemo(() => proposalViews(chat, loading), [chat, loading]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const send = async (text?: string) => {
    const message = text ?? input;
    if (!message.trim() || loading) return;

    pushChat({ role: "user", content: message });
    setInput("");
    setLoading(true);

    // Só a janela recente e válida (sem erros nem respostas vazias) vai ao servidor.
    const history = buildChatHistory([...chat, { role: "user", content: message }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // A rota só aceita chamadas autenticadas: prova nossa identidade com o token da sessão.
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ messages: history, lang, today: todayISO() }),
      });

      if (!res.ok || !res.body) {
        // Respostas fora do formato JSON (ex.: página de erro do servidor) mostram o status HTTP.
        const errData = await res
          .json()
          .catch(() => ({ error: `Erro desconhecido (HTTP ${res.status})` }));
        pushChat({ role: "assistant", content: `Erro: ${errData.error || res.statusText}`, error: true });
        setLoading(false);
        return;
      }

      pushChat({ role: "assistant", content: "" });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              updateLastAssistant(acc);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err: unknown) {
      pushChat({ role: "assistant", content: `Erro: ${(err as Error).message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    // Celular: a altura da tela menos a barra superior (55px), o respiro do topo
    // (16px) e a área da barra de navegação (4.5rem), para o campo de digitar
    // ficar visível sem rolar a página. `dvh` acompanha a barra do navegador.
    <div className="flex flex-col h-[calc(100dvh-143px-env(safe-area-inset-bottom))] md:h-[calc(100vh-6rem)]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {/* Título e aviso rolam com a conversa: no celular, sobra espaço para as mensagens. */}
        <PageHeader title={t("agente.title")} subtitle={t("agente.subtitle")} />
        <div className="text-xs text-muted-foreground bg-gold/10 border border-gold/30 rounded-lg p-3 flex items-center gap-2">
          <Sparkles size={14} className="text-gold shrink-0" />
          {t("agente.accessNote")}
        </div>
        {chat.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            <Bot size={32} className="mx-auto text-gold mb-3" />
            {t("agente.emptyState")}
          </div>
        )}
        {chat.map((m, i) => {
          // O bloco técnico ```altus-plan``` vira o cartão de confirmação abaixo.
          const text = m.role === "assistant" ? stripPlanBlocks(m.content) : m.content;
          return (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[92%] md:max-w-[80%]">
                {text && (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      m.role === "user" ? "bg-secondary border border-gold/40" : "glass"
                    }`}
                  >
                    {text}
                  </div>
                )}
                <PlanProposalCard index={i} view={views[i]} />
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl px-4 py-3 text-sm">{t("agente.thinking")}</div>
          </div>
        )}
      </div>

      {/* Celular: uma linha com rolagem lateral, para sobrar espaço para a conversa. */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(t(p))}
            disabled={loading}
            className="shrink-0 whitespace-nowrap md:whitespace-normal text-xs px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted/80 border border-border transition"
          >
            {t(p)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("agente.placeholder")}
          className="flex-1 min-w-0 bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50"
        />
        <button
          onClick={() => send()}
          disabled={loading}
          className="bg-gold text-[#0A0F1E] px-4 rounded-xl font-semibold hover:brightness-110 transition disabled:opacity-50"
        >
          <Send size={18} />
        </button>
        {chat.length > 0 && (
          <button
            onClick={clearChat}
            className="px-3 rounded-xl border border-border hover:bg-muted/50 text-xs"
          >
            {t("agente.clear")}
          </button>
        )}
      </div>
    </div>
  );
}
