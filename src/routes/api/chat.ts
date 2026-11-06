import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { AI_AGENT_ENABLED } from "@/lib/features";
import { buildMentorContext } from "@/lib/ai/context";
import {
  buildBriefingSystemPrompt,
  buildMentorSystemPrompt,
  normalizeLang,
} from "@/lib/ai/system-prompt";
import { quotaDecision, quotaLimits } from "@/lib/ai/quota";
import {
  MAX_CHAT_MESSAGES as MAX_MESSAGES,
  MAX_CHAT_MESSAGE_CHARS as MAX_MESSAGE_CHARS,
} from "@/lib/ai/history";

const MAX_CONTEXT_CHARS = 256_000;
const MAX_BODY_BYTES = 1_024 * 1_024; // 1 MiB de texto cru

type ChatRole = "user" | "assistant";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!AI_AGENT_ENABLED) {
          return jsonResponse({ error: "O Agente IA é um add-on separado e não está ativo nesta versão." }, 403);
        }

        // Autenticação: o cliente precisa provar quem é com o access token.
        // Nunca confiamos em user_id/context enviados pelo cliente.
        const authorization = request.headers.get("authorization") ?? "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
        if (!token) return jsonResponse({ error: "Sessão ausente. Faça login novamente." }, 401);

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
          return jsonResponse({ error: "Sessão inválida ou expirada. Faça login novamente." }, 401);
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          return jsonResponse({ error: "GEMINI_API_KEY não configurada no ambiente." }, 500);
        }

        // Lê e valida o corpo como texto para impor limite de tamanho antes do parse.
        const raw = await request.text();
        if (byteLength(raw) > MAX_BODY_BYTES) {
          return jsonResponse({ error: "Requisição grande demais. Reduza o contexto enviado." }, 400);
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return jsonResponse({ error: "Payload inválido: JSON malformado." }, 400);
        }

        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          return jsonResponse({ error: "Payload inválido: esperado um objeto." }, 400);
        }

        const body = parsed as {
          messages?: unknown;
          lang?: unknown;
          /** Data local do usuário (AAAA-MM-DD); só define o "hoje" do contexto. */
          today?: unknown;
          /** "briefing": resumo da manhã do GOAT (sem histórico); padrão: chat. */
          mode?: unknown;
        };
        const briefing = body.mode === "briefing";

        // messages: array finito de {role, content} com limites de tamanho.
        // O resumo da manhã não tem conversa: o pedido é fixo, montado aqui.
        const messages = briefing
          ? [{ role: "user" as const, content: "Escreva o resumo da manhã de hoje." }]
          : isValidMessages(body.messages);
        if (!messages) {
          return jsonResponse(
            { error: "Payload inválido: 'messages' deve ser um array com até 24 mensagens de texto curtas." },
            400,
          );
        }

        // Contexto: lido NO SERVIDOR com o token do usuário (RLS garante que só
        // a própria linha é visível). `body.context` do navegador é ignorado.
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

        // Limite de uso por pessoa (dia e minuto), contado no Supabase com o token
        // do próprio usuário. Só pedidos válidos chegam aqui e são contados.
        const limits = quotaLimits(process.env);
        const { data: quota, error: quotaError } = await userClient.rpc("consume_chat_quota", {
          p_daily_limit: limits.daily,
          p_minute_limit: limits.minute,
        });
        const decision = quotaDecision(quota, quotaError);
        if (decision.kind === "blocked" || decision.kind === "error") {
          return jsonResponse({ error: decision.message }, decision.status);
        }
        if (decision.kind === "not-installed") {
          console.warn(
            "[api/chat] limite de uso inativo: rode supabase/schema.sql (consume_chat_quota)",
          );
        }

        const { data: row, error: rowError } = await userClient
          .from("user_data")
          .select("data")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (rowError) {
          return jsonResponse({ error: "Não foi possível ler seus dados agora. Tente novamente." }, 500);
        }
        const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
          ? body.today
          : new Date().toISOString().slice(0, 10);
        let contextText = JSON.stringify(buildMentorContext(row?.data ?? {}, today));
        if (contextText.length > MAX_CONTEXT_CHARS) contextText = contextText.slice(0, MAX_CONTEXT_CHARS);

        const lang = normalizeLang(body.lang);
        const systemPrompt = briefing
          ? buildBriefingSystemPrompt(lang, contextText)
          : buildMentorSystemPrompt(lang, contextText);

        let upstream: Response;
        try {
          upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${geminiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gemini-2.5-flash",
              messages: [{ role: "system", content: systemPrompt }, ...messages],
              stream: true,
            }),
          });
        } catch (err) {
          // Falha de rede antes de qualquer resposta: sem isso o erro vira a
          // página HTML genérica e o chat só consegue mostrar "Erro desconhecido".
          console.error("[api/chat] falha ao chamar o Gemini", err);
          return jsonResponse(
            { error: "Não foi possível conectar ao serviço de IA. Tente novamente." },
            502,
          );
        }

        if (!upstream.ok || !upstream.body) {
          if (upstream.status === 429) {
            return jsonResponse({ error: "Limite de requisições excedido. Tente novamente em instantes." }, 429);
          }
          // Não devolve o texto interno do gateway ao cliente (evita vazar detalhes).
          return jsonResponse({ error: "O serviço de IA está indisponível no momento. Tente novamente." }, 500);
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});

function jsonResponse(body: { error: string }, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isValidMessages(value: unknown): { role: ChatRole; content: string }[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;
  const out: { role: ChatRole; content: string }[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const m = item as { role?: unknown; content?: unknown };
    if (m.role !== "user" && m.role !== "assistant") return null;
    if (typeof m.content !== "string" || m.content.length === 0 || m.content.length > MAX_MESSAGE_CHARS) {
      return null;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
}