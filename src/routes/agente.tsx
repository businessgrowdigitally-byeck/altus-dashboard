import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/primitives";
import { Bot, Send, Sparkles } from "lucide-react";
import { AI_AGENT_ENABLED } from "@/lib/features";
import { daysAgoISO, todayISO } from "@/lib/format";
import { useT } from "@/lib/i18n";

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
    transactions,
    weights,
    books,
    studies,
    goalsMacro,
    goalsDaily,
    completions,
  } = useStore();
  const t = useT();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const buildContext = () => {
    const month = todayISO().slice(0, 7);
    const monthTx = transactions.filter((t) => t.date.startsWith(month));
    const income = monthTx.filter((t) => t.type === "entrada").reduce((a, b) => a + b.value, 0);
    const expense = monthTx.filter((t) => t.type === "saida").reduce((a, b) => a + b.value, 0);
    const byCat: Record<string, number> = {};
    monthTx
      .filter((t) => t.type === "saida")
      .forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + t.value));

    const hoursByArea: Record<string, number> = {};
    studies.forEach((s) => (hoursByArea[s.area] = (hoursByArea[s.area] || 0) + s.duration / 60));

    const days = new Set(studies.map((s) => s.date));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = daysAgoISO(i);
      if (days.has(d)) streak++;
      else if (i > 0) break;
    }

    return {
      financas_mes_atual: {
        entradas: income,
        saidas: expense,
        saldo: income - expense,
        por_categoria: byCat,
      },
      peso_historico: weights
        .slice(0, 10)
        .map((w) => ({ data: w.date, peso: w.weight, notas: w.notes })),
      livros: {
        total: books.length,
        nota_media: books.length ? books.reduce((a, b) => a + b.rating, 0) / books.length : 0,
        recentes: books
          .slice(0, 5)
          .map((b) => ({ titulo: b.title, autor: b.author, nota: b.rating })),
      },
      estudos: {
        horas_por_area: hoursByArea,
        streak_dias: streak,
        topicos_recentes: studies
          .slice(0, 5)
          .map((s) => ({ data: s.date, topico: s.topic, area: s.area })),
      },
      metas_macro: goalsMacro.map((g) => ({
        nome: g.name,
        area: g.area,
        atual: g.currentValue,
        alvo: g.targetValue,
        unidade: g.unit,
        deadline: g.deadline,
        pct: g.targetValue ? Math.round((g.currentValue / g.targetValue) * 100) : 0,
      })),
      rotina_diaria: {
        acoes: goalsDaily.map((a) => ({ nome: a.name, area: a.area, dias: a.daysOfWeek })),
        completions_ultimos_7_dias: completions.filter((c) => c.date >= daysAgoISO(6)).length,
      },
    };
  };

  const send = async (text?: string) => {
    const message = text ?? input;
    if (!message.trim() || loading) return;

    pushChat({ role: "user", content: message });
    setInput("");
    setLoading(true);

    const history = [...chat, { role: "user" as const, content: message }];

    try {
      const lang = (() => {
        try {
          const raw = localStorage.getItem("altus-lang");
          if (!raw) return "pt";
          const p = JSON.parse(raw);
          return p?.state?.lang ?? p?.lang ?? "pt";
        } catch { return "pt"; }
      })();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context: buildContext(), lang }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        pushChat({ role: "assistant", content: `Erro: ${errData.error || res.statusText}` });
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
      pushChat({ role: "assistant", content: `Erro: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <PageHeader title={t("agente.title")} subtitle={t("agente.subtitle")} />

      <div className="text-xs text-muted-foreground bg-gold/10 border border-gold/30 rounded-lg p-3 mb-4 flex items-center gap-2">
        <Sparkles size={14} className="text-gold" />
        {t("agente.accessNote")}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {chat.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            <Bot size={32} className="mx-auto text-gold mb-3" />
            {t("agente.emptyState")}
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-secondary border border-gold/40" : "glass"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl px-4 py-3 text-sm">{t("agente.thinking")}</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(t(p))}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("agente.placeholder")}
          className="flex-1 bg-secondary border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50"
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
            className="px-3 rounded-xl border border-white/10 hover:bg-white/5 text-xs"
          >
            {t("agente.clear")}
          </button>
        )}
      </div>
    </div>
  );
}
