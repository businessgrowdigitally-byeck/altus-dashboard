import webpush from "web-push";
import type { PushDeps, StoredSubscription } from "@/lib/push-server";

/** Envio real com a biblioteca web-push (VAPID). 404/410 = inscrição expirada. */
export function webPushSend(keys: {
  publicKey: string;
  privateKey: string;
  subject: string;
}): PushDeps["send"] {
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return async (sub: StoredSubscription, payload: string) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        // Se o celular estiver desligado, o serviço de push guarda por até 6 h.
        { TTL: 6 * 3600, urgency: "normal" },
      );
      return { ok: true };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      return { ok: false, gone: status === 404 || status === 410, status };
    }
  };
}
