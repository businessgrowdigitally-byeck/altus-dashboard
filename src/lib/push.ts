/**
 * Lembrete da manhã no navegador: inscrever / desinscrever ESTE aparelho.
 *
 * A inscrição (endpoint + chaves que o navegador entrega) vai direto para a
 * tabela `push_subscriptions` com o login da pessoa (RLS: só os próprios
 * aparelhos). O envio às 7h30 roda no servidor (/api/push/send).
 */
import { supabase } from "@/lib/supabase";
import { detectPushSupport, vapidKeyBytes, type PushSupport } from "@/lib/push-support";

export { detectPushSupport, vapidKeyBytes, type PushSupport };

export const VAPID_PUBLIC_KEY = (
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ""
).trim();

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  return detectPushSupport({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
    permission: "Notification" in window ? Notification.permission : "default",
  });
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

async function deleteRow(endpoint: string) {
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

/** Está ativado NESTE aparelho para a conta logada? */
export async function isPushOnHere(): Promise<boolean> {
  const sub = await currentSubscription();
  if (!sub) return false;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", sub.endpoint)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export class PushNotConfiguredError extends Error {}

/** Pede permissão, inscreve o aparelho e grava a inscrição. "denied" se a pessoa recusar. */
export async function enablePush(lang: string): Promise<"on" | "denied"> {
  if (!VAPID_PUBLIC_KEY) throw new PushNotConfiguredError("VITE_VAPID_PUBLIC_KEY");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
    throw new Error("inscrição sem chaves");
  // Sem política de update: apaga a linha antiga deste aparelho (se houver) e cria de novo.
  await deleteRow(json.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    lang: lang === "en" || lang === "es" ? lang : "pt",
  });
  if (error) throw new Error(error.message);
  return "on";
}

/** Apaga a inscrição deste aparelho (na conta logada) e cancela no navegador. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await deleteRow(sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Ao sair da conta: este aparelho para de receber o lembrete (que traz o
 * Kaizen da pessoa). Nunca trava o logout: desiste depois de 3 s.
 */
export async function forgetThisDevice(): Promise<void> {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await Promise.race([
      navigator.serviceWorker.getRegistration(),
      new Promise<undefined>((r) => setTimeout(() => r(undefined), 3000)),
    ]);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await Promise.race([
      Promise.allSettled([deleteRow(sub.endpoint), sub.unsubscribe()]),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {
    /* O logout continua mesmo assim. */
  }
}

/** "Enviar teste": o servidor manda agora para os aparelhos desta conta. */
export async function sendTestPush(token: string): Promise<{ sent: number }> {
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: "{}",
  });
  const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return { sent: body.sent ?? 0 };
}
