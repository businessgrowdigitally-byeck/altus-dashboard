/** Detecção pura de suporte a push e conversão da chave VAPID (sem dependências, testável). */

export type PushSupport = "ready" | "ios-install" | "unsupported" | "denied";

export type PushEnvironment = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: string;
};

/**
 * iPhone/iPad só recebem push com o app aberto pela Tela de Início (iOS 16.4+);
 * no Safari comum mostramos a instrução em vez do botão.
 */
export function detectPushSupport(e: PushEnvironment): PushSupport {
  const ios =
    /iPad|iPhone|iPod/.test(e.userAgent) || (e.platform === "MacIntel" && e.maxTouchPoints > 1);
  if (ios && !e.standalone) return "ios-install";
  if (!e.hasServiceWorker || !e.hasPushManager || !e.hasNotification) return "unsupported";
  if (e.permission === "denied") return "denied";
  return "ready";
}

/** Chave VAPID pública (base64url) no formato que o PushManager espera. */
export function vapidKeyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
