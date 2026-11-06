import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { deliver, pushEnv, type StoredSubscription } from "@/lib/push-server";
import { buildMorningPush, normalizePushLang, pushText, saoPauloDate } from "@/lib/push-message";
import { webPushSend } from "@/lib/web-push-sender";

/**
 * "Enviar teste" (Configurações): envia agora, SÓ para os aparelhos da pessoa
 * logada, o lembrete que ela receberia às 7h30 — ou uma mensagem de teste, se
 * hoje não houver nada para lembrar. Lê com o token da própria pessoa (RLS).
 */
export const Route = createFileRoute("/api/push/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") ?? "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
        if (!token) return json({ error: "Sessão ausente. Faça login novamente." }, 401);
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
          return json({ error: "Sessão inválida ou expirada. Faça login novamente." }, 401);
        }

        const env = pushEnv(process.env);
        if (!env.publicKey || !env.privateKey || !env.subject) {
          return json({ error: "Lembrete não configurado no servidor." }, 503);
        }

        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: subs, error: subsError } = await userClient
          .from("push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth, lang")
          .eq("user_id", userData.user.id);
        if (subsError) return json({ error: "Não foi possível ler seus aparelhos." }, 500);
        if (!subs?.length) return json({ error: "Nenhum aparelho inscrito nesta conta." }, 404);

        const { data: row } = await userClient
          .from("user_data")
          .select("data")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        const today = saoPauloDate();
        const report = await deliver(
          subs as StoredSubscription[],
          (sub) => {
            const lang = normalizePushLang(sub.lang);
            return (
              buildMorningPush(row?.data ?? {}, today, lang) ?? {
                title: pushText("push.testTitle", lang),
                body: pushText("push.testBody", lang),
                url: "/",
                tag: "altus-lembrete-teste",
              }
            );
          },
          {
            send: webPushSend(env),
            remove: async (ids) => {
              await userClient.from("push_subscriptions").delete().in("id", ids);
            },
          },
        );
        return json(report, 200);
      },
    },
  },
});

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
