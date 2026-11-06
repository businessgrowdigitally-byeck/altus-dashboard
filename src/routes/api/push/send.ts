import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase";
import {
  deliver,
  morningMessages,
  pushEnv,
  sameSecret,
  type StoredSubscription,
} from "@/lib/push-server";
import { saoPauloDate } from "@/lib/push-message";
import { webPushSend } from "@/lib/web-push-sender";

const PAGE = 1000;
const USERS_PER_QUERY = 100;

/**
 * Lembrete da manhã: chamado todo dia às 7h30 (São Paulo) pelo agendador do
 * Supabase (supabase/push-cron.sql), com `Authorization: Bearer CRON_SECRET`.
 * Para cada aparelho inscrito, monta a mensagem com os dados da pessoa (sem IA)
 * e envia; quem não tem nada para lembrar não recebe nada.
 */
export const Route = createFileRoute("/api/push/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = pushEnv(process.env);
        if (env.missing.length) {
          console.warn("[api/push/send] variáveis faltando:", env.missing.join(", "));
          return json({ error: "Lembrete não configurado no servidor." }, 503);
        }
        const authorization = request.headers.get("authorization") ?? "";
        const given = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
        if (!sameSecret(given, env.cronSecret)) return json({ error: "Não autorizado." }, 401);

        // Chave service_role: lê as inscrições e os dados de todos (só no servidor).
        const admin = createClient(SUPABASE_URL, env.serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const subs: StoredSubscription[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await admin
            .from("push_subscriptions")
            .select("id, user_id, endpoint, p256dh, auth, lang")
            .order("created_at")
            .range(from, from + PAGE - 1);
          if (error) {
            console.error("[api/push/send] erro ao ler inscrições", error.message);
            return json({ error: "Não foi possível ler as inscrições." }, 500);
          }
          subs.push(...((data ?? []) as StoredSubscription[]));
          if (!data || data.length < PAGE) break;
        }

        const userIds = [...new Set(subs.map((s) => s.user_id))];
        const dataByUser = new Map<string, unknown>();
        for (let i = 0; i < userIds.length; i += USERS_PER_QUERY) {
          const { data, error } = await admin
            .from("user_data")
            .select("user_id, data")
            .in("user_id", userIds.slice(i, i + USERS_PER_QUERY));
          if (error) {
            console.error("[api/push/send] erro ao ler dados", error.message);
            return json({ error: "Não foi possível ler os dados." }, 500);
          }
          for (const row of data ?? []) dataByUser.set(row.user_id as string, row.data);
        }

        const today = saoPauloDate();
        const report = await deliver(subs, morningMessages(dataByUser, today), {
          send: webPushSend(env),
          remove: async (ids) => {
            const { error } = await admin.from("push_subscriptions").delete().in("id", ids);
            if (error) console.error("[api/push/send] erro ao apagar expiradas", error.message);
          },
        });
        console.info("[api/push/send]", today, JSON.stringify(report));
        return json({ date: today, subscriptions: subs.length, ...report }, 200);
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
