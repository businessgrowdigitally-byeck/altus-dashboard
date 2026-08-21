import { createFileRoute } from "@tanstack/react-router";
import { AI_AGENT_ENABLED } from "@/lib/features";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!AI_AGENT_ENABLED) {
          return new Response(
            JSON.stringify({ error: "O Agente IA é um add-on separado e não está ativo nesta versão." }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }


        const { messages, context } = (await request.json()) as {
          messages: { role: "user" | "assistant"; content: string }[];
          context: unknown;
        };

        const systemPrompt = `Você é o assistente executivo pessoal do usuário no ALTUS (Become your best version), um sistema operacional pessoal que trata a vida do usuário como uma empresa multinacional. Responda SEMPRE em português do Brasil, de forma direta, analítica e prática — como um CEO conversando com seu chefe de gabinete. Use dados, números e percentuais. Você tem acesso a TODOS os dados do usuário (finanças, corpo, biblioteca, estudos, metas, rotina diária):\n\n${JSON.stringify(context, null, 2)}\n\nFaça análises cruzadas entre módulos. Quando relevante, sugira ações concretas.`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          if (upstream.status === 429) {
            return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
              status: 429,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (upstream.status === 402) {
            return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos no workspace Lovable." }), {
              status: 402,
              headers: { "Content-Type": "application/json" },
            });
          }
          const text = await upstream.text();
          return new Response(JSON.stringify({ error: `AI gateway error: ${text}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});